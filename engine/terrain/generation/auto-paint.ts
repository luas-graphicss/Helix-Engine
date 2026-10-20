import { RAD_TO_DEG, clamp } from '@/engine/core/math/scalar';
import type { Terrain } from '@/engine/terrain/core/terrain';
import { MAX_TERRAIN_LAYERS } from '@/engine/terrain/core/splat-map';
import type { TerrainAutoRule } from '@/engine/terrain/core/terrain-layer';
const weights = new Float32Array(MAX_TERRAIN_LAYERS);
function smoothstep(edge0: number, edge1: number, value: number): number {
    if (edge1 <= edge0)
        return value >= edge1 ? 1 : 0;
    const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
}
function band(value: number, min: number, max: number, softness: number): number {
    return smoothstep(min - softness, min + softness, value) * (1 - smoothstep(max - softness, max + softness, value));
}
function ruleWeight(rule: TerrainAutoRule, slopeDegrees: number, relativeHeight: number): number {
    const slope = band(slopeDegrees, rule.slopeMin, rule.slopeMax, rule.softness * 20);
    const height = band(relativeHeight, rule.heightMin, rule.heightMax, rule.softness * 0.25);
    return slope * height;
}
export function autoPaintTerrain(terrain: Terrain): boolean {
    const rules = terrain.layers.map((layer) => (layer.auto.enabled ? layer.auto : null));
    if (!rules.some((rule) => rule !== null))
        return false;
    const { splat, heightfield } = terrain;
    const [minHeight, maxHeight] = heightfield.minMax();
    const heightSpan = Math.max(maxHeight - minHeight, 1e-3);
    const gridScale = (heightfield.resolution - 1) / (splat.resolution - 1);
    const cellSize = terrain.cellSize;
    for (let tz = 0; tz < splat.resolution; tz++) {
        const gz = tz * gridScale;
        for (let tx = 0; tx < splat.resolution; tx++) {
            const gx = tx * gridScale;
            const height = heightfield.sample(gx, gz);
            const dx = (heightfield.sample(gx + 1, gz) - heightfield.sample(gx - 1, gz)) / (2 * cellSize);
            const dz = (heightfield.sample(gx, gz + 1) - heightfield.sample(gx, gz - 1)) / (2 * cellSize);
            const slopeDegrees = Math.atan(Math.hypot(dx, dz)) * RAD_TO_DEG;
            const relativeHeight = (height - minHeight) / heightSpan;
            weights.fill(0);
            let covered = 0;
            for (let i = 1; i < rules.length; i++) {
                const rule = rules[i];
                if (!rule)
                    continue;
                const weight = ruleWeight(rule, slopeDegrees, relativeHeight);
                weights[i] = weight;
                covered += weight;
            }
            if (covered > 1) {
                for (let i = 1; i < rules.length; i++)
                    weights[i] /= covered;
                covered = 1;
            }
            const baseRule = rules[0];
            weights[0] = Math.max(1 - covered, baseRule ? ruleWeight(baseRule, slopeDegrees, relativeHeight) * (1 - covered) : 0);
            splat.writeWeights(tx, tz, weights);
        }
    }
    terrain.markSplatDirty();
    return true;
}
