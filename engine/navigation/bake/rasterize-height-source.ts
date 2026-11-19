import { NULL_AREA } from '../mesh/nav-cells';
import type { NavGrid } from '../mesh/nav-grid';
import type { SpanField } from './span-field';
export interface NavHeightSource {
    readonly minX: number;
    readonly maxX: number;
    readonly minZ: number;
    readonly maxZ: number;
    readonly area: number;
    heightAt(x: number, z: number): number;
    normalYAt(x: number, z: number): number;
}
function firstCenterInside(origin: number, cellSize: number, bound: number): number {
    return Math.max(0, Math.ceil((bound - origin) / cellSize - 0.5));
}
function lastCenterInside(origin: number, cellSize: number, bound: number, limit: number): number {
    return Math.min(limit - 1, Math.floor((bound - origin) / cellSize - 0.5));
}
export function rasterizeHeightSource(field: SpanField, grid: NavGrid, source: NavHeightSource, minWalkableNormalY: number): void {
    const { originX, originZ, cellSize, width, depth } = grid;
    const firstColumn = firstCenterInside(originX, cellSize, source.minX);
    const lastColumn = lastCenterInside(originX, cellSize, source.maxX, width);
    const firstRow = firstCenterInside(originZ, cellSize, source.minZ);
    const lastRow = lastCenterInside(originZ, cellSize, source.maxZ, depth);
    for (let row = firstRow; row <= lastRow; row++) {
        const z = originZ + (row + 0.5) * cellSize;
        for (let column = firstColumn; column <= lastColumn; column++) {
            const x = originX + (column + 0.5) * cellSize;
            const height = source.heightAt(x, z);
            if (!Number.isFinite(height))
                continue;
            const area = source.normalYAt(x, z) >= minWalkableNormalY ? source.area : NULL_AREA;
            field.add(column + row * width, height, height, height, area);
        }
    }
}
