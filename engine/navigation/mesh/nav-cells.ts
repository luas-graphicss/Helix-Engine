import type { NavGrid } from './nav-grid';
export const NO_CELL = -1;
export const NULL_AREA = 255;
export const WEST = 0;
export const NORTH = 1;
export const EAST = 2;
export const SOUTH = 3;
export const DIRECTION_COUNT = 4;
export const DIRECTION_X: readonly number[] = [-1, 0, 1, 0];
export const DIRECTION_Z: readonly number[] = [0, 1, 0, -1];
export class NavCells {
    readonly count: number;
    readonly links: Int32Array;
    constructor(readonly grid: NavGrid, readonly columnStart: Uint32Array, readonly cellColumn: Uint32Array, readonly heights: Float32Array, readonly areas: Uint8Array) {
        this.count = heights.length;
        this.links = new Int32Array(this.count * DIRECTION_COUNT).fill(NO_CELL);
    }
    columnX(cell: number): number {
        return this.cellColumn[cell] % this.grid.width;
    }
    columnZ(cell: number): number {
        return Math.floor(this.cellColumn[cell] / this.grid.width);
    }
    centerX(cell: number): number {
        return this.grid.originX + (this.columnX(cell) + 0.5) * this.grid.cellSize;
    }
    centerZ(cell: number): number {
        return this.grid.originZ + (this.columnZ(cell) + 0.5) * this.grid.cellSize;
    }
    pruneLinks(): void {
        const { links, areas } = this;
        for (let cell = 0; cell < this.count; cell++) {
            const walkable = areas[cell] !== NULL_AREA;
            for (let direction = 0; direction < DIRECTION_COUNT; direction++) {
                const slot = cell * DIRECTION_COUNT + direction;
                const neighbor = links[slot];
                if (neighbor !== NO_CELL && (!walkable || areas[neighbor] === NULL_AREA))
                    links[slot] = NO_CELL;
            }
        }
    }
}
