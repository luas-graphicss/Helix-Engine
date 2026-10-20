import { createRegion, unionRegion, type GridRegion } from '@/engine/terrain/core/heightfield';
const CAPACITY = 64;
export class RegionChangeLog {
    version = 0;
    private readonly regions: GridRegion[] = [];
    private readonly versions: number[] = [];
    private head = 0;
    private count = 0;
    constructor() {
        for (let i = 0; i < CAPACITY; i++) {
            this.regions.push(createRegion());
            this.versions.push(0);
        }
    }
    push(region: GridRegion): void {
        this.version++;
        let slot: number;
        if (this.count < CAPACITY) {
            slot = (this.head + this.count) % CAPACITY;
            this.count++;
        }
        else {
            slot = this.head;
            this.head = (this.head + 1) % CAPACITY;
        }
        const stored = this.regions[slot];
        stored.x0 = region.x0;
        stored.z0 = region.z0;
        stored.x1 = region.x1;
        stored.z1 = region.z1;
        this.versions[slot] = this.version;
    }
    reset(): void {
        this.version++;
        this.head = 0;
        this.count = 0;
    }
    collect(sinceVersion: number, out: GridRegion): boolean {
        out.x0 = 0;
        out.z0 = 0;
        out.x1 = -1;
        out.z1 = -1;
        if (sinceVersion >= this.version)
            return true;
        if (sinceVersion < this.version - this.count)
            return false;
        for (let k = 0; k < this.count; k++) {
            const slot = (this.head + k) % CAPACITY;
            if (this.versions[slot] > sinceVersion)
                unionRegion(out, this.regions[slot]);
        }
        return true;
    }
}
