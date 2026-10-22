import type { GridRegion } from '@/engine/terrain/core/heightfield';
import type { Terrain } from '@/engine/terrain/core/terrain';
import { falloffWeight, type BrushFalloff } from './brush';
export function paintLayer(terrain: Terrain, cx: number, cz: number, radius: number, falloff: BrushFalloff, layer: number, amount: number, outRegion: GridRegion): void {
    terrain.splatRegionAround(cx, cz, radius, outRegion);
    const { splat } = terrain;
    const texelSize = terrain.size / (splat.resolution - 1);
    const invRadius = 1 / Math.max(radius, 1e-6);
    const half = terrain.halfSize;
    for (let tz = outRegion.z0; tz <= outRegion.z1; tz++) {
        const dz = (tz * texelSize - half - cz) * invRadius;
        for (let tx = outRegion.x0; tx <= outRegion.x1; tx++) {
            const dx = (tx * texelSize - half - cx) * invRadius;
            const weight = falloffWeight(Math.hypot(dx, dz), falloff);
            if (weight <= 0)
                continue;
            splat.blend(tx, tz, layer, amount * weight);
        }
    }
    terrain.markSplatDirty(outRegion);
}
