import { clamp } from '@/engine/core/math/scalar';
import type { GridRegion, Heightfield } from '@/engine/terrain/core/heightfield';
export const TILE_CELLS = 32;
export const TILE_LEVELS = Math.log2(TILE_CELLS) + 1;
export function tilesPerSide(resolution: number): number {
    return Math.max(Math.ceil((resolution - 1) / TILE_CELLS), 1);
}
export class TerrainTileBounds {
    readonly tilesPerSide: number;
    readonly count: number;
    readonly minHeights: Float32Array;
    readonly maxHeights: Float32Array;
    minHeight = 0;
    maxHeight = 0;
    constructor(readonly resolution: number) {
        this.tilesPerSide = tilesPerSide(resolution);
        this.count = this.tilesPerSide * this.tilesPerSide;
        this.minHeights = new Float32Array(this.count);
        this.maxHeights = new Float32Array(this.count);
    }
    firstSample(index: number): number {
        return index * TILE_CELLS;
    }
    lastSample(index: number): number {
        return Math.min((index + 1) * TILE_CELLS, this.resolution - 1);
    }
    update(heightfield: Heightfield, region: GridRegion | null = null): void {
        const n = this.tilesPerSide;
        let tx0 = 0, tz0 = 0, tx1 = n - 1, tz1 = n - 1;
        if (region) {
            tx0 = clamp(Math.ceil(region.x0 / TILE_CELLS) - 1, 0, n - 1);
            tz0 = clamp(Math.ceil(region.z0 / TILE_CELLS) - 1, 0, n - 1);
            tx1 = clamp(Math.floor(region.x1 / TILE_CELLS), 0, n - 1);
            tz1 = clamp(Math.floor(region.z1 / TILE_CELLS), 0, n - 1);
        }
        for (let tz = tz0; tz <= tz1; tz++) {
            for (let tx = tx0; tx <= tx1; tx++)
                this.measure(heightfield, tx, tz);
        }
        let min = Infinity;
        let max = -Infinity;
        for (let i = 0; i < this.count; i++) {
            if (this.minHeights[i] < min)
                min = this.minHeights[i];
            if (this.maxHeights[i] > max)
                max = this.maxHeights[i];
        }
        this.minHeight = min;
        this.maxHeight = max;
    }
    private measure(heightfield: Heightfield, tx: number, tz: number): void {
        const { heights, resolution } = heightfield;
        const x0 = this.firstSample(tx), x1 = this.lastSample(tx);
        const z0 = this.firstSample(tz), z1 = this.lastSample(tz);
        let min = Infinity;
        let max = -Infinity;
        for (let z = z0; z <= z1; z++) {
            const row = z * resolution;
            for (let x = x0; x <= x1; x++) {
                const value = heights[row + x];
                if (value < min)
                    min = value;
                if (value > max)
                    max = value;
            }
        }
        const index = tz * this.tilesPerSide + tx;
        this.minHeights[index] = min;
        this.maxHeights[index] = max;
    }
}
