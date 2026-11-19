import { clamp } from '@/engine/core/math/scalar';
import type { Vec3 } from '@/engine/core/math/vec3';
import { EAST, NO_CELL, NORTH, SOUTH, WEST } from './nav-cells';
import { gridColumn, gridRow } from './nav-grid';
import type { NavMesh } from './nav-mesh';
const MAX_HOPS = 64;
const CELL_INSET = 1e-3;
function clampIntoCell(origin: number, cellSize: number, index: number, coordinate: number): number {
    const min = origin + index * cellSize;
    return clamp(coordinate, min + CELL_INSET, min + cellSize - CELL_INSET);
}
export function moveOnMesh(out: Vec3, mesh: NavMesh, cell: number, targetX: number, targetZ: number): number {
    const { cells } = mesh;
    const { grid } = cells;
    const targetColumn = gridColumn(grid, targetX);
    const targetRow = gridRow(grid, targetZ);
    let current = cell;
    let column = cells.columnX(cell);
    let row = cells.columnZ(cell);
    for (let hop = 0; hop < MAX_HOPS && (column !== targetColumn || row !== targetRow); hop++) {
        const stepX = Math.sign(targetColumn - column);
        const stepZ = Math.sign(targetRow - row);
        const alongX = stepX === 0 ? NO_CELL : mesh.walkableLink(current, stepX > 0 ? EAST : WEST);
        if (alongX !== NO_CELL) {
            current = alongX;
            column += stepX;
            continue;
        }
        const alongZ = stepZ === 0 ? NO_CELL : mesh.walkableLink(current, stepZ > 0 ? NORTH : SOUTH);
        if (alongZ === NO_CELL)
            break;
        current = alongZ;
        row += stepZ;
    }
    out[0] = column === targetColumn ? targetX : clampIntoCell(grid.originX, grid.cellSize, column, targetX);
    out[2] = row === targetRow ? targetZ : clampIntoCell(grid.originZ, grid.cellSize, row, targetZ);
    return current;
}
