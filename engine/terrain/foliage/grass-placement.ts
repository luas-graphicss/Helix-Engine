import * as vec3 from '@/engine/core/math/vec3';
import type { Terrain } from '@/engine/terrain/core/terrain';
export const GRASS_CHUNK_SIZE = 8;
export const GRASS_INSTANCE_FLOATS = 12;
const MIN_WEIGHT = 0.06;
const ROOT_SINK = 0.02;
const MAX_DENSITY = 80;
export interface GrassChunkData {
    readonly data: Float32Array;
    readonly count: number;
    readonly minY: number;
    readonly maxY: number;
}
function createRandom(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
export function grassChunksPerSide(terrain: Terrain): number {
    return Math.ceil(terrain.size / GRASS_CHUNK_SIZE);
}
export function grassCandidateCount(density: number): number {
    return Math.round(Math.min(Math.max(density, 0), MAX_DENSITY) * GRASS_CHUNK_SIZE * GRASS_CHUNK_SIZE);
}
const scratchNormal = vec3.create();
const scratchWeights = new Float32Array(8);
function sampleWeights(terrain: Terrain, x: number, z: number, out: Float32Array): void {
    const { splat } = terrain;
    const last = splat.resolution - 1;
    const tx = Math.min(Math.max(terrain.localToSplat(x), 0), last);
    const tz = Math.min(Math.max(terrain.localToSplat(z), 0), last);
    const x0 = Math.floor(tx);
    const z0 = Math.floor(tz);
    const x1 = Math.min(x0 + 1, last);
    const z1 = Math.min(z0 + 1, last);
    const fx = tx - x0;
    const fz = tz - z0;
    const layers = terrain.layers.length;
    for (let layer = 0; layer < layers; layer++) {
        const top = splat.weight(x0, z0, layer) * (1 - fx) + splat.weight(x1, z0, layer) * fx;
        const bottom = splat.weight(x0, z1, layer) * (1 - fx) + splat.weight(x1, z1, layer) * fx;
        out[layer] = top * (1 - fz) + bottom * fz;
    }
}
export function buildGrassChunk(terrain: Terrain, chunkX: number, chunkZ: number, scratch: Float32Array | null): GrassChunkData {
    const { grass, layers } = terrain;
    const foliageLayers: number[] = [];
    for (let i = 0; i < layers.length; i++)
        if (layers[i].material.foliage)
            foliageLayers.push(i);
    const candidates = grassCandidateCount(grass.density);
    const floats = candidates * GRASS_INSTANCE_FLOATS;
    const data = scratch && scratch.length >= floats ? scratch : new Float32Array(floats);
    if (foliageLayers.length === 0 || candidates === 0)
        return { data, count: 0, minY: 0, maxY: 0 };
    const random = createRandom(chunkX * 73856093 ^ chunkZ * 19349663 ^ 0x5bd1e995);
    const originX = -terrain.halfSize + chunkX * GRASS_CHUNK_SIZE;
    const originZ = -terrain.halfSize + chunkZ * GRASS_CHUNK_SIZE;
    const minNormalY = Math.cos((Math.min(Math.max(grass.maxSlope, 0), 89) * Math.PI) / 180);
    const variation = Math.min(Math.max(grass.heightVariation, 0), 1);
    let count = 0;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < candidates; i++) {
        const x = originX + random() * GRASS_CHUNK_SIZE;
        const z = originZ + random() * GRASS_CHUNK_SIZE;
        const acceptance = random();
        const yaw = random() * Math.PI * 2;
        const heightRoll = random();
        const bend = random();
        const colorVariation = random();
        const phase = random() * Math.PI * 2;
        if (!terrain.containsLocal(x, z))
            continue;
        sampleWeights(terrain, x, z, scratchWeights);
        let weight = 0;
        let bestLayer = foliageLayers[0];
        let bestWeight = -1;
        for (const layer of foliageLayers) {
            const w = scratchWeights[layer];
            weight += w;
            if (w > bestWeight) {
                bestWeight = w;
                bestLayer = layer;
            }
        }
        if (weight < MIN_WEIGHT || acceptance > weight)
            continue;
        terrain.normalAtLocal(scratchNormal, x, z);
        if (scratchNormal[1] < minNormalY)
            continue;
        const y = terrain.heightAtLocal(x, z) - ROOT_SINK;
        const layer = layers[bestLayer];
        const color = layer.material.averageColor;
        const offset = count * GRASS_INSTANCE_FLOATS;
        data[offset] = x;
        data[offset + 1] = y;
        data[offset + 2] = z;
        data[offset + 3] = yaw;
        data[offset + 4] = Math.max(1 + (heightRoll * 2 - 1) * variation, 0.25);
        data[offset + 5] = bend;
        data[offset + 6] = colorVariation;
        data[offset + 7] = phase;
        data[offset + 8] = color[0] * layer.tint[0];
        data[offset + 9] = color[1] * layer.tint[1];
        data[offset + 10] = color[2] * layer.tint[2];
        data[offset + 11] = 0;
        count++;
        if (y < minY)
            minY = y;
        if (y > maxY)
            maxY = y;
    }
    if (count === 0)
        return { data, count: 0, minY: 0, maxY: 0 };
    return { data, count, minY, maxY };
}
