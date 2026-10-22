import { clamp } from '@/engine/core/math/scalar';
import type { GridRegion } from '@/engine/terrain/core/heightfield';
export class GrassMap {
    readonly data: Uint8Array;
    constructor(readonly resolution: number, data?: Uint8Array) {
        this.data = data ?? new Uint8Array(resolution * resolution);
        if (this.data.length !== resolution * resolution)
            throw new Error('O tamanho do mapa de grama não corresponde à resolução.');
    }
    density(tx: number, tz: number): number {
        const last = this.resolution - 1;
        return this.data[clamp(tz, 0, last) * this.resolution + clamp(tx, 0, last)] / 255;
    }
    sample(tx: number, tz: number): number {
        const last = this.resolution - 1;
        const cx = clamp(tx, 0, last);
        const cz = clamp(tz, 0, last);
        const x0 = Math.min(Math.floor(cx), last - 1);
        const z0 = Math.min(Math.floor(cz), last - 1);
        const fx = cx - x0;
        const fz = cz - z0;
        const row0 = z0 * this.resolution + x0;
        const row1 = row0 + this.resolution;
        const d = this.data;
        const top = d[row0] + (d[row0 + 1] - d[row0]) * fx;
        const bottom = d[row1] + (d[row1 + 1] - d[row1]) * fx;
        return (top + (bottom - top) * fz) / 255;
    }
    add(tx: number, tz: number, amount: number): void {
        const index = tz * this.resolution + tx;
        this.data[index] = Math.round(clamp(this.data[index] + amount * 255, 0, 255));
    }
    fill(density: number): void {
        this.data.fill(Math.round(clamp(density, 0, 1) * 255));
    }
    isEmpty(): boolean {
        for (const value of this.data)
            if (value > 0)
                return false;
        return true;
    }
    clone(): GrassMap {
        return new GrassMap(this.resolution, new Uint8Array(this.data));
    }
    copyFrom(other: GrassMap): void {
        this.data.set(other.data);
    }
    copyRegion(region: GridRegion): Uint8Array {
        const width = region.x1 - region.x0 + 1;
        const height = region.z1 - region.z0 + 1;
        const out = new Uint8Array(Math.max(width * height, 0));
        for (let z = 0; z < height; z++) {
            const source = (region.z0 + z) * this.resolution + region.x0;
            out.set(this.data.subarray(source, source + width), z * width);
        }
        return out;
    }
    pasteRegion(region: GridRegion, block: Uint8Array): void {
        const width = region.x1 - region.x0 + 1;
        const height = region.z1 - region.z0 + 1;
        for (let z = 0; z < height; z++) {
            const target = (region.z0 + z) * this.resolution + region.x0;
            this.data.set(block.subarray(z * width, (z + 1) * width), target);
        }
    }
    resampled(resolution: number): GrassMap {
        const result = new GrassMap(resolution);
        const scale = (this.resolution - 1) / (resolution - 1);
        for (let tz = 0; tz < resolution; tz++) {
            for (let tx = 0; tx < resolution; tx++) {
                result.data[tz * resolution + tx] = Math.round(this.sample(tx * scale, tz * scale) * 255);
            }
        }
        return result;
    }
}
