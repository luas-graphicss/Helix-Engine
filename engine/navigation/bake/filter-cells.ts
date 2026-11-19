import * as mat4 from '@/engine/core/math/mat4';
import type { Mat4 } from '@/engine/core/math/mat4';
import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import { NOT_WALKABLE_AREA } from '../areas/nav-areas';
import { DIRECTION_COUNT, EAST, type NavCells, NO_CELL, NORTH, NULL_AREA, SOUTH, WEST } from '../mesh/nav-cells';
import { gridColumn, gridRow } from '../mesh/nav-grid';
export interface NavAreaVolume {
    readonly inverseWorld: Mat4;
    readonly center: Vec3;
    readonly halfSize: Vec3;
    readonly minX: number;
    readonly maxX: number;
    readonly minZ: number;
    readonly maxZ: number;
    readonly area: number;
}
const PROBE_LIFT = 0.05;
const ORTHOGONAL_STEP = 2;
const DIAGONAL_STEP = 3;
const UNREACHED = 0xffff;
const NO_REGION = -1;
const worldProbe = vec3.create();
const localProbe = vec3.create();
function isInsideVolume(volume: NavAreaVolume, point: Vec3): boolean {
    mat4.transformPoint(localProbe, volume.inverseWorld, point);
    for (let axis = 0; axis < 3; axis++) {
        if (Math.abs(localProbe[axis] - volume.center[axis]) > volume.halfSize[axis])
            return false;
    }
    return true;
}
function paintColumn(cells: NavCells, volume: NavAreaVolume, column: number, painted: number): void {
    const { columnStart, heights, areas } = cells;
    for (let cell = columnStart[column]; cell < columnStart[column + 1]; cell++) {
        if (areas[cell] === NULL_AREA)
            continue;
        vec3.set(worldProbe, cells.centerX(cell), heights[cell] + PROBE_LIFT, cells.centerZ(cell));
        if (isInsideVolume(volume, worldProbe))
            areas[cell] = painted;
    }
}
export function paintAreaVolume(cells: NavCells, volume: NavAreaVolume): void {
    const { grid } = cells;
    const firstColumn = Math.max(0, gridColumn(grid, volume.minX));
    const lastColumn = Math.min(grid.width - 1, gridColumn(grid, volume.maxX));
    const firstRow = Math.max(0, gridRow(grid, volume.minZ));
    const lastRow = Math.min(grid.depth - 1, gridRow(grid, volume.maxZ));
    const painted = volume.area === NOT_WALKABLE_AREA ? NULL_AREA : volume.area;
    for (let row = firstRow; row <= lastRow; row++) {
        for (let column = firstColumn; column <= lastColumn; column++)
            paintColumn(cells, volume, column + row * grid.width, painted);
    }
    cells.pruneLinks();
}
export function removeCellsOutsideHeights(cells: NavCells, minHeight: number, maxHeight: number): void {
    const { heights, areas } = cells;
    for (let cell = 0; cell < cells.count; cell++) {
        if (heights[cell] < minHeight || heights[cell] > maxHeight)
            areas[cell] = NULL_AREA;
    }
    cells.pruneLinks();
}
function relaxDistance(distances: Uint16Array, links: Int32Array, cell: number, direction: number, diagonal: number): void {
    const neighbor = links[cell * DIRECTION_COUNT + direction];
    if (neighbor === NO_CELL)
        return;
    distances[cell] = Math.min(distances[cell], distances[neighbor] + ORTHOGONAL_STEP);
    const corner = links[neighbor * DIRECTION_COUNT + diagonal];
    if (corner !== NO_CELL)
        distances[cell] = Math.min(distances[cell], distances[corner] + DIAGONAL_STEP);
}
function borderDistances(cells: NavCells): Uint16Array {
    const { links, areas, count } = cells;
    const distances = new Uint16Array(count).fill(UNREACHED);
    for (let cell = 0; cell < count; cell++) {
        const slot = cell * DIRECTION_COUNT;
        const isBorder = links[slot] === NO_CELL || links[slot + 1] === NO_CELL || links[slot + 2] === NO_CELL || links[slot + 3] === NO_CELL;
        if (areas[cell] === NULL_AREA || isBorder)
            distances[cell] = 0;
    }
    for (let cell = 0; cell < count; cell++) {
        relaxDistance(distances, links, cell, WEST, SOUTH);
        relaxDistance(distances, links, cell, SOUTH, EAST);
    }
    for (let cell = count - 1; cell >= 0; cell--) {
        relaxDistance(distances, links, cell, EAST, NORTH);
        relaxDistance(distances, links, cell, NORTH, WEST);
    }
    return distances;
}
export function erodeCells(cells: NavCells, rings: number): void {
    if (rings <= 0)
        return;
    const distances = borderDistances(cells);
    const threshold = rings * ORTHOGONAL_STEP;
    for (let cell = 0; cell < cells.count; cell++) {
        if (distances[cell] < threshold)
            cells.areas[cell] = NULL_AREA;
    }
    cells.pruneLinks();
}
function floodRegion(cells: NavCells, seed: number, regions: Int32Array, region: number): number {
    const pending = [seed];
    let size = 0;
    regions[seed] = region;
    for (let cell = pending.pop(); cell !== undefined; cell = pending.pop()) {
        size++;
        for (let direction = 0; direction < DIRECTION_COUNT; direction++) {
            const neighbor = cells.links[cell * DIRECTION_COUNT + direction];
            if (neighbor === NO_CELL || regions[neighbor] !== NO_REGION)
                continue;
            regions[neighbor] = region;
            pending.push(neighbor);
        }
    }
    return size;
}
export function removeSmallRegions(cells: NavCells, minCellCount: number): void {
    if (minCellCount <= 1)
        return;
    const regions = new Int32Array(cells.count).fill(NO_REGION);
    const sizes: number[] = [];
    for (let cell = 0; cell < cells.count; cell++) {
        if (cells.areas[cell] !== NULL_AREA && regions[cell] === NO_REGION)
            sizes.push(floodRegion(cells, cell, regions, sizes.length));
    }
    for (let cell = 0; cell < cells.count; cell++) {
        const region = regions[cell];
        if (region !== NO_REGION && sizes[region] < minCellCount)
            cells.areas[cell] = NULL_AREA;
    }
    cells.pruneLinks();
}
