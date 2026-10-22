import type { Vec3 } from '@/engine/core/math/vec3';
import { clamp } from '@/engine/core/math/scalar';
export interface GridRegion {
    x0: number;
    z0: number;
    x1: number;
    z1: number;
}
export function createRegion(x0 = 0, z0 = 0, x1 = -1, z1 = -1): GridRegion {
    return { x0, z0, x1, z1 };
}
export function isRegionEmpty(region: GridRegion): boolean {
    return region.x1 < region.x0 || region.z1 < region.z0;
}
export function unionRegion(out: GridRegion, other: GridRegion): GridRegion {
    if (isRegionEmpty(other))
        return out;
    if (isRegionEmpty(out)) {
        out.x0 = other.x0;
        out.z0 = other.z0;
        out.x1 = other.x1;
        out.z1 = other.z1;
        return out;
    }
    out.x0 = Math.min(out.x0, other.x0);
    out.z0 = Math.min(out.z0, other.z0);
    out.x1 = Math.max(out.x1, other.x1);
    out.z1 = Math.max(out.z1, other.z1);
    return out;
}
export function clampRegion(out: GridRegion, resolution: number, padding = 0): GridRegion {
    out.x0 = Math.max(out.x0 - padding, 0);
    out.z0 = Math.max(out.z0 - padding, 0);
    out.x1 = Math.min(out.x1 + padding, resolution - 1);
    out.z1 = Math.min(out.z1 + padding, resolution - 1);
    return out;
}
export function cellDiagonalFrom00(cellX: number, cellZ: number): boolean {
    return ((cellX + cellZ) & 1) === 1;
}
export class Heightfield {
    readonly heights: Float32Array;
    constructor(readonly resolution: number, heights?: Float32Array) {
        if (!Number.isInteger(resolution) || resolution < 2)
            throw new Error('A resolução do heightfield precisa ser um inteiro ≥ 2.');
        this.heights = heights ?? new Float32Array(resolution * resolution);
        if (this.heights.length !== resolution * resolution)
            throw new Error('O tamanho do array de alturas não corresponde à resolução.');
    }
    get(x: number, z: number): number {
        const last = this.resolution - 1;
        return this.heights[clamp(z, 0, last) * this.resolution + clamp(x, 0, last)];
    }
    set(x: number, z: number, height: number): void {
        this.heights[z * this.resolution + x] = height;
    }
    sample(gx: number, gz: number): number {
        const last = this.resolution - 1;
        const cx = clamp(gx, 0, last);
        const cz = clamp(gz, 0, last);
        const x0 = Math.min(Math.floor(cx), last - 1);
        const z0 = Math.min(Math.floor(cz), last - 1);
        const fx = cx - x0;
        const fz = cz - z0;
        const row0 = z0 * this.resolution + x0;
        const row1 = row0 + this.resolution;
        const h = this.heights;
        const top = h[row0] + (h[row0 + 1] - h[row0]) * fx;
        const bottom = h[row1] + (h[row1 + 1] - h[row1]) * fx;
        return top + (bottom - top) * fz;
    }
    sampleTriangulated(gx: number, gz: number): number {
        const last = this.resolution - 1;
        const cx = clamp(gx, 0, last);
        const cz = clamp(gz, 0, last);
        const x0 = Math.min(Math.floor(cx), last - 1);
        const z0 = Math.min(Math.floor(cz), last - 1);
        const fx = cx - x0;
        const fz = cz - z0;
        const row0 = z0 * this.resolution + x0;
        const row1 = row0 + this.resolution;
        const h = this.heights;
        const h00 = h[row0];
        const h10 = h[row0 + 1];
        const h01 = h[row1];
        const h11 = h[row1 + 1];
        if (cellDiagonalFrom00(x0, z0)) {
            return fz >= fx ? h00 + (h11 - h01) * fx + (h01 - h00) * fz : h00 + (h10 - h00) * fx + (h11 - h10) * fz;
        }
        return fx + fz <= 1 ? h00 + (h10 - h00) * fx + (h01 - h00) * fz : h11 + (h01 - h11) * (1 - fx) + (h10 - h11) * (1 - fz);
    }
    normalAt(out: Vec3, gx: number, gz: number, cellSize: number): Vec3 {
        const dx = (this.sample(gx + 1, gz) - this.sample(gx - 1, gz)) / (2 * cellSize);
        const dz = (this.sample(gx, gz + 1) - this.sample(gx, gz - 1)) / (2 * cellSize);
        const inv = 1 / Math.hypot(dx, 1, dz);
        out[0] = -dx * inv;
        out[1] = inv;
        out[2] = -dz * inv;
        return out;
    }
    slopeAt(x: number, z: number, cellSize: number): number {
        const dx = (this.get(x + 1, z) - this.get(x - 1, z)) / (2 * cellSize);
        const dz = (this.get(x, z + 1) - this.get(x, z - 1)) / (2 * cellSize);
        return Math.atan(Math.hypot(dx, dz));
    }
    minMax(): [
        number,
        number
    ] {
        let min = Infinity;
        let max = -Infinity;
        for (const value of this.heights) {
            if (value < min)
                min = value;
            if (value > max)
                max = value;
        }
        return min === Infinity ? [0, 0] : [min, max];
    }
    fill(height: number): void {
        this.heights.fill(height);
    }
    clone(): Heightfield {
        return new Heightfield(this.resolution, new Float32Array(this.heights));
    }
    copyRegion(region: GridRegion): Float32Array {
        const width = region.x1 - region.x0 + 1;
        const height = region.z1 - region.z0 + 1;
        const out = new Float32Array(Math.max(width * height, 0));
        for (let z = 0; z < height; z++) {
            const source = (region.z0 + z) * this.resolution + region.x0;
            out.set(this.heights.subarray(source, source + width), z * width);
        }
        return out;
    }
    pasteRegion(region: GridRegion, data: Float32Array): void {
        const width = region.x1 - region.x0 + 1;
        const height = region.z1 - region.z0 + 1;
        for (let z = 0; z < height; z++) {
            const target = (region.z0 + z) * this.resolution + region.x0;
            this.heights.set(data.subarray(z * width, (z + 1) * width), target);
        }
    }
    resampled(resolution: number): Heightfield {
        const result = new Heightfield(resolution);
        const scale = (this.resolution - 1) / (resolution - 1);
        for (let z = 0; z < resolution; z++) {
            for (let x = 0; x < resolution; x++) {
                result.heights[z * resolution + x] = this.sample(x * scale, z * scale);
            }
        }
        return result;
    }
}
