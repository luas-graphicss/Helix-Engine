import type { GL } from '@/engine/renderer/gl/context';
import type { CullingStats } from '@/engine/renderer/culling/visible-set';
export interface RenderOptimizationStats {
    occluders: number;
    occluderTriangles: number;
    occlusionCulled: number;
    lodGroups: number;
    lodGroupsCulled: number;
}
export function createRenderOptimizationStats(): RenderOptimizationStats {
    return { occluders: 0, occluderTriangles: 0, occlusionCulled: 0, lodGroups: 0, lodGroupsCulled: 0 };
}
export class RenderOptimization {
    private static readonly byContext = new WeakMap<GL, RenderOptimization>();
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
}
