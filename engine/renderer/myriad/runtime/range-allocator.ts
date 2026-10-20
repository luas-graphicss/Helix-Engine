export class RangeAllocator {
    private readonly holes: number[] = [];
    used = 0;
    constructor(public capacity: number) {
        if (capacity > 0)
            this.holes.push(0, capacity);
    }
    allocate(size: number): number {
        const { holes } = this;
        for (let i = 0; i < holes.length; i += 2) {
            if (holes[i + 1] < size)
                continue;
            const start = holes[i];
            if (holes[i + 1] === size)
                holes.splice(i, 2);
            else {
                holes[i] += size;
                holes[i + 1] -= size;
            }
            this.used += size;
            return start;
        }
        return -1;
    }
    release(start: number, size: number): void {
        this.insertHole(start, size);
        this.used -= size;
    }
    grow(capacity: number): void {
        if (capacity <= this.capacity)
            return;
        this.insertHole(this.capacity, capacity - this.capacity);
        this.capacity = capacity;
    }
    private insertHole(start: number, size: number): void {
        const { holes } = this;
        let i = 0;
        while (i < holes.length && holes[i] < start)
            i += 2;
        holes.splice(i, 0, start, size);
        if (i + 2 < holes.length && holes[i] + holes[i + 1] === holes[i + 2]) {
            holes[i + 1] += holes[i + 3];
            holes.splice(i + 2, 2);
        }
        if (i >= 2 && holes[i - 2] + holes[i - 1] === holes[i]) {
            holes[i - 1] += holes[i + 1];
            holes.splice(i, 2);
        }
    }
}
