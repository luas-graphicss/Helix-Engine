export interface NavGrid {
    readonly originX: number;
    readonly originZ: number;
    readonly cellSize: number;
    readonly width: number;
    readonly depth: number;
}
export function gridColumn(grid: NavGrid, x: number): number {
    return Math.floor((x - grid.originX) / grid.cellSize);
}
export function gridRow(grid: NavGrid, z: number): number {
    return Math.floor((z - grid.originZ) / grid.cellSize);
}
export function isInsideGrid(grid: NavGrid, column: number, row: number): boolean {
    return column >= 0 && row >= 0 && column < grid.width && row < grid.depth;
}
