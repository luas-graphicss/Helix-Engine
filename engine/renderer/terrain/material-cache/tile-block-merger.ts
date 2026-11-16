export const TILE_BLOCK_FIELDS = 4;
export class TileBlockMerger {
    blocks = new Int32Array(0);
    private marks = new Uint8Array(0);
    private side = 0;
    private marked = 0;
    resize(side: number): void {
        if (side === this.side)
            return;
        this.side = side;
        this.marks = new Uint8Array(side * side);
        this.blocks = new Int32Array(side * side * TILE_BLOCK_FIELDS);
        this.marked = 0;
    }
    mark(slot: number): void {
        if (this.marks[slot] !== 0)
            return;
        this.marks[slot] = 1;
        this.marked++;
    }
    merge(seamX: number, seamZ: number): number {
        const { marks, blocks, side } = this;
        let count = 0;
        for (let z = 0; z < side && this.marked > 0; z++) {
            for (let x = 0; x < side; x++) {
                if (marks[z * side + x] === 0)
                    continue;
                const lastX = this.extendRight(x, z, seamX);
                const lastZ = this.extendDown(x, lastX, z, seamZ);
                this.clear(x, lastX, z, lastZ);
                const offset = count * TILE_BLOCK_FIELDS;
                blocks[offset] = x;
                blocks[offset + 1] = z;
                blocks[offset + 2] = lastX - x + 1;
                blocks[offset + 3] = lastZ - z + 1;
                count++;
                x = lastX;
            }
        }
        return count;
    }
    private extendRight(x: number, z: number, seamX: number): number {
        const { marks, side } = this;
        let lastX = x;
        while (lastX + 1 < side && lastX + 1 !== seamX && marks[z * side + lastX + 1] !== 0)
            lastX++;
        return lastX;
    }
    private extendDown(x: number, lastX: number, z: number, seamZ: number): number {
        let lastZ = z;
        while (lastZ + 1 < this.side && lastZ + 1 !== seamZ && this.rowMarked(x, lastX, lastZ + 1))
            lastZ++;
        return lastZ;
    }
    private rowMarked(x: number, lastX: number, z: number): boolean {
        const { marks, side } = this;
        for (let column = x; column <= lastX; column++) {
            if (marks[z * side + column] === 0)
                return false;
        }
        return true;
    }
    private clear(x: number, lastX: number, z: number, lastZ: number): void {
        const { marks, side } = this;
        for (let row = z; row <= lastZ; row++)
            marks.fill(0, row * side + x, row * side + lastX + 1);
        this.marked -= (lastX - x + 1) * (lastZ - z + 1);
    }
}
