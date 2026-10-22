import * as mat3 from '@/engine/core/math/mat3';
import * as mat4 from '@/engine/core/math/mat4';
import * as vec3 from '@/engine/core/math/vec3';
import { createMaterial, type Material } from '@/engine/core/scene/material';
import type { Entity } from '@/engine/core/scene/entity';
import { getTriangleCount, type MeshData } from '@/engine/renderer/geometry/mesh-data';
import type { GL } from '@/engine/renderer/gl/context';
import type { FullscreenTriangle } from '@/engine/renderer/gl/fullscreen-triangle';
import type { GpuTextureCache } from '@/engine/renderer/gl/gpu-texture-cache';
import type { ShaderDefines } from '@/engine/renderer/gl/shader-source';
import { MaterialStateRegistry, type MaterialState } from '@/engine/renderer/batching/material-state';
import { Frustum } from '@/engine/renderer/culling/frustum';
import type { RenderableBounds } from '@/engine/renderer/culling/renderable-bounds';
import { projectAabbToNdcRect } from '@/engine/renderer/culling/screen-coverage';
import type { ShadowCasterCandidate, VisibleMesh, VisibleSet } from '@/engine/renderer/culling/visible-set';
import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import type { SceneLightingInput } from '@/engine/renderer/lighting/scene-lighting-uniforms';
import type { ShadowGeometryHook } from '@/engine/renderer/passes/shadow-pass';
import { ACTIVATION_HYSTERESIS, MAX_CLASSIC_FALLBACK_TRIANGLES, MAX_HIERARCHY_LEVELS, MIN_VIRTUAL_TRIANGLES } from './data/myriad-limits';
import { ClusterCullPass } from './runtime/cluster-cull-pass';
import { ClusterRasterPass, POST_PASS_BIT } from './runtime/cluster-raster-pass';
import { ClusterSelector, type ErrorProjector, type SelectionRequest } from './runtime/cluster-selector';
import { DepthPyramid } from './runtime/depth-pyramid';
import { DepthPyramidView } from './runtime/depth-pyramid-view';
import { FlagReadback } from './runtime/flag-readback';
import { EntryList, INSTANCE_BASE_COLOR_OFFSET, INSTANCE_EMISSIVE_OFFSET, INSTANCE_MAP_PARAMS_OFFSET, INSTANCE_UV_OFFSET, INSTANCE_NORMAL_MATRIX_OFFSET, INSTANCE_PREVIOUS_WORLD_OFFSET, INSTANCE_SURFACE_OFFSET, INSTANCE_WORLD_OFFSET, InstanceTable, } from './runtime/frame-data';
import { GeometryPool } from './runtime/geometry-pool';
import { MaterialResolvePass } from './runtime/material-resolve-pass';
import { MyriadMeshCache, type MyriadMeshEntry } from './runtime/myriad-mesh-cache';
import { createMyriadSettings, debugViewIndex, type MyriadSettings } from './runtime/myriad-settings';
import { VisibilityBuffer } from './runtime/visibility-buffer';
const PREFERRED_WIDTH_SHIFT = 12;
const DEFAULT_MATERIAL = createMaterial({ baseColor: vec3.create(0.6, 0.6, 0.6) });
function waitsForBuild(entry: MyriadMeshEntry): boolean {
    if (entry.state !== 'queued' && entry.state !== 'building')
        return false;
    return getTriangleCount(entry.source) > MAX_CLASSIC_FALLBACK_TRIANGLES;
}
export interface MyriadFrameStats {
    active: boolean;
    classicTriangles: number;
    activationTriangles: number;
    instances: number;
    waiting: number;
    clusters: number;
    triangles: number;
    readonly perLevel: Uint32Array;
    groupsVisited: number;
    frustumCulled: number;
    occlusionMainVisible: number;
    occlusionPostVisible: number;
    occlusionEntries: number;
    occlusionActive: boolean;
    occlusionSupported: boolean;
    shadowClusters: number;
    shadowTriangles: number;
    drawCalls: number;
    materialStates: number;
    width: number;
    height: number;
    poolVertices: number;
    poolClusters: number;
    poolBytes: number;
    poolMeshes: number;
    buildPending: number;
    buildReady: number;
    buildFailed: number;
    building: string;
}
export function createMyriadFrameStats(): MyriadFrameStats {
    return {
        active: false,
        classicTriangles: 0,
        activationTriangles: 0,
        instances: 0,
        waiting: 0,
        clusters: 0,
        triangles: 0,
        perLevel: new Uint32Array(MAX_HIERARCHY_LEVELS),
        groupsVisited: 0,
        frustumCulled: 0,
        occlusionMainVisible: 0,
        occlusionPostVisible: 0,
        occlusionEntries: 0,
        occlusionActive: false,
        occlusionSupported: false,
        shadowClusters: 0,
        shadowTriangles: 0,
        drawCalls: 0,
        materialStates: 0,
        width: 0,
        height: 0,
        poolVertices: 0,
        poolClusters: 0,
        poolBytes: 0,
        poolMeshes: 0,
        buildPending: 0,
        buildReady: 0,
        buildFailed: 0,
        building: '',
    };
}
export interface MyriadCollectInput {
    visible: VisibleSet;
    camera: PerspectiveCamera;
    frustum: Frustum | null;
    selection: ReadonlySet<number> | null;
}
export class MyriadSystem implements ShadowGeometryHook {
    readonly stats = createMyriadFrameStats();
    readonly defines: ShaderDefines;
    private settings: MyriadSettings = createMyriadSettings();
    private readonly cache = new MyriadMeshCache();
    private readonly pool: GeometryPool;
    private readonly instances: InstanceTable;
    private readonly list: EntryList;
    private readonly shadowList: EntryList;
    private readonly selector = new ClusterSelector();
    private readonly shadowSelector = new ClusterSelector();
    private readonly states = new MaterialStateRegistry();
    private readonly cull: ClusterCullPass;
    private readonly raster: ClusterRasterPass;
    private readonly pyramid: DepthPyramid;
    private readonly pyramidView: DepthPyramidView;
    private readonly visibility: VisibilityBuffer;
    private readonly resolvePass: MaterialResolvePass;
    private readonly readback: FlagReadback;
    private readonly previousWorld = new WeakMap<Entity, Float32Array>();
    private readonly previousViewProjection = mat4.create();
    private readonly shadowFrustum = new Frustum();
    private readonly normalMatrix = mat3.create();
    private readonly frameStates: MaterialState[] = [];
    private stateStamps = new Uint32Array(64);
    private stateSlots = new Int32Array(64);
    private stateStamp = 0;
    private frameRects = new Float32Array(64 * 4);
    private readonly boundsRect = new Float32Array(4);
    private readonly projector: ErrorProjector = { perspective: true, cameraPosition: vec3.create(), pixelScale: 1, near: 0.05, texelSize: 1 };
    private readonly request: SelectionRequest = {
        world: new Float32Array(16),
        scale: 1,
        instance: 0,
        state: 0,
        doubleSided: false,
        frustum: null,
        projector: this.projector,
        threshold: 1,
    };
    private active = false;
    private activationTriangles = Infinity;
    private frozen = false;
    private selectionDirty = false;
    private flagsValid = false;
    constructor(private readonly gl: GL, private readonly triangle: FullscreenTriangle, private readonly textures: GpuTextureCache, hdrDefines: ShaderDefines) {
        const maxSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
        const shift = Math.min(PREFERRED_WIDTH_SHIFT, Math.floor(Math.log2(maxSize)));
        const width = 1 << shift;
        this.defines = { ...hdrDefines, MYRIAD_WIDTH_SHIFT: shift };
        this.pool = new GeometryPool(gl, width);
        this.instances = new InstanceTable(gl, width);
        this.list = new EntryList(gl, width);
        this.shadowList = new EntryList(gl, width);
        this.cull = new ClusterCullPass(gl, triangle, width, this.defines);
        this.raster = new ClusterRasterPass(gl, this.defines);
        this.pyramid = new DepthPyramid(gl, triangle);
        this.pyramidView = new DepthPyramidView(gl, triangle);
        this.visibility = new VisibilityBuffer(gl);
        this.resolvePass = new MaterialResolvePass(gl, triangle, textures, this.defines);
        this.readback = new FlagReadback(gl);
        this.stats.occlusionSupported = this.pyramid.supported;
    }
    beginFrame(settings: MyriadSettings, activationTriangles: number): void {
        this.settings = settings;
        this.activationTriangles = activationTriangles;
        const { cache, pool, stats } = this;
        stats.activationTriangles = activationTriangles;
        cache.pump();
        for (const entry of cache.evicted)
            pool.release(entry);
        cache.evicted.length = 0;
        stats.drawCalls = 0;
        stats.shadowClusters = 0;
        stats.shadowTriangles = 0;
        if (!settings.freeze)
            this.frozen = false;
    }
    collect(input: MyriadCollectInput): void {
        const { settings, stats, list, instances, selector } = this;
        const { visible } = input;
        this.updateActivation(visible);
        if (!settings.enabled || !this.active) {
            for (const item of visible.meshes)
                item.virtual = false;
            list.begin();
            instances.begin();
            this.selectionDirty = false;
            this.resetSelectionStats();
            this.publishPoolStats();
            return;
        }
        if (settings.freeze && this.frozen) {
            for (const item of visible.meshes)
                item.virtual = this.isVirtual(item.mesh, item.entity.material);
            this.publishPoolStats();
            return;
        }
        const { camera, frustum } = input;
        list.begin();
        instances.begin();
        selector.resetStats();
        this.beginFrameStates();
        const { projector, request } = this;
        projector.perspective = true;
        vec3.copy(projector.cameraPosition, camera.position);
        projector.pixelScale = visible.pixelScale;
        projector.near = camera.near;
        request.frustum = frustum;
        request.threshold = settings.pixelError;
        let count = 0;
        let waiting = 0;
        for (const item of visible.meshes) {
            if (item.entity.skin) {
                item.virtual = false;
                continue;
            }
            const material = item.entity.material ?? DEFAULT_MATERIAL;
            const entry = this.candidate(item.mesh, material);
            if (!entry) {
                item.virtual = false;
                continue;
            }
            if (entry.state !== 'ready') {
                item.virtual = waitsForBuild(entry);
                if (item.virtual)
                    waiting++;
                continue;
            }
            if (!this.ensureResident(entry)) {
                item.virtual = false;
                continue;
            }
            item.virtual = true;
            const state = this.states.resolve(material);
            this.coverState(this.touchState(state), item.bounds, camera.viewProjectionMatrix);
            const instance = this.writeInstance(item, material, state, input.selection);
            request.world = item.entity.worldMatrix;
            request.scale = mat4.maxAxisScale(item.entity.worldMatrix);
            request.instance = instance;
            request.state = state.id;
            request.doubleSided = material.doubleSided;
            selector.select(entry, request, list);
            count++;
        }
        stats.instances = count;
        stats.waiting = waiting;
        stats.clusters = selector.stats.clusters;
        stats.triangles = selector.stats.triangles;
        stats.groupsVisited = selector.stats.groupsVisited;
        stats.frustumCulled = selector.stats.frustumCulled;
        stats.perLevel.set(selector.stats.perLevel);
        stats.materialStates = this.frameStates.length;
        this.selectionDirty = true;
        this.flagsValid = false;
        this.frozen = settings.freeze;
        this.publishPoolStats();
    }
    private updateActivation(visible: VisibleSet): void {
        const { stats, settings } = this;
        let classicTriangles = 0;
        for (const item of visible.meshes) {
            if (item.entity.skin)
                continue;
            const triangles = getTriangleCount(item.mesh);
            if (triangles < MIN_VIRTUAL_TRIANGLES)
                continue;
            const material = item.entity.material ?? DEFAULT_MATERIAL;
            if (material.alphaMode !== 'opaque')
                continue;
            classicTriangles += triangles;
        }
        stats.classicTriangles = classicTriangles;
        if (!settings.enabled) {
            this.active = false;
        }
        else if (this.active) {
            this.active = classicTriangles >= this.activationTriangles * ACTIVATION_HYSTERESIS;
        }
        else {
            this.active = classicTriangles >= this.activationTriangles;
        }
        stats.active = this.active;
    }
    isVirtual(mesh: MeshData, material: Material | null): boolean {
        const entry = this.candidate(mesh, material ?? DEFAULT_MATERIAL);
        if (!entry)
            return false;
        if (entry.state !== 'ready')
            return waitsForBuild(entry);
        return this.ensureResident(entry);
    }
    private candidate(mesh: MeshData, material: Material): MyriadMeshEntry | null {
        if (!this.settings.enabled || !this.active || material.alphaMode !== 'opaque')
            return null;
        return this.cache.resolve(mesh);
    }
    private ensureResident(entry: MyriadMeshEntry): boolean {
        if (entry.residency || this.pool.upload(entry))
            return true;
        entry.state = 'failed';
        entry.error = 'Pool de geometria cheio.';
        return false;
    }
    private writeInstance(item: VisibleMesh, material: Material, state: MaterialState, selection: ReadonlySet<number> | null): number {
        const { instances } = this;
        const { entity } = item;
        const index = instances.count;
        const offset = instances.allocate();
        const data = instances.data;
        const world = entity.worldMatrix;
        data.set(world, offset + INSTANCE_WORLD_OFFSET);
        let previous = this.previousWorld.get(entity);
        if (!previous) {
            previous = new Float32Array(16);
            previous.set(world);
            this.previousWorld.set(entity, previous);
        }
        data.set(previous, offset + INSTANCE_PREVIOUS_WORLD_OFFSET);
        previous.set(world);
        const normal = mat4.normalMatrix(this.normalMatrix, world) ? this.normalMatrix : mat3.identity(this.normalMatrix);
        const n = offset + INSTANCE_NORMAL_MATRIX_OFFSET;
        for (let column = 0; column < 3; column++) {
            data[n + column * 4] = normal[column * 3];
            data[n + column * 4 + 1] = normal[column * 3 + 1];
            data[n + column * 4 + 2] = normal[column * 3 + 2];
            data[n + column * 4 + 3] = 0;
        }
        const c = offset + INSTANCE_BASE_COLOR_OFFSET;
        data[c] = material.baseColor[0];
        data[c + 1] = material.baseColor[1];
        data[c + 2] = material.baseColor[2];
        data[c + 3] = material.opacity;
        const s = offset + INSTANCE_SURFACE_OFFSET;
        data[s] = material.roughness;
        data[s + 1] = material.metallic;
        data[s + 2] = material.emissiveIntensity;
        data[s + 3] = entity.receiveShadows ? 1 : 0;
        const e = offset + INSTANCE_EMISSIVE_OFFSET;
        data[e] = material.emissive[0];
        data[e + 1] = material.emissive[1];
        data[e + 2] = material.emissive[2];
        data[e + 3] = material.alphaCutoff;
        const m = offset + INSTANCE_MAP_PARAMS_OFFSET;
        data[m] = material.normalScale;
        data[m + 1] = material.occlusionStrength;
        data[m + 2] = selection !== null && selection.has(entity.id) ? 1 : 0;
        data[m + 3] = state.id;
        data[offset + INSTANCE_UV_OFFSET] = material.uvTiling;
        return index;
    }
    private beginFrameStates(): void {
        this.frameStates.length = 0;
        this.stateStamp++;
    }
    private touchState(state: MaterialState): number {
        if (state.id >= this.stateStamps.length) {
            const size = Math.max(state.id + 1, this.stateStamps.length * 2);
            const stamps = new Uint32Array(size);
            stamps.set(this.stateStamps);
            this.stateStamps = stamps;
            const slots = new Int32Array(size);
            slots.set(this.stateSlots);
            this.stateSlots = slots;
        }
        if (this.stateStamps[state.id] === this.stateStamp)
            return this.stateSlots[state.id];
        const slot = this.frameStates.length;
        this.stateStamps[state.id] = this.stateStamp;
        this.stateSlots[state.id] = slot;
        this.frameStates.push(state);
        if ((slot + 1) * 4 > this.frameRects.length) {
            const rects = new Float32Array(this.frameRects.length * 2);
            rects.set(this.frameRects);
            this.frameRects = rects;
        }
        this.frameRects.fill(Infinity, slot * 4, slot * 4 + 2);
        this.frameRects.fill(-Infinity, slot * 4 + 2, slot * 4 + 4);
        return slot;
    }
    private coverState(slot: number, bounds: RenderableBounds, viewProjection: Float32Array): void {
        const rects = this.frameRects;
        const offset = slot * 4;
        if (!projectAabbToNdcRect(bounds.aabb, viewProjection, this.boundsRect)) {
            rects[offset] = -1;
            rects[offset + 1] = -1;
            rects[offset + 2] = 1;
            rects[offset + 3] = 1;
            return;
        }
        rects[offset] = Math.min(rects[offset], this.boundsRect[0]);
        rects[offset + 1] = Math.min(rects[offset + 1], this.boundsRect[1]);
        rects[offset + 2] = Math.max(rects[offset + 2], this.boundsRect[2]);
        rects[offset + 3] = Math.max(rects[offset + 3], this.boundsRect[3]);
    }
    private resetSelectionStats(): void {
        const { stats } = this;
        stats.instances = 0;
        stats.waiting = 0;
        stats.clusters = 0;
        stats.triangles = 0;
        stats.groupsVisited = 0;
        stats.frustumCulled = 0;
        stats.perLevel.fill(0);
        stats.materialStates = 0;
        stats.occlusionActive = false;
    }
    private publishPoolStats(): void {
        const { stats, pool, cache } = this;
        stats.poolVertices = pool.stats.vertices;
        stats.poolClusters = pool.stats.clusters;
        stats.poolBytes = pool.stats.bytes;
        stats.poolMeshes = pool.stats.meshes;
        stats.buildPending = cache.stats.pending;
        stats.buildReady = cache.stats.ready;
        stats.buildFailed = cache.stats.failed;
        stats.building = cache.stats.building;
    }
    renderVisibility(camera: PerspectiveCamera, sceneDepth: WebGLTexture, width: number, height: number): void {
        const { settings, stats, list, instances, pool, visibility, pyramid, cull, raster, readback } = this;
        stats.width = width;
        stats.height = height;
        const resized = visibility.sync(sceneDepth, width, height);
        if (resized)
            pyramid.invalidate();
        readback.poll();
        this.publishOcclusionStats();
        if (this.selectionDirty) {
            instances.upload();
            list.upload(true);
            this.selectionDirty = false;
        }
        if (list.count === 0) {
            stats.occlusionActive = false;
            return;
        }
        visibility.bindAndClearIds();
        const viewProjection = camera.viewProjectionMatrix;
        if (settings.freeze && this.frozen) {
            if (this.flagsValid) {
                stats.drawCalls += raster.draw({ list, pool, viewProjection, cullFlags: cull.flags[0].texture, passBits: 0 }, false);
                stats.drawCalls += raster.draw({ list, pool, viewProjection, cullFlags: cull.flags[1].texture, passBits: POST_PASS_BIT }, false);
            }
            else {
                stats.drawCalls += raster.draw({ list, pool, viewProjection, cullFlags: null, passBits: 0 }, false);
            }
            return;
        }
        const occlusion = settings.occlusionCulling && pyramid.supported && pyramid.valid && !resized;
        stats.occlusionActive = occlusion;
        if (occlusion) {
            cull.run({ list, instances, pool, pyramid, viewProjection: this.previousViewProjection, useHistory: true, postPass: false }, 0);
            stats.drawCalls++;
            visibility.bind();
            stats.drawCalls += raster.draw({ list, pool, viewProjection, cullFlags: cull.flags[0].texture, passBits: 0 }, false);
            stats.drawCalls += pyramid.build(sceneDepth, width, height);
            cull.run({ list, instances, pool, pyramid, viewProjection, useHistory: false, postPass: true }, 1);
            stats.drawCalls++;
            visibility.bind();
            stats.drawCalls += raster.draw({ list, pool, viewProjection, cullFlags: cull.flags[1].texture, passBits: POST_PASS_BIT }, false);
            readback.request(cull.flags, list.count);
            this.flagsValid = true;
        }
        else {
            stats.drawCalls += raster.draw({ list, pool, viewProjection, cullFlags: null, passBits: 0 }, false);
            if (pyramid.supported) {
                stats.drawCalls += pyramid.build(sceneDepth, width, height);
                visibility.bind();
            }
            this.flagsValid = false;
        }
        mat4.copy(this.previousViewProjection, viewProjection);
    }
    private publishOcclusionStats(): void {
        const { stats, readback } = this;
        if (!readback.valid)
            return;
        stats.occlusionMainVisible = readback.mainVisible;
        stats.occlusionPostVisible = readback.postVisible;
        stats.occlusionEntries = readback.entries;
    }
    resolve(lighting: SceneLightingInput): number {
        const { settings, list } = this;
        if (!settings.enabled || list.count === 0)
            return 0;
        const drawCalls = this.resolvePass.run({
            lighting,
            states: this.frameStates,
            rects: settings.freeze && this.frozen ? null : this.frameRects,
            visibility: this.visibility,
            list,
            instances: this.instances,
            pool: this.pool,
            debugView: debugViewIndex(settings.debugView),
            wireframe: settings.wireframe,
        });
        this.stats.drawCalls += drawCalls;
        return drawCalls;
    }
    renderDebugOverlay(camera: PerspectiveCamera, width: number, height: number): number {
        const { settings } = this;
        if (!settings.enabled || settings.debugView !== 'hzb')
            return 0;
        const drawCalls = this.pyramidView.draw(this.pyramid, settings.hzbLevel, width, height, camera.near, camera.far);
        this.stats.drawCalls += drawCalls;
        return drawCalls;
    }
    claimsCaster(candidate: ShadowCasterCandidate): boolean {
        if (candidate.entity.skin)
            return false;
        const entry = this.candidate(candidate.mesh, candidate.entity.material ?? DEFAULT_MATERIAL);
        if (!entry)
            return false;
        if (entry.state !== 'ready')
            return waitsForBuild(entry);
        return this.settings.shadowClusters && this.ensureResident(entry);
    }
    renderShadowCascade(lightViewProjection: Float32Array, texelWorldSize: number, casters: readonly ShadowCasterCandidate[]): number {
        const { settings, stats, shadowList, shadowSelector, projector, request } = this;
        if (casters.length === 0)
            return 0;
        shadowList.begin();
        shadowSelector.resetStats();
        this.shadowFrustum.setFromViewProjection(lightViewProjection);
        projector.perspective = false;
        projector.texelSize = texelWorldSize;
        request.frustum = this.shadowFrustum;
        request.threshold = settings.pixelError;
        request.instance = 0;
        request.state = 0;
        for (const caster of casters) {
            const material = caster.entity.material ?? DEFAULT_MATERIAL;
            const entry = this.candidate(caster.mesh, material);
            if (!entry || entry.state !== 'ready' || !this.ensureResident(entry))
                continue;
            request.world = caster.entity.worldMatrix;
            request.scale = mat4.maxAxisScale(caster.entity.worldMatrix);
            request.doubleSided = material.doubleSided;
            shadowSelector.select(entry, request, shadowList);
        }
        shadowList.upload(false);
        stats.shadowClusters += shadowSelector.stats.clusters;
        stats.shadowTriangles += shadowSelector.stats.triangles;
        const drawCalls = this.raster.draw({ list: shadowList, pool: this.pool, viewProjection: lightViewProjection, cullFlags: null, passBits: 0 }, true);
        stats.drawCalls += drawCalls;
        return drawCalls;
    }
    dispose(): void {
        this.cache.dispose();
        this.readback.dispose();
        this.resolvePass.dispose();
        this.visibility.dispose();
        this.pyramidView.dispose();
        this.pyramid.dispose();
        this.raster.dispose();
        this.cull.dispose();
        this.shadowList.dispose();
        this.list.dispose();
        this.instances.dispose();
        this.pool.dispose();
    }
}
