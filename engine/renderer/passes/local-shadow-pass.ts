import * as mat4 from '@/engine/core/math/mat4';
import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { Aabb } from '@/engine/core/math/aabb';
import type { GL } from '@/engine/renderer/gl/context';
import { ShaderProgram } from '@/engine/renderer/gl/shader-program';
import { withDefines } from '@/engine/renderer/gl/shader-source';
import { DepthArrayRenderTarget } from '@/engine/renderer/gl/depth-array-render-target';
import type { GpuMeshCache } from '@/engine/renderer/gl/gpu-mesh-cache';
import { JOINT_MATRICES_TEXTURE_UNIT, type GpuSkinCache } from '@/engine/renderer/gl/gpu-skin-cache';
import { InstanceBuffer } from '@/engine/renderer/gl/instance-buffer';
import { SHADOW_DEPTH_VERTEX_SHADER, SHADOW_DEPTH_FRAGMENT_SHADER } from '@/engine/renderer/shaders/shadow-depth.glsl';
import { Frustum } from '@/engine/renderer/culling/frustum';
import type { ShadowCasterCandidate } from '@/engine/renderer/culling/visible-set';
import type { MeshData } from '@/engine/renderer/geometry/mesh-data';
import type { RenderProfile } from '@/engine/renderer/quality/render-profile';
import { LOCAL_LIGHT_SHADOW_TEXTURE_UNIT } from '@/engine/renderer/lighting/scene-lighting-uniforms';
import { MAX_SHADOW_SLOTS } from '@/engine/renderer/lighting/local-light-layout';
import type { CollectedLocalLight, LocalLightSet } from '@/engine/renderer/lighting/local-light-set';
import { ShadowCasterMotion } from '@/engine/renderer/shadows/shadow-caster-set';
import { SHADOW_INSTANCE_LAYOUT, type ShadowGeometryHook, type ShadowMeshResolver } from './shadow-pass';
export interface LocalShadowBinding {
    texture: WebGLTexture;
    size: number;
}
export type LocalShadowState = 'rendered' | 'cached' | 'deferred';
export interface LocalShadowStats {
    facesBudget: number;
    facesPerFrame: number;
    facesUsed: number;
    facesRendered: number;
    facesPostponed: number;
    lightsShadowed: number;
    lightsDeferred: number;
    drawCalls: number;
    triangles: number;
    readonly status: Map<number, LocalShadowState>;
}
export interface LocalShadowPassInput {
    lights: LocalLightSet;
    casters: readonly ShadowCasterCandidate[];
    resolveMesh: ShadowMeshResolver;
    virtualGeometry: ShadowGeometryHook | null;
}
interface FaceState {
    drawn: boolean;
    staticSignature: number;
    dynamicSignature: number;
    finalHasDynamics: boolean;
    staticLayer: number;
    staticFrame: number;
    readonly dynamicRect: Int32Array;
    dynamicRectValid: boolean;
    frame: number;
    readonly slot: Float32Array;
}
interface CacheEntry {
    base: number;
    faces: number;
    frame: number;
    readonly states: FaceState[];
}
interface FaceJob {
    light: CollectedLocalLight;
    entry: CacheEntry;
    face: number;
    kind: 'static' | 'dynamic';
    staticSignature: number;
    dynamicSignature: number;
    hasDynamics: boolean;
    mandatory: boolean;
    priority: number;
}
interface FaceBatch {
    mesh: MeshData;
    firstInstance: number;
    readonly items: ShadowCasterCandidate[];
}
const MATRIX_FLOATS = 16;
const SLOT_FLOATS = 20;
const CUBE_FACE_FOV = (91 * Math.PI) / 180;
const SPOT_FOV_MARGIN = (4 * Math.PI) / 180;
const MAX_SPOT_FOV = (164 * Math.PI) / 180;
const CACHE_TTL_FRAMES = 120;
const SHADOW_LOD_CASCADE = 1;
const STATIC_CACHE_LAYERS = 12;
const DYNAMIC_MARGIN_TEXELS = 6;
const FULL_COPY_AREA_FRACTION = 0.5;
const BIAS_MATRIX = new Float32Array([0.5, 0, 0, 0, 0, 0.5, 0, 0, 0, 0, 0.5, 0, 0.5, 0.5, 0.5, 1]);
const view = mat4.create();
const projection = mat4.create();
const viewProjection = mat4.create();
const shadowMatrix = mat4.create();
const target = vec3.create();
const direction = vec3.create();
const upAxis = vec3.create();
const toCaster = vec3.create();
const hashBuffer = new Float32Array(1);
const hashBits = new Uint32Array(hashBuffer.buffer);
function hashFloat(hash: number, value: number): number {
    hashBuffer[0] = value;
    return Math.imul(hash ^ hashBits[0], 16777619) | 0;
}
function compareJobs(a: FaceJob, b: FaceJob): number {
    if (a.mandatory !== b.mandatory)
        return a.mandatory ? -1 : 1;
    return b.priority - a.priority;
}
function faceBasis(light: CollectedLocalLight, face: number, outDirection: Vec3, outUp: Vec3): void {
    switch (face) {
        case 0:
            vec3.copy(outDirection, light.right);
            vec3.copy(outUp, light.up);
            break;
        case 1:
            vec3.scale(outDirection, light.right, -1);
            vec3.copy(outUp, light.up);
            break;
        case 2:
            vec3.copy(outDirection, light.up);
            vec3.copy(outUp, light.forward);
            break;
        case 3:
            vec3.scale(outDirection, light.up, -1);
            vec3.copy(outUp, light.forward);
            break;
        case 4:
            vec3.copy(outDirection, light.forward);
            vec3.copy(outUp, light.up);
            break;
        default:
            vec3.scale(outDirection, light.forward, -1);
            vec3.copy(outUp, light.up);
    }
}
export class LocalShadowPass {
    readonly binding: LocalShadowBinding;
    readonly stats: LocalShadowStats = {
        facesBudget: 0,
        facesPerFrame: 0,
        facesUsed: 0,
        facesRendered: 0,
        facesPostponed: 0,
        lightsShadowed: 0,
        lightsDeferred: 0,
        drawCalls: 0,
        triangles: 0,
        status: new Map(),
    };
    private readonly program: ShaderProgram;
    private readonly skinnedProgram: ShaderProgram;
    private readonly placeholder: DepthArrayRenderTarget;
    private atlas: DepthArrayRenderTarget | null = null;
    private staticAtlas: DepthArrayRenderTarget | null = null;
    private readonly staticOwners: (FaceState | null)[] = [];
    private readonly instances: InstanceBuffer;
    private readonly faceFrustum = new Frustum();
    private readonly motion = new ShadowCasterMotion();
    private readonly layers: number;
    private readonly staticLayers: number;
    private readonly size: number;
    private readonly profileFacesPerFrame: number;
    private facesPerFrame: number;
    private readonly owners: Int32Array;
    private readonly cache = new Map<number, CacheEntry>();
    private readonly inRangeStatic: ShadowCasterCandidate[] = [];
    private readonly inRangeDynamic: ShadowCasterCandidate[] = [];
    private readonly faceStatic: ShadowCasterCandidate[] = [];
    private readonly faceDynamic: ShadowCasterCandidate[] = [];
    private readonly jobs: FaceJob[] = [];
    private readonly jobPool: FaceJob[] = [];
    private readonly batches: FaceBatch[] = [];
    private readonly skinned: ShadowCasterCandidate[] = [];
    private readonly virtual: ShadowCasterCandidate[] = [];
    private readonly byMesh = new Map<MeshData, FaceBatch>();
    private readonly batchPool: FaceBatch[] = [];
    private readonly rectScratch = new Int32Array(4);
    private readonly unionScratch = new Int32Array(4);
    private readonly rectAccumulator = new Float64Array(4);
    private near = 0;
    private far = 0;
    private fov = 0;
    private texelScale = 0;
    private frame = 0;
    constructor(private readonly gl: GL, private readonly meshes: GpuMeshCache, private readonly skins: GpuSkinCache, profile: RenderProfile) {
        this.program = new ShaderProgram(gl, SHADOW_DEPTH_VERTEX_SHADER, SHADOW_DEPTH_FRAGMENT_SHADER);
        this.skinnedProgram = new ShaderProgram(gl, withDefines(SHADOW_DEPTH_VERTEX_SHADER, { SKINNED: true }), SHADOW_DEPTH_FRAGMENT_SHADER);
        this.instances = new InstanceBuffer(gl, SHADOW_INSTANCE_LAYOUT);
        this.placeholder = new DepthArrayRenderTarget(gl, 1, 1);
        this.layers = Math.min(profile.localShadowFaces, MAX_SHADOW_SLOTS);
        this.staticLayers = Math.min(this.layers, STATIC_CACHE_LAYERS);
        this.size = profile.localShadowMapSize;
        this.profileFacesPerFrame = Math.max(1, profile.localShadowFacesPerFrame);
        this.facesPerFrame = this.profileFacesPerFrame;
        this.owners = new Int32Array(this.layers).fill(-1);
        this.binding = { texture: this.placeholder.texture, size: 1 };
        this.stats.facesBudget = this.layers;
        this.stats.facesPerFrame = this.facesPerFrame;
    }
    setFacesPerFrameScale(scale: number): void {
        const faces = Math.max(1, Math.round(this.profileFacesPerFrame * scale));
        if (faces === this.facesPerFrame)
            return;
        this.facesPerFrame = faces;
        this.stats.facesPerFrame = faces;
    }
    maxShadowedLights = Number.POSITIVE_INFINITY;
    render(input: LocalShadowPassInput): void {
        const { gl, stats, owners, jobs } = this;
        this.frame++;
        this.resetStats();
        jobs.length = 0;
        const wanting = input.lights.lights.filter((light) => light.shadowFaces > 0);
        if (wanting.length === 0) {
            this.expireCache();
            return;
        }
        wanting.sort((a, b) => this.allocationScore(b) - this.allocationScore(a));
        owners.fill(-1);
        const shadowedLimit = Math.max(0, Math.floor(this.maxShadowedLights));
        for (let index = 0; index < wanting.length; index++) {
            const light = wanting[index];
            const id = light.entity.id;
            if (index >= shadowedLimit) {
                light.shadowSlot = -1;
                stats.lightsDeferred++;
                stats.status.set(id, 'deferred');
                continue;
            }
            let entry = this.cache.get(id);
            let base = entry && entry.faces === light.shadowFaces && this.layersFree(entry.base, entry.faces, id) ? entry.base : -1;
            if (base < 0)
                base = this.findFreeRun(light.shadowFaces);
            if (base < 0) {
                light.shadowSlot = -1;
                stats.lightsDeferred++;
                stats.status.set(id, 'deferred');
                continue;
            }
            for (let i = 0; i < light.shadowFaces; i++)
                owners[base + i] = id;
            light.shadowSlot = base;
            stats.lightsShadowed++;
            stats.facesUsed += light.shadowFaces;
            if (!entry || entry.base !== base || entry.faces !== light.shadowFaces) {
                if (entry)
                    this.releaseEntry(entry);
                entry = this.createEntry(base, light.shadowFaces);
                this.cache.set(id, entry);
            }
            entry.frame = this.frame;
            this.planFaces(light, entry, input.casters);
        }
        if (jobs.length > 0) {
            jobs.sort(compareJobs);
            const atlas = this.ensureAtlas();
            gl.activeTexture(gl.TEXTURE0 + LOCAL_LIGHT_SHADOW_TEXTURE_UNIT);
            gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
            gl.disable(gl.CULL_FACE);
            gl.enable(gl.POLYGON_OFFSET_FILL);
            let executed = 0;
            let current: CollectedLocalLight | null = null;
            for (const job of jobs) {
                if (!job.mandatory && executed >= this.facesPerFrame) {
                    stats.facesPostponed++;
                    continue;
                }
                if (job.light !== current) {
                    current = job.light;
                    this.collectInRange(current, input.casters);
                    this.lightParams(current);
                }
                this.executeJob(job, atlas, input);
                executed++;
                stats.facesRendered++;
            }
            gl.disable(gl.POLYGON_OFFSET_FILL);
            gl.polygonOffset(0, 0);
            gl.enable(gl.CULL_FACE);
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        }
        for (const light of wanting) {
            if (light.shadowSlot < 0)
                continue;
            const entry = this.cache.get(light.entity.id);
            if (!entry)
                continue;
            let rendered = false;
            for (let face = 0; face < entry.faces; face++) {
                const state = entry.states[face];
                input.lights.shadowSlotFloats(entry.base + face).set(state.slot);
                if (state.frame === this.frame)
                    rendered = true;
            }
            stats.status.set(light.entity.id, rendered ? 'rendered' : 'cached');
        }
        this.expireCache();
    }
    skip(lights: LocalLightSet): void {
        this.resetStats();
        for (const light of lights.lights)
            light.shadowSlot = -1;
    }
    private allocationScore(light: CollectedLocalLight): number {
        return this.cache.has(light.entity.id) ? light.importance * 1.5 : light.importance;
    }
    private layersFree(base: number, faces: number, id: number): boolean {
        for (let i = 0; i < faces; i++) {
            const owner = this.owners[base + i];
            if (owner !== -1 && owner !== id)
                return false;
        }
        return true;
    }
    private findFreeRun(faces: number): number {
        const { owners, layers } = this;
        let run = 0;
        for (let i = 0; i < layers; i++) {
            run = owners[i] === -1 ? run + 1 : 0;
            if (run === faces)
                return i - faces + 1;
        }
        return -1;
    }
    private ensureAtlas(): DepthArrayRenderTarget {
        if (!this.atlas) {
            this.atlas = new DepthArrayRenderTarget(this.gl, this.size, this.layers);
            this.binding.texture = this.atlas.texture;
            this.binding.size = this.size;
        }
        return this.atlas;
    }
    private ensureStaticAtlas(): DepthArrayRenderTarget {
        if (!this.staticAtlas) {
            this.staticAtlas = new DepthArrayRenderTarget(this.gl, this.size, this.staticLayers);
            this.staticOwners.length = this.staticLayers;
            this.staticOwners.fill(null);
        }
        return this.staticAtlas;
    }
    private createEntry(base: number, faces: number): CacheEntry {
        const states: FaceState[] = [];
        for (let face = 0; face < faces; face++) {
            states.push({
                drawn: false,
                staticSignature: 0,
                dynamicSignature: 0,
                finalHasDynamics: false,
                staticLayer: -1,
                staticFrame: 0,
                dynamicRect: new Int32Array(4),
                dynamicRectValid: false,
                frame: 0,
                slot: new Float32Array(SLOT_FLOATS),
            });
        }
        return { base, faces, frame: this.frame, states };
    }
    private releaseEntry(entry: CacheEntry): void {
        for (const state of entry.states)
            this.releaseStaticLayer(state);
    }
    private releaseStaticLayer(state: FaceState): void {
        if (state.staticLayer < 0)
            return;
        this.staticOwners[state.staticLayer] = null;
        state.staticLayer = -1;
    }
    private acquireStaticLayer(state: FaceState): boolean {
        const pool = this.ensureStaticAtlas();
        const owners = this.staticOwners;
        let chosen = -1;
        let oldest = this.frame;
        for (let i = 0; i < pool.layers; i++) {
            const owner = owners[i];
            if (!owner) {
                chosen = i;
                break;
            }
            if (owner.staticFrame < oldest) {
                oldest = owner.staticFrame;
                chosen = i;
            }
        }
        if (chosen < 0)
            return false;
        const evicted = owners[chosen];
        if (evicted)
            evicted.staticLayer = -1;
        owners[chosen] = state;
        state.staticLayer = chosen;
        state.staticFrame = this.frame;
        return true;
    }
    private collectInRange(light: CollectedLocalLight, casters: readonly ShadowCasterCandidate[]): void {
        const { inRangeStatic, inRangeDynamic } = this;
        inRangeStatic.length = 0;
        inRangeDynamic.length = 0;
        const center = light.boundsCenter;
        const reach = light.boundsRadius;
        for (const caster of casters) {
            vec3.subtract(toCaster, caster.bounds.center, center);
            const limit = reach + caster.bounds.radius;
            if (vec3.dot(toCaster, toCaster) > limit * limit)
                continue;
            if (this.motion.isDynamic(caster, this.frame))
                inRangeDynamic.push(caster);
            else
                inRangeStatic.push(caster);
        }
    }
    private lightParams(light: CollectedLocalLight): void {
        this.near = Math.min(Math.max(light.range * 0.01, 0.02), 0.5);
        this.far = light.boundsRadius * 2 + 1;
        this.fov = light.faceMode === 0 ? Math.min(light.outerAngle * 2 + SPOT_FOV_MARGIN, MAX_SPOT_FOV) : CUBE_FACE_FOV;
        this.texelScale = (2 * Math.tan(this.fov / 2)) / this.size;
    }
    private lightHash(light: CollectedLocalLight): number {
        let hash = 0x811c9dc5 | 0;
        for (let i = 0; i < 3; i++) {
            hash = hashFloat(hash, light.position[i]);
            hash = hashFloat(hash, light.right[i]);
            hash = hashFloat(hash, light.forward[i]);
        }
        hash = hashFloat(hash, light.range);
        hash = hashFloat(hash, light.outerAngle);
        hash = hashFloat(hash, light.shadowFaces);
        hash = hashFloat(hash, light.light.shadow.bias);
        return hash;
    }
    private faceViewProjection(light: CollectedLocalLight, face: number): void {
        if (light.faceMode === 0) {
            vec3.copy(direction, light.forward);
            vec3.copy(upAxis, light.up);
        }
        else {
            faceBasis(light, face, direction, upAxis);
        }
        vec3.add(target, light.position, direction);
        mat4.lookAt(view, light.position, target, upAxis);
        mat4.perspective(projection, this.fov, 1, this.near, this.far);
        mat4.multiply(viewProjection, projection, view);
        mat4.multiply(shadowMatrix, BIAS_MATRIX, viewProjection);
    }
    private planFaces(light: CollectedLocalLight, entry: CacheEntry, casters: readonly ShadowCasterCandidate[]): void {
        const { faceFrustum, inRangeStatic, inRangeDynamic } = this;
        this.collectInRange(light, casters);
        this.lightParams(light);
        const lightHash = this.lightHash(light);
        for (let face = 0; face < entry.faces; face++) {
            const state = entry.states[face];
            this.faceViewProjection(light, face);
            faceFrustum.setFromViewProjection(viewProjection);
            let staticSignature = lightHash;
            for (const caster of inRangeStatic) {
                if (!faceFrustum.intersectsSphere(caster.bounds.center, caster.bounds.radius))
                    continue;
                staticSignature = hashFloat(staticSignature, caster.entity.id);
                staticSignature = hashFloat(staticSignature, caster.bounds.version);
            }
            let dynamicSignature = 0;
            let hasDynamics = false;
            for (const caster of inRangeDynamic) {
                if (!faceFrustum.intersectsSphere(caster.bounds.center, caster.bounds.radius))
                    continue;
                if (!hasDynamics) {
                    hasDynamics = true;
                    dynamicSignature = 0x811c9dc5 | 0;
                }
                dynamicSignature = hashFloat(dynamicSignature, caster.entity.id);
                dynamicSignature = hashFloat(dynamicSignature, caster.bounds.version);
                dynamicSignature = hashFloat(dynamicSignature, caster.entity.skin?.version ?? 0);
            }
            const needsStatic = !state.drawn || state.staticSignature !== staticSignature;
            const needsDynamic = hasDynamics !== state.finalHasDynamics || (hasDynamics && dynamicSignature !== state.dynamicSignature);
            if (!needsStatic && !needsDynamic)
                continue;
            const job = this.acquireJob();
            job.light = light;
            job.entry = entry;
            job.face = face;
            job.kind = needsStatic ? 'static' : 'dynamic';
            job.staticSignature = staticSignature;
            job.dynamicSignature = dynamicSignature;
            job.hasDynamics = hasDynamics;
            job.mandatory = !state.drawn;
            job.priority = light.importance * (1 + (this.frame - state.frame));
            this.jobs.push(job);
        }
    }
    private acquireJob(): FaceJob {
        const index = this.jobs.length;
        let job = this.jobPool[index];
        if (!job) {
            job = {
                light: null as unknown as CollectedLocalLight,
                entry: null as unknown as CacheEntry,
                face: 0,
                kind: 'static',
                staticSignature: 0,
                dynamicSignature: 0,
                hasDynamics: false,
                mandatory: false,
                priority: 0,
            };
            this.jobPool[index] = job;
        }
        return job;
    }
    private executeJob(job: FaceJob, atlas: DepthArrayRenderTarget, input: LocalShadowPassInput): void {
        const { gl } = this;
        const { light, entry, face } = job;
        const state = entry.states[face];
        const layer = entry.base + face;
        const bias = Math.min(Math.max(light.light.shadow.bias, 0), 1);
        const texelWorldSize = this.texelScale * light.range * 0.5;
        const rect = this.rectScratch;
        this.faceViewProjection(light, face);
        this.faceFrustum.setFromViewProjection(viewProjection);
        this.cullFace();
        gl.polygonOffset(1 + bias * 3, 2 + bias * 8);
        let redraw = job.kind === 'static';
        if (!redraw && state.staticLayer < 0) {
            if (state.finalHasDynamics || !this.acquireStaticLayer(state))
                redraw = true;
            else
                this.captureStatic(atlas, layer, state);
        }
        if (redraw) {
            atlas.bindLayer(layer);
            gl.clear(gl.DEPTH_BUFFER_BIT);
            this.renderCasters(this.faceStatic, texelWorldSize, input);
            if (job.hasDynamics) {
                if (state.staticLayer >= 0 || this.acquireStaticLayer(state))
                    this.captureStatic(atlas, layer, state);
                this.renderCasters(this.faceDynamic, texelWorldSize, input);
                state.dynamicRectValid = this.dynamicRect(rect) > 0;
                if (state.dynamicRectValid)
                    state.dynamicRect.set(rect);
            }
            else {
                this.releaseStaticLayer(state);
                state.dynamicRectValid = false;
            }
        }
        else {
            const current = job.hasDynamics ? this.dynamicRect(rect) : 0;
            const previousUnbounded = state.finalHasDynamics && !state.dynamicRectValid;
            this.restoreStatic(atlas, layer, state, current > 0 ? rect : null, current < 0 || previousUnbounded);
            if (job.hasDynamics)
                this.renderCasters(this.faceDynamic, texelWorldSize, input);
            state.dynamicRectValid = current > 0;
            if (state.dynamicRectValid)
                state.dynamicRect.set(rect);
        }
        state.drawn = true;
        state.staticSignature = job.staticSignature;
        state.dynamicSignature = job.dynamicSignature;
        state.finalHasDynamics = job.hasDynamics;
        state.frame = this.frame;
        state.slot.set(shadowMatrix, 0);
        state.slot[16] = layer;
        state.slot[17] = this.texelScale;
        state.slot[18] = this.near;
        state.slot[19] = this.far;
    }
    private cullFace(): void {
        const { faceFrustum, faceStatic, faceDynamic } = this;
        faceStatic.length = 0;
        faceDynamic.length = 0;
        for (const caster of this.inRangeStatic) {
            if (faceFrustum.intersectsSphere(caster.bounds.center, caster.bounds.radius))
                faceStatic.push(caster);
        }
        for (const caster of this.inRangeDynamic) {
            if (faceFrustum.intersectsSphere(caster.bounds.center, caster.bounds.radius))
                faceDynamic.push(caster);
        }
    }
    private captureStatic(atlas: DepthArrayRenderTarget, layer: number, state: FaceState): void {
        const pool = this.ensureStaticAtlas();
        pool.copyLayerFrom(atlas, layer, state.staticLayer);
        state.staticFrame = this.frame;
        atlas.bindLayer(layer);
    }
    private restoreStatic(atlas: DepthArrayRenderTarget, layer: number, state: FaceState, current: Int32Array | null, full: boolean): void {
        const pool = this.ensureStaticAtlas();
        state.staticFrame = this.frame;
        if (full) {
            atlas.copyLayerFrom(pool, state.staticLayer, layer);
            return;
        }
        const union = this.unionScratch;
        let valid = false;
        if (current) {
            union.set(current);
            valid = true;
        }
        if (state.dynamicRectValid) {
            const previous = state.dynamicRect;
            if (valid) {
                union[0] = Math.min(union[0], previous[0]);
                union[1] = Math.min(union[1], previous[1]);
                union[2] = Math.max(union[2], previous[2]);
                union[3] = Math.max(union[3], previous[3]);
            }
            else {
                union.set(previous);
                valid = true;
            }
        }
        if (!valid) {
            atlas.bindLayer(layer);
            return;
        }
        const width = union[2] - union[0];
        const height = union[3] - union[1];
        const { size } = this;
        if (width * height >= size * size * FULL_COPY_AREA_FRACTION)
            atlas.copyLayerFrom(pool, state.staticLayer, layer);
        else
            atlas.copyLayerRegionFrom(pool, state.staticLayer, layer, union[0], union[1], width, height);
    }
    private dynamicRect(out: Int32Array): number {
        const acc = this.rectAccumulator;
        acc[0] = Infinity;
        acc[1] = Infinity;
        acc[2] = -Infinity;
        acc[3] = -Infinity;
        for (const candidate of this.faceDynamic) {
            if (!this.accumulateBox(candidate.bounds.aabb))
                return -1;
        }
        if (acc[0] === Infinity)
            return 0;
        const { size } = this;
        out[0] = Math.max(0, Math.floor(acc[0] - DYNAMIC_MARGIN_TEXELS));
        out[1] = Math.max(0, Math.floor(acc[1] - DYNAMIC_MARGIN_TEXELS));
        out[2] = Math.min(size, Math.ceil(acc[2] + DYNAMIC_MARGIN_TEXELS));
        out[3] = Math.min(size, Math.ceil(acc[3] + DYNAMIC_MARGIN_TEXELS));
        return out[2] > out[0] && out[3] > out[1] ? 1 : 0;
    }
    private accumulateBox(box: Aabb): boolean {
        const vp = viewProjection;
        const acc = this.rectAccumulator;
        const { size, near } = this;
        for (let i = 0; i < 8; i++) {
            const x = i & 1 ? box.max[0] : box.min[0];
            const y = i & 2 ? box.max[1] : box.min[1];
            const z = i & 4 ? box.max[2] : box.min[2];
            const w = vp[3] * x + vp[7] * y + vp[11] * z + vp[15];
            if (w <= near)
                return false;
            const px = (((vp[0] * x + vp[4] * y + vp[8] * z + vp[12]) / w) * 0.5 + 0.5) * size;
            const py = (((vp[1] * x + vp[5] * y + vp[9] * z + vp[13]) / w) * 0.5 + 0.5) * size;
            if (px < acc[0])
                acc[0] = px;
            if (py < acc[1])
                acc[1] = py;
            if (px > acc[2])
                acc[2] = px;
            if (py > acc[3])
                acc[3] = py;
        }
        return true;
    }
    private renderCasters(list: readonly ShadowCasterCandidate[], texelWorldSize: number, input: LocalShadowPassInput): void {
        if (list.length === 0)
            return;
        const { gl, program, instances, batches, skinned, virtual, byMesh, stats } = this;
        batches.length = 0;
        skinned.length = 0;
        virtual.length = 0;
        byMesh.clear();
        instances.begin();
        let poolIndex = 0;
        for (const candidate of list) {
            if (candidate.entity.skin && candidate.mesh.skinning) {
                skinned.push(candidate);
                continue;
            }
            if (input.virtualGeometry?.claimsCaster(candidate)) {
                virtual.push(candidate);
                continue;
            }
            const mesh = input.resolveMesh(candidate, SHADOW_LOD_CASCADE);
            let batch = byMesh.get(mesh);
            if (!batch) {
                batch = this.acquireBatch(poolIndex++, mesh);
                byMesh.set(mesh, batch);
                batches.push(batch);
            }
            batch.items.push(candidate);
        }
        for (const batch of batches) {
            batch.firstInstance = instances.allocate(batch.items.length);
            for (let i = 0; i < batch.items.length; i++) {
                instances.data.set(batch.items[i].entity.worldMatrix, (batch.firstInstance + i) * MATRIX_FLOATS);
            }
            stats.triangles += (batch.mesh.indices.length / 3) * batch.items.length;
        }
        instances.upload();
        if (batches.length > 0) {
            program.use();
            gl.uniformMatrix4fv(program.uniform('u_lightViewProjection'), false, viewProjection);
            for (const batch of batches) {
                this.meshes.resolve(batch.mesh).drawInstanced(instances, batch.firstInstance, batch.items.length);
                stats.drawCalls++;
            }
        }
        if (skinned.length > 0) {
            const { skinnedProgram, skins } = this;
            skinnedProgram.use();
            gl.uniformMatrix4fv(skinnedProgram.uniform('u_lightViewProjection'), false, viewProjection);
            gl.uniform1i(skinnedProgram.uniform('u_jointMatrices'), JOINT_MATRICES_TEXTURE_UNIT);
            for (const candidate of skinned) {
                const { skin } = candidate.entity;
                if (!skin)
                    continue;
                gl.activeTexture(gl.TEXTURE0 + JOINT_MATRICES_TEXTURE_UNIT);
                gl.bindTexture(gl.TEXTURE_2D, skins.resolve(skin));
                this.meshes.resolve(candidate.mesh).draw();
                stats.drawCalls++;
                stats.triangles += candidate.mesh.indices.length / 3;
            }
        }
        if (input.virtualGeometry && virtual.length > 0) {
            stats.drawCalls += input.virtualGeometry.renderShadowCascade(viewProjection, texelWorldSize, virtual);
        }
    }
    private acquireBatch(index: number, mesh: MeshData): FaceBatch {
        let batch = this.batchPool[index];
        if (!batch) {
            batch = { mesh, firstInstance: 0, items: [] };
            this.batchPool[index] = batch;
        }
        else {
            batch.mesh = mesh;
            batch.firstInstance = 0;
            batch.items.length = 0;
        }
        return batch;
    }
    private expireCache(): void {
        for (const [id, entry] of this.cache) {
            if (this.frame - entry.frame <= CACHE_TTL_FRAMES)
                continue;
            this.releaseEntry(entry);
            this.cache.delete(id);
        }
    }
    private resetStats(): void {
        const { stats } = this;
        stats.facesUsed = 0;
        stats.facesRendered = 0;
        stats.facesPostponed = 0;
        stats.lightsShadowed = 0;
        stats.lightsDeferred = 0;
        stats.drawCalls = 0;
        stats.triangles = 0;
        stats.status.clear();
    }
    dispose(): void {
        this.program.dispose();
        this.skinnedProgram.dispose();
        this.instances.dispose();
        this.placeholder.dispose();
        this.atlas?.dispose();
        this.staticAtlas?.dispose();
    }
}
