import { clamp } from '@/engine/core/math/scalar';
import type { GridRegion } from './heightfield';
export const MAX_TERRAIN_LAYERS = 8;
const CHANNELS = 4;
const PLANE_COUNT = MAX_TERRAIN_LAYERS / CHANNELS;
const scratchWeights = new Float32Array(MAX_TERRAIN_LAYERS);
export class SplatMap {
    readonly planes: readonly [
        Uint8Array,
        Uint8Array
    ];
    constructor(readonly resolution: number, planes?: readonly [
        Uint8Array,
        Uint8Array
    ]) {
        const size = resolution * resolution * CHANNELS;
        this.planes = planes ?? [new Uint8Array(size), new Uint8Array(size)];
        if (!planes)
            this.fillLayer(0);
    }
    weight(tx: number, tz: number, layer: number): number {
        const texel = (tz * this.resolution + tx) * CHANNELS;
        return this.planes[layer >> 2][texel + (layer & 3)] / 255;
    }
    readWeights(out: Float32Array, tx: number, tz: number): Float32Array {
        const texel = (tz * this.resolution + tx) * CHANNELS;
        for (let plane = 0; plane < PLANE_COUNT; plane++) {
            const data = this.planes[plane];
            for (let c = 0; c < CHANNELS; c++)
                out[plane * CHANNELS + c] = data[texel + c] / 255;
        }
        return out;
    }
    writeWeights(tx: number, tz: number, weights: Float32Array): void {
        let total = 0;
        for (let i = 0; i < MAX_TERRAIN_LAYERS; i++)
            total += Math.max(weights[i], 0);
        const scale = total > 1e-6 ? 255 / total : 0;
        const texel = (tz * this.resolution + tx) * CHANNELS;
        for (let plane = 0; plane < PLANE_COUNT; plane++) {
            const data = this.planes[plane];
            for (let c = 0; c < CHANNELS; c++)
                data[texel + c] = Math.round(Math.max(weights[plane * CHANNELS + c], 0) * scale);
        }
        if (total <= 1e-6)
            this.planes[0][texel] = 255;
    }
    blend(tx: number, tz: number, layer: number, amount: number): void {
        const weights = this.readWeights(scratchWeights, tx, tz);
        const current = weights[layer];
        const target = amount >= 0 ? current + (1 - current) * amount : current * (1 + amount);
        const others = 1 - current;
        const remaining = 1 - target;
        if (others > 1e-6) {
            const scale = remaining / others;
            for (let i = 0; i < MAX_TERRAIN_LAYERS; i++)
                if (i !== layer)
                    weights[i] *= scale;
        }
        else if (remaining > 1e-6) {
            weights[layer === 0 ? 1 : 0] = remaining;
        }
        weights[layer] = clamp(target, 0, 1);
        this.writeWeights(tx, tz, weights);
    }
    fillLayer(layer: number): void {
        this.planes[0].fill(0);
        this.planes[1].fill(0);
        const data = this.planes[layer >> 2];
        const channel = layer & 3;
        for (let texel = 0; texel < this.resolution * this.resolution; texel++)
            data[texel * CHANNELS + channel] = 255;
    }
    removeLayer(layer: number): void {
        const weights = scratchWeights;
        for (let tz = 0; tz < this.resolution; tz++) {
            for (let tx = 0; tx < this.resolution; tx++) {
                this.readWeights(weights, tx, tz);
                const removed = weights[layer];
                for (let i = layer; i < MAX_TERRAIN_LAYERS - 1; i++)
                    weights[i] = weights[i + 1];
                weights[MAX_TERRAIN_LAYERS - 1] = 0;
                weights[0] += removed;
                this.writeWeights(tx, tz, weights);
            }
        }
    }
    swapLayers(a: number, b: number): void {
        if (a === b)
            return;
        const planeA = this.planes[a >> 2];
        const planeB = this.planes[b >> 2];
        const channelA = a & 3;
        const channelB = b & 3;
        for (let texel = 0; texel < this.resolution * this.resolution; texel++) {
            const indexA = texel * CHANNELS + channelA;
            const indexB = texel * CHANNELS + channelB;
            const value = planeA[indexA];
            planeA[indexA] = planeB[indexB];
            planeB[indexB] = value;
        }
    }
    clone(): SplatMap {
        return new SplatMap(this.resolution, [new Uint8Array(this.planes[0]), new Uint8Array(this.planes[1])]);
    }
    copyFrom(other: SplatMap): void {
        this.planes[0].set(other.planes[0]);
        this.planes[1].set(other.planes[1]);
    }
    resampled(resolution: number): SplatMap {
        const result = new SplatMap(resolution);
        const scale = (this.resolution - 1) / (resolution - 1);
        const last = this.resolution - 1;
        for (let plane = 0; plane < PLANE_COUNT; plane++) {
            const source = this.planes[plane];
            const target = result.planes[plane];
            for (let tz = 0; tz < resolution; tz++) {
                const sz = Math.min(tz * scale, last);
                const z0 = Math.min(Math.floor(sz), last - 1);
                const fz = sz - z0;
                for (let tx = 0; tx < resolution; tx++) {
                    const sx = Math.min(tx * scale, last);
                    const x0 = Math.min(Math.floor(sx), last - 1);
                    const fx = sx - x0;
                    const i00 = (z0 * this.resolution + x0) * CHANNELS;
                    const i10 = i00 + CHANNELS;
                    const i01 = i00 + this.resolution * CHANNELS;
                    const i11 = i01 + CHANNELS;
                    const out = (tz * resolution + tx) * CHANNELS;
                    for (let c = 0; c < CHANNELS; c++) {
                        const top = source[i00 + c] + (source[i10 + c] - source[i00 + c]) * fx;
                        const bottom = source[i01 + c] + (source[i11 + c] - source[i01 + c]) * fx;
                        target[out + c] = Math.round(top + (bottom - top) * fz);
                    }
                }
            }
        }
        return result;
    }
    copyRegion(region: GridRegion): Uint8Array {
        const width = region.x1 - region.x0 + 1;
        const height = region.z1 - region.z0 + 1;
        const rowBytes = width * CHANNELS;
        const out = new Uint8Array(Math.max(rowBytes * height * PLANE_COUNT, 0));
        for (let plane = 0; plane < PLANE_COUNT; plane++) {
            const data = this.planes[plane];
            const planeOffset = plane * rowBytes * height;
            for (let z = 0; z < height; z++) {
                const source = ((region.z0 + z) * this.resolution + region.x0) * CHANNELS;
                out.set(data.subarray(source, source + rowBytes), planeOffset + z * rowBytes);
            }
        }
        return out;
    }
    pasteRegion(region: GridRegion, block: Uint8Array): void {
        const width = region.x1 - region.x0 + 1;
        const height = region.z1 - region.z0 + 1;
        const rowBytes = width * CHANNELS;
        for (let plane = 0; plane < PLANE_COUNT; plane++) {
            const data = this.planes[plane];
            const planeOffset = plane * rowBytes * height;
            for (let z = 0; z < height; z++) {
                const target = ((region.z0 + z) * this.resolution + region.x0) * CHANNELS;
                data.set(block.subarray(planeOffset + z * rowBytes, planeOffset + (z + 1) * rowBytes), target);
            }
        }
    }
}
