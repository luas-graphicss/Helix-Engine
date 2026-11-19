import { clamp, lerp } from '@/engine/core/math/scalar';
import type { Vec3 } from '@/engine/core/math/vec3';
import { DIRECTION_COUNT, EAST, NO_CELL, NORTH, SOUTH, WEST } from './nav-cells';
import { gridColumn, gridRow, isInsideGrid } from './nav-grid';
import type { NavMesh } from './nav-mesh';
const CELL_INSET = 1e-3;
interface NearestCell {
    cell: number;
    distance: number;
}
const nearest: NearestCell = { cell: NO_CELL, distance: 0 };
export function findCellAt(mesh: NavMesh, x: number, y: number, z: number, reach: number): number {
    const { grid, columnStart, heights } = mesh.cells;
    const column = gridColumn(grid, x);
    const row = gridRow(grid, z);
    if (!isInsideGrid(grid, column, row))
        return NO_CELL;
    const index = column + row * grid.width;
    let closest = NO_CELL;
    let closestGap = reach;
    for (let cell = columnStart[index]; cell < columnStart[index + 1]; cell++) {
        const gap = Math.abs(heights[cell] - y);
        if (gap <= closestGap && mesh.isWalkable(cell)) {
            closest = cell;
            closestGap = gap;
        }
    }
    return closest;
}
function distanceToColumn(origin: number, cellSize: number, index: number, coordinate: number): number {
    const min = origin + index * cellSize;
    return Math.max(min - coordinate, 0, coordinate - min - cellSize);
}
function scanColumn(mesh: NavMesh, column: number, row: number, x: number, y: number, z: number): void {
    const { grid, columnStart, heights } = mesh.cells;
    if (!isInsideGrid(grid, column, row))
        return;
    const horizontal = Math.hypot(distanceToColumn(grid.originX, grid.cellSize, column, x), distanceToColumn(grid.originZ, grid.cellSize, row, z));
    const index = column + row * grid.width;
    for (let cell = columnStart[index]; cell < columnStart[index + 1]; cell++) {
        const distance = Math.hypot(horizontal, heights[cell] - y);
        if (distance <= nearest.distance && mesh.isWalkable(cell)) {
            nearest.cell = cell;
            nearest.distance = distance;
        }
    }
}
function scanRing(mesh: NavMesh, centerColumn: number, centerRow: number, ring: number, x: number, y: number, z: number): void {
    for (let offset = -ring; offset <= ring; offset++) {
        scanColumn(mesh, centerColumn + offset, centerRow - ring, x, y, z);
        if (ring > 0)
            scanColumn(mesh, centerColumn + offset, centerRow + ring, x, y, z);
    }
    for (let offset = 1 - ring; offset < ring; offset++) {
        scanColumn(mesh, centerColumn - ring, centerRow + offset, x, y, z);
        scanColumn(mesh, centerColumn + ring, centerRow + offset, x, y, z);
    }
}
export function findNearestCell(mesh: NavMesh, x: number, y: number, z: number, maxDistance: number): number {
    const { grid } = mesh.cells;
    const centerColumn = clamp(gridColumn(grid, x), 0, grid.width - 1);
    const centerRow = clamp(gridRow(grid, z), 0, grid.depth - 1);
    const lastRing = Math.ceil(maxDistance / grid.cellSize) + 1;
    nearest.cell = NO_CELL;
    nearest.distance = maxDistance;
    for (let ring = 0; ring <= lastRing; ring++) {
        if (nearest.cell !== NO_CELL && nearest.distance <= (ring - 1) * grid.cellSize)
            break;
        scanRing(mesh, centerColumn, centerRow, ring, x, y, z);
    }
    return nearest.cell;
}
function linkedHeight(mesh: NavMesh, cell: number, direction: number, fallback: number): number {
    const neighbor = mesh.cells.links[cell * DIRECTION_COUNT + direction];
    return neighbor === NO_CELL ? fallback : mesh.cells.heights[neighbor];
}
function diagonalCell(mesh: NavMesh, cell: number, directionX: number, directionZ: number): number {
    const { links } = mesh.cells;
    const alongX = links[cell * DIRECTION_COUNT + directionX];
    if (alongX !== NO_CELL)
        return links[alongX * DIRECTION_COUNT + directionZ];
    const alongZ = links[cell * DIRECTION_COUNT + directionZ];
    return alongZ === NO_CELL ? NO_CELL : links[alongZ * DIRECTION_COUNT + directionX];
}
export function sampleHeight(mesh: NavMesh, cell: number, x: number, z: number): number {
    const { cells } = mesh;
    const { cellSize } = cells.grid;
    const offsetX = clamp((x - cells.centerX(cell)) / cellSize, -0.5, 0.5);
    const offsetZ = clamp((z - cells.centerZ(cell)) / cellSize, -0.5, 0.5);
    const directionX = offsetX >= 0 ? EAST : WEST;
    const directionZ = offsetZ >= 0 ? NORTH : SOUTH;
    const here = cells.heights[cell];
    const alongX = linkedHeight(mesh, cell, directionX, here);
    const alongZ = linkedHeight(mesh, cell, directionZ, here);
    const corner = diagonalCell(mesh, cell, directionX, directionZ);
    const diagonal = corner === NO_CELL ? alongX + alongZ - here : cells.heights[corner];
    const blendX = Math.abs(offsetX);
    return lerp(lerp(here, alongX, blendX), lerp(alongZ, diagonal, blendX), Math.abs(offsetZ));
}
export function clampToCell(out: Vec3, mesh: NavMesh, cell: number, point: Vec3): Vec3 {
    const { cells } = mesh;
    const half = cells.grid.cellSize / 2 - CELL_INSET;
    const centerX = cells.centerX(cell);
    const centerZ = cells.centerZ(cell);
    out[0] = clamp(point[0], centerX - half, centerX + half);
    out[2] = clamp(point[2], centerZ - half, centerZ + half);
    out[1] = sampleHeight(mesh, cell, out[0], out[2]);
    return out;
}
