import { perlin2 } from '@/engine/core/noise/perlin';
import { clamp, lerp } from '@/engine/core/math/scalar';
import type { GridRegion, Heightfield } from '@/engine/terrain/core/heightfield';
import { falloffWeight, type BrushFalloff } from './brush';
export interface Stamp {
    cx: number;
    cz: number;
    radius: number;
    falloff: BrushFalloff;
    region: GridRegion;
}
type CellVisitor = (index: number, x: number, z: number, weight: number) => void;
export function forEachStampCell(heightfield: Heightfield, stamp: Stamp, visit: CellVisitor): void {
    const { resolution } = heightfield;
    const invRadius = 1 / Math.max(stamp.radius, 1e-6);
    for (let z = stamp.region.z0; z <= stamp.region.z1; z++) {
        const dz = (z - stamp.cz) * invRadius;
        for (let x = stamp.region.x0; x <= stamp.region.x1; x++) {
            const dx = (x - stamp.cx) * invRadius;
            const weight = falloffWeight(Math.hypot(dx, dz), stamp.falloff);
            if (weight > 0)
                visit(z * resolution + x, x, z, weight);
        }
    }
}
export function sculptRaise(heightfield: Heightfield, stamp: Stamp, delta: number): void {
    const { heights } = heightfield;
    forEachStampCell(heightfield, stamp, (index, _x, _z, weight) => {
        heights[index] += delta * weight;
    });
}
class RegionSnapshot {
    private data = new Float32Array(0);
    private x0 = 0;
    private z0 = 0;
    private x1 = 0;
    private z1 = 0;
    private width = 0;
    capture(heightfield: Heightfield, region: GridRegion): void {
        const last = heightfield.resolution - 1;
        this.x0 = Math.max(region.x0 - 1, 0);
        this.z0 = Math.max(region.z0 - 1, 0);
        this.x1 = Math.min(region.x1 + 1, last);
        this.z1 = Math.min(region.z1 + 1, last);
        this.width = this.x1 - this.x0 + 1;
        const rows = this.z1 - this.z0 + 1;
        if (this.data.length < this.width * rows)
            this.data = new Float32Array(this.width * rows);
        for (let z = 0; z < rows; z++) {
            const source = (this.z0 + z) * heightfield.resolution + this.x0;
            this.data.set(heightfield.heights.subarray(source, source + this.width), z * this.width);
        }
    }
    get(x: number, z: number): number {
        const cx = clamp(x, this.x0, this.x1) - this.x0;
        const cz = clamp(z, this.z0, this.z1) - this.z0;
        return this.data[cz * this.width + cx];
    }
}
const snapshot = new RegionSnapshot();
export function sculptSmooth(heightfield: Heightfield, stamp: Stamp, amount: number): void {
    const { heights } = heightfield;
    snapshot.capture(heightfield, stamp.region);
    forEachStampCell(heightfield, stamp, (index, x, z, weight) => {
        let sum = 0;
        for (let oz = -1; oz <= 1; oz++) {
            for (let ox = -1; ox <= 1; ox++)
                sum += snapshot.get(x + ox, z + oz);
        }
        heights[index] = lerp(heights[index], sum / 9, clamp(amount * weight, 0, 1));
    });
}
export function sculptFlatten(heightfield: Heightfield, stamp: Stamp, target: number, amount: number): void {
    const { heights } = heightfield;
    forEachStampCell(heightfield, stamp, (index, _x, _z, weight) => {
        heights[index] = lerp(heights[index], target, clamp(amount * weight, 0, 1));
    });
}
export function sculptNoise(heightfield: Heightfield, stamp: Stamp, amplitude: number, scaleCells: number, seed: number): void {
    const { heights } = heightfield;
    const frequency = 1 / Math.max(scaleCells, 0.5);
    forEachStampCell(heightfield, stamp, (index, x, z, weight) => {
        let value = 0;
        let octaveAmplitude = 1;
        let octaveFrequency = frequency;
        for (let octave = 0; octave < 4; octave++) {
            value += perlin2(x * octaveFrequency, z * octaveFrequency, 1 << 20, seed + octave * 13) * octaveAmplitude;
            octaveAmplitude *= 0.5;
            octaveFrequency *= 2;
        }
        heights[index] += value * (amplitude / 1.875) * weight;
    });
}
export function sculptTerrace(heightfield: Heightfield, stamp: Stamp, step: number, amount: number): void {
    const { heights } = heightfield;
    const size = Math.max(step, 0.01);
    forEachStampCell(heightfield, stamp, (index, _x, _z, weight) => {
        const target = Math.round(heights[index] / size) * size;
        heights[index] = lerp(heights[index], target, clamp(amount * weight, 0, 1));
    });
}
export function erodeThermal(heightfield: Heightfield, region: GridRegion, cellSize: number, talusSlope: number, amount: number, weightAt?: (x: number, z: number) => number): void {
    const { heights, resolution } = heightfield;
    snapshot.capture(heightfield, region);
    const talus = talusSlope * cellSize;
    const last = resolution - 1;
    const rate = clamp(amount, 0, 0.5);
    for (let z = region.z0; z <= region.z1; z++) {
        for (let x = region.x0; x <= region.x1; x++) {
            const weight = weightAt ? weightAt(x, z) : 1;
            if (weight <= 0)
                continue;
            const center = snapshot.get(x, z);
            let totalDrop = 0;
            let maxDrop = 0;
            for (let k = 0; k < 4; k++) {
                const drop = center - snapshot.get(x + NEIGHBOR_X[k], z + NEIGHBOR_Z[k]) - talus;
                if (drop > 0) {
                    totalDrop += drop;
                    if (drop > maxDrop)
                        maxDrop = drop;
                }
            }
            if (totalDrop <= 0)
                continue;
            const moved = maxDrop * rate * weight;
            heights[z * resolution + x] -= moved;
            for (let k = 0; k < 4; k++) {
                const nx = clamp(x + NEIGHBOR_X[k], 0, last);
                const nz = clamp(z + NEIGHBOR_Z[k], 0, last);
                const drop = center - snapshot.get(nx, nz) - talus;
                if (drop > 0)
                    heights[nz * resolution + nx] += moved * (drop / totalDrop);
            }
        }
    }
}
const NEIGHBOR_X = [1, -1, 0, 0];
const NEIGHBOR_Z = [0, 0, 1, -1];
