import type { GL } from '@/engine/renderer/gl/context';
import type { MeshBatcherStats } from '@/engine/renderer/batching/mesh-batcher';
import type { CullingStats } from '@/engine/renderer/culling/visible-set';
import type { MeshResidencyStats } from '@/engine/renderer/gl/gpu-mesh-cache';
export interface RenderOptimizationSettings {
    staticBatching: boolean;
    dynamicBatching: boolean;
    shaderBatching: boolean;
    meshCompression: boolean;
    meshStreaming: boolean;
    meshBudgetMb: number;
}
export function createRenderOptimizationSettings(): RenderOptimizationSettings {
    return { staticBatching: false, dynamicBatching: false, shaderBatching: false, meshCompression: false, meshStreaming: false, meshBudgetMb: 256 };
}
export interface RenderOptimizationStats {
    occluders: number;
    occluderTriangles: number;
    occlusionCulled: number;
    lodGroups: number;
    lodGroupsCulled: number;
    staticBatches: number;
    staticBatchedMeshes: number;
    dynamicBatches: number;
    dynamicBatchedMeshes: number;
    shaderSwitches: number;
    materialSwitches: number;
    meshesResident: number;
    meshBytes: number;
    meshesReleased: number;
}
export interface DrawStateSwitches {
    shaders: number;
    materials: number;
}
export function createRenderOptimizationStats(): RenderOptimizationStats {
    return { occluders: 0, occluderTriangles: 0, occlusionCulled: 0, lodGroups: 0, lodGroupsCulled: 0, staticBatches: 0, staticBatchedMeshes: 0, dynamicBatches: 0, dynamicBatchedMeshes: 0, shaderSwitches: 0, materialSwitches: 0, meshesResident: 0, meshBytes: 0, meshesReleased: 0 };
}
export class RenderOptimization {
    private static readonly byContext = new WeakMap<GL, RenderOptimization>();
    settings = createRenderOptimizationSettings();
    stats = createRenderOptimizationStats();
    static for(gl: GL): RenderOptimization {
        let optimization = RenderOptimization.byContext.get(gl);
        if (!optimization) {
            optimization = new RenderOptimization();
            RenderOptimization.byContext.set(gl, optimization);
        }
        return optimization;
    }
    private constructor() { }
    recordCulling(culling: CullingStats): void {
        const { stats } = this;
        stats.occluders = culling.occluders;
        stats.occluderTriangles = culling.occluderTriangles;
        stats.occlusionCulled = culling.occlusionCulled;
        stats.lodGroups = culling.lodGroups;
        stats.lodGroupsCulled = culling.lodGroupsCulled;
    }
    recordBatching(batching: MeshBatcherStats): void {
        const { stats } = this;
        stats.staticBatches = batching.staticBatches;
        stats.staticBatchedMeshes = batching.staticMeshes;
        stats.dynamicBatches = batching.dynamicBatches;
        stats.dynamicBatchedMeshes = batching.dynamicMeshes;
    }
    recordMeshes(meshes: MeshResidencyStats): void {
        const { stats } = this;
        stats.meshesResident = meshes.resident;
        stats.meshBytes = meshes.residentBytes;
        stats.meshesReleased = meshes.released;
    }
    recordSwitches(switches: DrawStateSwitches): void {
        this.stats.shaderSwitches = switches.shaders;
        this.stats.materialSwitches = switches.materials;
    }
}
