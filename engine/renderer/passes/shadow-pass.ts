import type { GL } from '@/engine/renderer/gl/context';
import { ShaderProgram } from '@/engine/renderer/gl/shader-program';
import { DepthArrayRenderTarget } from '@/engine/renderer/gl/depth-array-render-target';
import type { GpuMeshCache } from '@/engine/renderer/gl/gpu-mesh-cache';
import { InstanceBuffer } from '@/engine/renderer/gl/instance-buffer';
import { InstanceLayout, MODEL_MATRIX_ATTRIBUTES } from '@/engine/renderer/gl/instance-layout';
import { SHADOW_DEPTH_VERTEX_SHADER, SHADOW_DEPTH_FRAGMENT_SHADER } from '@/engine/renderer/shaders/shadow-depth.glsl';
import { MAX_SHADOW_CASCADES, ShadowCascades } from '@/engine/renderer/shadows/shadow-cascades';
import { ShadowCasterSet } from '@/engine/renderer/shadows/shadow-caster-set';
import { FloatSnapshot } from '@/engine/renderer/cache/float-snapshot';
import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import type { ShadowCasterCandidate, TerrainShadowCaster } from '@/engine/renderer/culling/visible-set';
import type { MeshData } from '@/engine/renderer/geometry/mesh-data';
import type { LodSettings } from '@/engine/renderer/lod/lod-selector';
import type { TerrainShadowRenderer } from '@/engine/renderer/terrain/terrain-shadow-renderer';
import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
export const SHADOW_MAP_TEXTURE_UNIT = 0;
const MATRIX_FLOATS = 16;
const SHADOW_INSTANCE_LAYOUT = new InstanceLayout(MODEL_MATRIX_ATTRIBUTES, MATRIX_FLOATS);
export interface ShadowMapBinding {
    readonly texture: WebGLTexture;
    readonly size: number;
    readonly cascadeCount: number;
    active: boolean;
    readonly shadowMatrices: Float32Array;
    readonly texelWorldSizes: Float32Array;
}
export type ShadowMeshResolver = (candidate: ShadowCasterCandidate, cascade: number) => MeshData;
export interface ShadowPassInput {
    casters: readonly ShadowCasterCandidate[];
    terrainCasters: readonly TerrainShadowCaster[];
    camera: PerspectiveCamera;
    lightDirection: Vec3;
    resolveMesh: ShadowMeshResolver;
    lod: LodSettings;
}
interface ShadowBatch {
    mesh: MeshData;
    firstInstance: number;
    readonly items: ShadowCasterCandidate[];
}
export interface ShadowPassStats {
    drawCalls: number;
    instances: number;
    triangles: number;
}
export class ShadowPass {
    readonly stats: ShadowPassStats = { drawCalls: 0, instances: 0, triangles: 0 };
    readonly binding: ShadowMapBinding;
    maxDistance = 350;
    private readonly program: ShaderProgram;
    private readonly target: DepthArrayRenderTarget;
    private readonly casters = new ShadowCasterSet();
    private readonly cascades: ShadowCascades;
    private readonly cameraSnapshot = new FloatSnapshot(MATRIX_FLOATS);
    private readonly instances: InstanceBuffer;
    private readonly cascadeBatches: ShadowBatch[][] = [];
    private readonly batchPool: ShadowBatch[] = [];
    private readonly byMesh = new Map<MeshData, ShadowBatch>();
    private readonly scratch = vec3.create();
    constructor(private readonly gl: GL, private readonly meshes: GpuMeshCache, private readonly terrainShadows: TerrainShadowRenderer, size: number) {
        this.program = new ShaderProgram(gl, SHADOW_DEPTH_VERTEX_SHADER, SHADOW_DEPTH_FRAGMENT_SHADER);
        this.target = new DepthArrayRenderTarget(gl, size, MAX_SHADOW_CASCADES);
        this.cascades = new ShadowCascades(MAX_SHADOW_CASCADES, size);
        this.instances = new InstanceBuffer(gl, SHADOW_INSTANCE_LAYOUT);
        for (let i = 0; i < MAX_SHADOW_CASCADES; i++)
            this.cascadeBatches.push([]);
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
        const { gl, program, binding, casters, cascades, instances, terrainShadows } = this;
        const { camera, lightDirection } = input;
        this.resetStats();
        terrainShadows.beginFrame(input.lod);
        binding.active = casters.sync(input.casters, input.terrainCasters, lightDirection);
        if (!binding.active)
            return;
        const cameraChanged = this.cameraSnapshot.sync(0, camera.viewProjectionMatrix);
        if (!casters.changed && !cameraChanged)
            return;
        cascades.update(camera, lightDirection, casters.bounds, this.maxDistance);
        this.buildBatches(input.casters, lightDirection, input.resolveMesh);
        gl.activeTexture(gl.TEXTURE0 + SHADOW_MAP_TEXTURE_UNIT);
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
        gl.disable(gl.CULL_FACE);
        for (let cascade = 0; cascade < cascades.count; cascade++) {
            const lightViewProjection = cascades.viewProjection[cascade];
            this.target.bindLayer(cascade);
            gl.clear(gl.DEPTH_BUFFER_BIT);
            program.use();
            gl.uniformMatrix4fv(program.uniform('u_lightViewProjection'), false, lightViewProjection);
            for (const batch of this.cascadeBatches[cascade]) {
                this.meshes.resolve(batch.mesh).drawInstanced(instances, batch.firstInstance, batch.items.length);
                this.stats.drawCalls++;
            }
            terrainShadows.renderCascade(input.terrainCasters, lightViewProjection, cascades.texelWorldSizes[cascade]);
        }
        gl.enable(gl.CULL_FACE);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        this.stats.drawCalls += terrainShadows.stats.drawCalls;
        this.stats.triangles += terrainShadows.stats.triangles;
    }
    private buildBatches(candidates: readonly ShadowCasterCandidate[], lightDirection: Vec3, resolveMesh: ShadowMeshResolver): void {
        const { instances, cascades, byMesh } = this;
        instances.begin();
        let poolIndex = 0;
        for (let cascade = 0; cascade < cascades.count; cascade++) {
            const batches = this.cascadeBatches[cascade];
            batches.length = 0;
            byMesh.clear();
            const texelSize = cascades.texelWorldSizes[cascade];
            for (const candidate of candidates) {
                const { bounds } = candidate;
                if (bounds.radius * 2 < texelSize || !this.intersectsCascade(bounds.center, bounds.radius, cascade, lightDirection))
                    continue;
                const mesh = resolveMesh(candidate, cascade);
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
                this.stats.triangles += (batch.mesh.indices.length / 3) * batch.items.length;
            }
        }
        instances.upload();
        this.stats.instances = instances.count;
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
    }
    skip(): void {
        this.resetStats();
        this.binding.active = false;
    }
    dispose(): void {
        this.program.dispose();
        this.target.dispose();
        this.instances.dispose();
    }
}
