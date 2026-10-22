import type { GL } from '@/engine/renderer/gl/context';
import { ShaderProgram } from '@/engine/renderer/gl/shader-program';
import { withDefines } from '@/engine/renderer/gl/shader-source';
import { DepthArrayRenderTarget } from '@/engine/renderer/gl/depth-array-render-target';
import type { GpuMeshCache } from '@/engine/renderer/gl/gpu-mesh-cache';
import { JOINT_MATRICES_TEXTURE_UNIT, type GpuSkinCache } from '@/engine/renderer/gl/gpu-skin-cache';
import { InstanceBuffer } from '@/engine/renderer/gl/instance-buffer';
import { InstanceLayout, MODEL_MATRIX_ATTRIBUTES } from '@/engine/renderer/gl/instance-layout';
import { SHADOW_DEPTH_VERTEX_SHADER, SHADOW_DEPTH_FRAGMENT_SHADER } from '@/engine/renderer/shaders/shadow-depth.glsl';
import { MAX_SHADOW_CASCADES, ShadowCascades } from '@/engine/renderer/shadows/shadow-cascades';
import { ShadowCasterSet } from '@/engine/renderer/shadows/shadow-caster-set';
import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import type { ShadowCasterCandidate, TerrainShadowCaster } from '@/engine/renderer/culling/visible-set';
import type { MeshData } from '@/engine/renderer/geometry/mesh-data';
import type { LodSettings } from '@/engine/renderer/lod/lod-selector';
import type { TerrainShadowRenderer } from '@/engine/renderer/terrain/terrain-shadow-renderer';
import type { RenderProfile } from '@/engine/renderer/quality/render-profile';
import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
export const SHADOW_MAP_TEXTURE_UNIT = 0;
const MATRIX_FLOATS = 16;
const SHADOW_INSTANCE_LAYOUT = new InstanceLayout(MODEL_MATRIX_ATTRIBUTES, MATRIX_FLOATS);
const FAR_CASCADE_RADIUS_PADDING = 1.15;
const FIT_MARGIN_TEXELS = 4;
const FORCE_REFIT_DRIFT_METERS = 1;
export interface ShadowMapBinding {
    readonly texture: WebGLTexture;
    readonly size: number;
    readonly cascadeCount: number;
    active: boolean;
    readonly shadowMatrices: Float32Array;
    readonly texelWorldSizes: Float32Array;
}
export type ShadowMeshResolver = (candidate: ShadowCasterCandidate, cascade: number) => MeshData;
export interface ShadowGeometryHook {
    claimsCaster(candidate: ShadowCasterCandidate): boolean;
    renderShadowCascade(lightViewProjection: Float32Array, texelWorldSize: number, casters: readonly ShadowCasterCandidate[]): number;
}
export interface ShadowPassInput {
    casters: readonly ShadowCasterCandidate[];
    terrainCasters: readonly TerrainShadowCaster[];
    camera: PerspectiveCamera;
    lightDirection: Vec3;
    resolveMesh: ShadowMeshResolver;
    lod: LodSettings;
    virtualGeometry: ShadowGeometryHook | null;
}
interface ShadowBatch {
    mesh: MeshData;
    firstInstance: number;
    readonly items: ShadowCasterCandidate[];
}
interface CascadeGroup {
    readonly batches: ShadowBatch[];
    readonly virtual: ShadowCasterCandidate[];
    readonly skinned: ShadowCasterCandidate[];
}
interface CascadeState {
    committed: boolean;
    staticDirty: boolean;
    staticLayerValid: boolean;
    finalHasDynamics: boolean;
    renderStatic: boolean;
}
export interface ShadowPassStats {
    drawCalls: number;
    instances: number;
    triangles: number;
    staticCascadesRendered: number;
}
function createGroup(): CascadeGroup {
    return { batches: [], virtual: [], skinned: [] };
}
function groupIsEmpty(group: CascadeGroup): boolean {
    return group.batches.length === 0 && group.virtual.length === 0 && group.skinned.length === 0;
}
export class ShadowPass {
    readonly stats: ShadowPassStats = { drawCalls: 0, instances: 0, triangles: 0, staticCascadesRendered: 0 };
    readonly binding: ShadowMapBinding;
    maxDistance = 350;
    private readonly program: ShaderProgram;
    private readonly skinnedProgram: ShaderProgram;
    private readonly target: DepthArrayRenderTarget;
    private readonly staticTarget: DepthArrayRenderTarget;
    private readonly casters = new ShadowCasterSet();
    private readonly cascades: ShadowCascades;
    private readonly instances: InstanceBuffer;
    private readonly staticGroups: CascadeGroup[] = [];
    private readonly dynamicGroups: CascadeGroup[] = [];
    private readonly states: CascadeState[] = [];
    private readonly batchPool: ShadowBatch[] = [];
    private readonly byMesh = new Map<MeshData, ShadowBatch>();
    private readonly scratch = vec3.create();
    private frame = 0;
    private poolIndex = 0;
    constructor(private readonly gl: GL, private readonly meshes: GpuMeshCache, private readonly skins: GpuSkinCache, private readonly terrainShadows: TerrainShadowRenderer, private readonly profile: RenderProfile) {
        const size = profile.shadowMapSize;
        this.program = new ShaderProgram(gl, SHADOW_DEPTH_VERTEX_SHADER, SHADOW_DEPTH_FRAGMENT_SHADER);
        this.skinnedProgram = new ShaderProgram(gl, withDefines(SHADOW_DEPTH_VERTEX_SHADER, { SKINNED: true }), SHADOW_DEPTH_FRAGMENT_SHADER);
        this.target = new DepthArrayRenderTarget(gl, size, MAX_SHADOW_CASCADES);
        this.staticTarget = new DepthArrayRenderTarget(gl, size, MAX_SHADOW_CASCADES);
        this.cascades = new ShadowCascades(MAX_SHADOW_CASCADES, size);
        this.instances = new InstanceBuffer(gl, SHADOW_INSTANCE_LAYOUT);
        for (let i = 0; i < MAX_SHADOW_CASCADES; i++) {
            this.staticGroups.push(createGroup());
            this.dynamicGroups.push(createGroup());
            this.states.push({ committed: false, staticDirty: true, staticLayerValid: false, finalHasDynamics: false, renderStatic: false });
        }
        this.binding = {
            texture: this.target.texture,
            size,
            cascadeCount: MAX_SHADOW_CASCADES,
            active: false,
            shadowMatrices: this.cascades.shadowMatrices,
            texelWorldSizes: this.cascades.texelWorldSizes,
        };
    }
    render(input: ShadowPassInput): void {
        const { gl, binding, casters, cascades, states, terrainShadows } = this;
        const { camera, lightDirection } = input;
        this.frame++;
        this.resetStats();
        terrainShadows.beginFrame(input.lod);
        binding.active = casters.sync(input.casters, input.terrainCasters, lightDirection, this.frame);
        if (!binding.active)
            return;
        cascades.prepare(camera, casters.bounds, this.maxDistance);
        this.scheduleCascades(lightDirection);
        let anyStatic = false;
        let anyDynamic = casters.dynamicCasters.length > 0;
        for (const state of states) {
            anyStatic ||= state.renderStatic;
            anyDynamic ||= state.finalHasDynamics;
        }
        if (!anyStatic && !anyDynamic)
            return;
        this.buildGroups(input, lightDirection);
        gl.activeTexture(gl.TEXTURE0 + SHADOW_MAP_TEXTURE_UNIT);
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
        gl.disable(gl.CULL_FACE);
        for (let cascade = 0; cascade < cascades.count; cascade++) {
            const state = states[cascade];
            const dynamic = this.dynamicGroups[cascade];
            const hasDynamics = !groupIsEmpty(dynamic);
            const separate = hasDynamics || state.finalHasDynamics;
            if (state.renderStatic) {
                if (separate) {
                    this.staticTarget.bindLayer(cascade);
                    this.renderStatic(cascade, input);
                    state.staticLayerValid = true;
                }
                else {
                    this.target.bindLayer(cascade);
                    this.renderStatic(cascade, input);
                    state.staticLayerValid = false;
                }
                state.staticDirty = false;
                this.stats.staticCascadesRendered++;
            }
            if (separate) {
                this.target.copyLayerFrom(this.staticTarget, cascade, cascade);
                if (hasDynamics)
                    this.renderGroup(dynamic, cascade, input);
                state.finalHasDynamics = hasDynamics;
            }
        }
        gl.enable(gl.CULL_FACE);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        this.stats.drawCalls += terrainShadows.stats.drawCalls;
        this.stats.triangles += terrainShadows.stats.triangles;
    }
    private scheduleCascades(lightDirection: Vec3): void {
        const { cascades, casters, states, profile } = this;
        const boundsChanged = casters.staticChanged || casters.dynamicChanged;
        for (let cascade = 0; cascade < cascades.count; cascade++) {
            const state = states[cascade];
            const period = cascade === 0 ? 1 : cascade === 1 ? profile.midCascadePeriod : profile.farCascadePeriod;
            const scheduled = this.frame % period === 0;
            let refit = !state.committed || casters.lightChanged;
            if (!refit) {
                const fits = cascades.desiredFitsCommitted(cascade, FIT_MARGIN_TEXELS);
                const depthOk = !boundsChanged || cascades.depthRangeCovers(cascade, casters.bounds);
                refit = !fits || !depthOk;
            }
            if (refit && (scheduled || cascade === 0 || !state.committed || cascades.drift(cascade) > FORCE_REFIT_DRIFT_METERS)) {
                cascades.commit(cascade, lightDirection, casters.bounds, cascade === 0 ? 1 : FAR_CASCADE_RADIUS_PADDING);
                state.committed = true;
                state.staticDirty = true;
            }
            if (casters.staticChanged)
                state.staticDirty = true;
            const needsStaticLayer = !state.staticLayerValid && casters.dynamicCasters.length > 0;
            state.renderStatic = state.staticDirty || needsStaticLayer;
        }
    }
    private renderStatic(cascade: number, input: ShadowPassInput): void {
        const { gl, cascades, terrainShadows } = this;
        gl.clear(gl.DEPTH_BUFFER_BIT);
        this.renderGroup(this.staticGroups[cascade], cascade, input);
        terrainShadows.renderCascade(input.terrainCasters, cascades.viewProjection[cascade], cascades.texelWorldSizes[cascade]);
    }
    private renderGroup(group: CascadeGroup, cascade: number, input: ShadowPassInput): void {
        const { gl, program, instances, cascades } = this;
        const lightViewProjection = cascades.viewProjection[cascade];
        if (group.batches.length > 0) {
            program.use();
            gl.uniformMatrix4fv(program.uniform('u_lightViewProjection'), false, lightViewProjection);
            for (const batch of group.batches) {
                this.meshes.resolve(batch.mesh).drawInstanced(instances, batch.firstInstance, batch.items.length);
                this.stats.drawCalls++;
            }
        }
        this.renderSkinned(group.skinned, lightViewProjection);
        if (input.virtualGeometry && group.virtual.length > 0) {
            this.stats.drawCalls += input.virtualGeometry.renderShadowCascade(lightViewProjection, cascades.texelWorldSizes[cascade], group.virtual);
        }
    }
    private buildGroups(input: ShadowPassInput, lightDirection: Vec3): void {
        const { instances, cascades, casters, states } = this;
        instances.begin();
        this.poolIndex = 0;
        for (let cascade = 0; cascade < cascades.count; cascade++) {
            const staticGroup = this.staticGroups[cascade];
            const dynamicGroup = this.dynamicGroups[cascade];
            this.clearGroup(staticGroup);
            this.clearGroup(dynamicGroup);
            if (states[cascade].renderStatic)
                this.fillGroup(staticGroup, casters.staticCasters, cascade, lightDirection, input);
            this.fillGroup(dynamicGroup, casters.dynamicCasters, cascade, lightDirection, input);
        }
        instances.upload();
        this.stats.instances = instances.count;
    }
    private clearGroup(group: CascadeGroup): void {
        group.batches.length = 0;
        group.virtual.length = 0;
        group.skinned.length = 0;
    }
    private fillGroup(group: CascadeGroup, candidates: readonly ShadowCasterCandidate[], cascade: number, lightDirection: Vec3, input: ShadowPassInput): void {
        const { instances, cascades, byMesh } = this;
        byMesh.clear();
        const texelSize = cascades.texelWorldSizes[cascade];
        for (const candidate of candidates) {
            const { bounds } = candidate;
            if (bounds.radius * 2 < texelSize || !this.intersectsCascade(bounds.center, bounds.radius, cascade, lightDirection))
                continue;
            if (candidate.entity.skin && candidate.mesh.skinning) {
                group.skinned.push(candidate);
                this.stats.triangles += candidate.mesh.indices.length / 3;
                continue;
            }
            if (input.virtualGeometry?.claimsCaster(candidate)) {
                group.virtual.push(candidate);
                continue;
            }
            const mesh = input.resolveMesh(candidate, cascade);
            let batch = byMesh.get(mesh);
            if (!batch) {
                batch = this.acquireBatch(this.poolIndex++, mesh);
                byMesh.set(mesh, batch);
                group.batches.push(batch);
            }
            batch.items.push(candidate);
        }
        for (const batch of group.batches) {
            batch.firstInstance = instances.allocate(batch.items.length);
            for (let i = 0; i < batch.items.length; i++) {
                instances.data.set(batch.items[i].entity.worldMatrix, (batch.firstInstance + i) * MATRIX_FLOATS);
            }
            this.stats.triangles += (batch.mesh.indices.length / 3) * batch.items.length;
        }
    }
    private renderSkinned(casters: readonly ShadowCasterCandidate[], lightViewProjection: Float32Array): void {
        if (casters.length === 0)
            return;
        const { gl, skinnedProgram, skins } = this;
        skinnedProgram.use();
        gl.uniformMatrix4fv(skinnedProgram.uniform('u_lightViewProjection'), false, lightViewProjection);
        gl.uniform1i(skinnedProgram.uniform('u_jointMatrices'), JOINT_MATRICES_TEXTURE_UNIT);
        for (const candidate of casters) {
            const { skin } = candidate.entity;
            if (!skin)
                continue;
            const texture = skins.resolve(skin);
            gl.activeTexture(gl.TEXTURE0 + JOINT_MATRICES_TEXTURE_UNIT);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            this.meshes.resolve(candidate.mesh).draw();
            this.stats.drawCalls++;
        }
    }
    private acquireBatch(index: number, mesh: MeshData): ShadowBatch {
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
    private intersectsCascade(center: Vec3, radius: number, cascade: number, lightDirection: Vec3): boolean {
        const { scratch, cascades } = this;
        vec3.subtract(scratch, center, cascades.centers[cascade]);
        const along = vec3.dot(scratch, lightDirection);
        vec3.scaleAndAdd(scratch, scratch, lightDirection, -along);
        return vec3.length(scratch) <= radius + cascades.radii[cascade];
    }
    private resetStats(): void {
        this.stats.drawCalls = 0;
        this.stats.instances = 0;
        this.stats.triangles = 0;
        this.stats.staticCascadesRendered = 0;
    }
    skip(): void {
        this.resetStats();
        this.binding.active = false;
    }
    dispose(): void {
        this.program.dispose();
        this.skinnedProgram.dispose();
        this.target.dispose();
        this.staticTarget.dispose();
        this.instances.dispose();
    }
}
