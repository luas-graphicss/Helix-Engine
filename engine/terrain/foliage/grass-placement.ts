import * as vec3 from '@/engine/core/math/vec3';
import { clamp } from '@/engine/core/math/scalar';
import type { GridRegion } from '@/engine/terrain/core/heightfield';
import type { Terrain } from '@/engine/terrain/core/terrain';
import type { TerrainMaterial } from '@/engine/terrain/materials/terrain-material';
import { MAX_GRASS_DENSITY } from './grass-settings';
export const GRASS_CHUNK_SIZE = 8;
export const GRASS_INSTANCE_BYTES = 24;
const INSTANCE_FLOATS = GRASS_INSTANCE_BYTES / 4;
export const HEIGHT_SCALE_MIN = 0.3;
export const HEIGHT_SCALE_RANGE = 1.4;
export const WIDTH_SCALE_MIN = 0.7;
export const WIDTH_SCALE_RANGE = 0.6;
const MIN_DENSITY = 0.03;
const ROOT_SINK = 0.02;
const FIELD_STEP = 0.5;
const FIELD_SAMPLES = GRASS_CHUNK_SIZE / FIELD_STEP + 1;
const CLUMP_SIZE = 0.55;
const CLUMP_RADIUS = 0.42;
export const GRASS_CLUMP_REACH = CLUMP_SIZE;
const CLUMP_CELLS = Math.ceil(GRASS_CHUNK_SIZE / CLUMP_SIZE) + 1;
const CLUMP_FLOATS = 7;
const TWO_PI = Math.PI * 2;
export interface GrassTier {
    readonly maxDistance: number;
    readonly fraction: number;
    readonly segments: number;
}
export const GRASS_TIERS: readonly GrassTier[] = [
    { maxDistance: 20, fraction: 1, segments: 5 },
    { maxDistance: 42, fraction: 0.6, segments: 3 },
    { maxDistance: Infinity, fraction: 0.2, segments: 2 },
];
export function grassTierForDistance(distance: number): number {
    for (let i = 0; i < GRASS_TIERS.length - 1; i++)
        if (distance < GRASS_TIERS[i].maxDistance)
            return i;
    return GRASS_TIERS.length - 1;
}
export interface GrassChunkData {
    readonly bytes: Uint8Array;
    readonly count: number;
    readonly minY: number;
    readonly maxY: number;
}
export function materialSupportsGrass(material: Pick<TerrainMaterial, 'foliage' | 'category'>): boolean {
    return material.foliage === 'grass' || material.category === 'soil';
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
function hashCell(cellX: number, cellZ: number, salt: number): number {
    let h = Math.imul(cellX, 0x27d4eb2d) ^ Math.imul(cellZ, 0x165667b1) ^ Math.imul(salt + 1, 0x9e3779b1);
    h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function grassChunksPerSide(terrain: Terrain): number {
    return Math.ceil(terrain.size / GRASS_CHUNK_SIZE);
}
export function grassCandidateCount(density: number): number {
    return Math.round(clamp(density, 0, MAX_GRASS_DENSITY) * GRASS_CHUNK_SIZE * GRASS_CHUNK_SIZE);
}
export function grassLayersKey(terrain: Terrain): string {
    let key = '';
    for (const layer of terrain.layers) {
        key += `${layer.material.id}:${materialSupportsGrass(layer.material) ? 1 : 0}:${layer.tint[0].toFixed(3)},${layer.tint[1].toFixed(3)},${layer.tint[2].toFixed(3)};`;
    }
    return key;
}
export function grassChunksForRegion(terrain: Terrain, region: GridRegion, resolution: number, out: GridRegion): GridRegion {
    const metersPerSample = terrain.size / (resolution - 1);
    const last = grassChunksPerSide(terrain) - 1;
    out.x0 = clamp(Math.floor((region.x0 * metersPerSample) / GRASS_CHUNK_SIZE) - 1, 0, last);
    out.z0 = clamp(Math.floor((region.z0 * metersPerSample) / GRASS_CHUNK_SIZE) - 1, 0, last);
    out.x1 = clamp(Math.floor((region.x1 * metersPerSample) / GRASS_CHUNK_SIZE) + 1, 0, last);
    out.z1 = clamp(Math.floor((region.z1 * metersPerSample) / GRASS_CHUNK_SIZE) + 1, 0, last);
    return out;
}
export class GrassScratch {
    buffer = new ArrayBuffer(0);
    floats = new Float32Array(this.buffer);
    bytes = new Uint8Array(this.buffer);
    readonly fieldDensity = new Float32Array(FIELD_SAMPLES * FIELD_SAMPLES);
    readonly fieldSlope = new Float32Array(FIELD_SAMPLES * FIELD_SAMPLES);
    readonly fieldColor = new Uint8Array(FIELD_SAMPLES * FIELD_SAMPLES * 3);
    readonly clumps = new Float32Array(CLUMP_CELLS * CLUMP_CELLS * CLUMP_FLOATS);
    readonly weights = new Float32Array(8);
    readonly normal = vec3.create();
    reserve(candidates: number): void {
        const bytes = candidates * GRASS_INSTANCE_BYTES;
        if (this.buffer.byteLength >= bytes)
            return;
        this.buffer = new ArrayBuffer(bytes);
        this.floats = new Float32Array(this.buffer);
        this.bytes = new Uint8Array(this.buffer);
    }
}
function linearToSrgbByte(value: number): number {
    const srgb = value <= 0.0031308 ? value * 12.92 : 1.055 * Math.pow(value, 1 / 2.4) - 0.055;
    return Math.round(clamp(srgb, 0, 1) * 255);
}
function sampleWeights(terrain: Terrain, x: number, z: number, out: Float32Array): void {
    const { splat } = terrain;
    const last = splat.resolution - 1;
    const tx = clamp(terrain.localToSplat(x), 0, last);
    const tz = clamp(terrain.localToSplat(z), 0, last);
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
function sampleField(terrain: Terrain, originX: number, originZ: number, scratch: GrassScratch): boolean {
    const { layers, grassMap, halfSize } = terrain;
    const { fieldDensity, fieldSlope, fieldColor, weights, normal } = scratch;
    const supports: boolean[] = [];
    for (const layer of layers)
        supports.push(materialSupportsGrass(layer.material));
    let any = false;
    for (let iz = 0; iz < FIELD_SAMPLES; iz++) {
        const z = clamp(originZ + iz * FIELD_STEP, -halfSize, halfSize);
        for (let ix = 0; ix < FIELD_SAMPLES; ix++) {
            const x = clamp(originX + ix * FIELD_STEP, -halfSize, halfSize);
            const index = iz * FIELD_SAMPLES + ix;
            const painted = grassMap.sample(terrain.localToGrassTexel(x), terrain.localToGrassTexel(z));
            sampleWeights(terrain, x, z, weights);
            let total = 0;
            let support = 0;
            let r = 0;
            let g = 0;
            let b = 0;
            for (let i = 0; i < layers.length; i++) {
                const w = weights[i];
                if (w <= 0)
                    continue;
                const layer = layers[i];
                const color = layer.material.averageColor;
                total += w;
                if (supports[i])
                    support += w;
                r += color[0] * layer.tint[0] * w;
                g += color[1] * layer.tint[1] * w;
                b += color[2] * layer.tint[2] * w;
            }
            if (total > 0) {
                const inv = 1 / total;
                fieldDensity[index] = painted * support * inv;
                fieldColor[index * 3] = linearToSrgbByte(r * inv);
                fieldColor[index * 3 + 1] = linearToSrgbByte(g * inv);
                fieldColor[index * 3 + 2] = linearToSrgbByte(b * inv);
            }
            else {
                fieldDensity[index] = 0;
                fieldColor[index * 3] = 0;
                fieldColor[index * 3 + 1] = 0;
                fieldColor[index * 3 + 2] = 0;
            }
            if (fieldDensity[index] >= MIN_DENSITY)
                any = true;
            terrain.normalAtLocal(normal, x, z);
            fieldSlope[index] = normal[1];
        }
    }
    return any;
}
function sampleClumps(firstCellX: number, firstCellZ: number, out: Float32Array): void {
    for (let iz = 0; iz < CLUMP_CELLS; iz++) {
        const cellZ = firstCellZ + iz;
        for (let ix = 0; ix < CLUMP_CELLS; ix++) {
            const cellX = firstCellX + ix;
            const offset = (iz * CLUMP_CELLS + ix) * CLUMP_FLOATS;
            out[offset] = (cellX + 0.5 + (hashCell(cellX, cellZ, 0) - 0.5) * 0.9) * CLUMP_SIZE;
            out[offset + 1] = (cellZ + 0.5 + (hashCell(cellX, cellZ, 1) - 0.5) * 0.9) * CLUMP_SIZE;
            out[offset + 2] = CLUMP_SIZE * CLUMP_RADIUS * (0.7 + hashCell(cellX, cellZ, 2) * 0.6);
            out[offset + 3] = hashCell(cellX, cellZ, 3) * TWO_PI;
            out[offset + 4] = 0.75 + hashCell(cellX, cellZ, 4) * 0.5;
            out[offset + 5] = hashCell(cellX, cellZ, 5);
            out[offset + 6] = hashCell(cellX, cellZ, 6);
        }
    }
}
function bilinear(field: ArrayLike<number>, x0: number, z0: number, fx: number, fz: number, stride: number, channel: number): number {
    const row0 = z0 * FIELD_SAMPLES + x0;
    const row1 = row0 + FIELD_SAMPLES;
    const top = field[row0 * stride + channel] * (1 - fx) + field[(row0 + 1) * stride + channel] * fx;
    const bottom = field[row1 * stride + channel] * (1 - fx) + field[(row1 + 1) * stride + channel] * fx;
    return top * (1 - fz) + bottom * fz;
}
export function buildGrassChunk(terrain: Terrain, chunkX: number, chunkZ: number, scratch: GrassScratch, candidateLimit: number): GrassChunkData {
    const { grass } = terrain;
    const candidates = Math.min(grassCandidateCount(grass.density), Math.max(candidateLimit, 0));
    scratch.reserve(candidates);
    const { floats, bytes } = scratch;
    if (candidates === 0)
        return { bytes, count: 0, minY: 0, maxY: 0 };
    const originX = -terrain.halfSize + chunkX * GRASS_CHUNK_SIZE;
    const originZ = -terrain.halfSize + chunkZ * GRASS_CHUNK_SIZE;
    if (!sampleField(terrain, originX, originZ, scratch))
        return { bytes, count: 0, minY: 0, maxY: 0 };
    const { fieldDensity, fieldSlope, fieldColor, clumps } = scratch;
    const firstCellX = Math.floor(originX / CLUMP_SIZE);
    const firstCellZ = Math.floor(originZ / CLUMP_SIZE);
    sampleClumps(firstCellX, firstCellZ, clumps);
    const random = createRandom((chunkX * 73856093) ^ (chunkZ * 19349663) ^ 0x5bd1e995);
    const minNormalY = Math.cos((clamp(grass.maxSlope, 0, 89) * Math.PI) / 180);
    const variation = clamp(grass.heightVariation, 0, 1);
    const clumping = clamp(grass.clumping, 0, 1);
    const yawSpread = TWO_PI * (1 - 0.8 * clumping);
    const lastField = FIELD_SAMPLES - 1;
    const invStep = 1 / FIELD_STEP;
    const invClump = 1 / CLUMP_SIZE;
    let count = 0;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < candidates; i++) {
        const ux = originX + random() * GRASS_CHUNK_SIZE;
        const uz = originZ + random() * GRASS_CHUNK_SIZE;
        const acceptance = random();
        const offsetX = random() + random() - 1;
        const offsetZ = random() + random() - 1;
        const yawRoll = random();
        const heightRoll = random();
        const bendRoll = random();
        const colorRoll = random();
        const phase = random();
        const widthRoll = random();
        const cellX = Math.floor(ux * invClump);
        const cellZ = Math.floor(uz * invClump);
        const clump = ((cellZ - firstCellZ) * CLUMP_CELLS + (cellX - firstCellX)) * CLUMP_FLOATS;
        const radius = clumps[clump + 2];
        const x = ux + (clumps[clump] + offsetX * radius - ux) * clumping;
        const z = uz + (clumps[clump + 1] + offsetZ * radius - uz) * clumping;
        if (!terrain.containsLocal(x, z))
            continue;
        const gx = clamp((x - originX) * invStep, 0, lastField - 1e-4);
        const gz = clamp((z - originZ) * invStep, 0, lastField - 1e-4);
        const x0 = Math.floor(gx);
        const z0 = Math.floor(gz);
        const fx = gx - x0;
        const fz = gz - z0;
        const density = bilinear(fieldDensity, x0, z0, fx, fz, 1, 0);
        if (density < MIN_DENSITY || acceptance > density)
            continue;
        if (bilinear(fieldSlope, x0, z0, fx, fz, 1, 0) < minNormalY)
            continue;
        const y = terrain.heightAtLocal(x, z) - ROOT_SINK;
        const yaw = clumps[clump + 3] + (yawRoll - 0.5) * yawSpread;
        const heightScale = (1 + (heightRoll * 2 - 1) * variation) * (1 + (clumps[clump + 4] - 1) * clumping);
        const floatOffset = count * INSTANCE_FLOATS;
        floats[floatOffset] = x;
        floats[floatOffset + 1] = y;
        floats[floatOffset + 2] = z;
        floats[floatOffset + 3] = yaw;
        const byteOffset = count * GRASS_INSTANCE_BYTES + 16;
        bytes[byteOffset] = Math.round(clamp((heightScale - HEIGHT_SCALE_MIN) / HEIGHT_SCALE_RANGE, 0, 1) * 255);
        bytes[byteOffset + 1] = Math.round((bendRoll * 0.5 + clumps[clump + 6] * 0.5) * 255);
        bytes[byteOffset + 2] = Math.round((colorRoll * 0.25 + clumps[clump + 5] * 0.75) * 255);
        bytes[byteOffset + 3] = Math.round(phase * 255);
        bytes[byteOffset + 4] = Math.round(bilinear(fieldColor, x0, z0, fx, fz, 3, 0));
        bytes[byteOffset + 5] = Math.round(bilinear(fieldColor, x0, z0, fx, fz, 3, 1));
        bytes[byteOffset + 6] = Math.round(bilinear(fieldColor, x0, z0, fx, fz, 3, 2));
        bytes[byteOffset + 7] = Math.round(widthRoll * 255);
        count++;
        if (y < minY)
            minY = y;
        if (y > maxY)
            maxY = y;
    }
    if (count === 0)
        return { bytes, count: 0, minY: 0, maxY: 0 };
    return { bytes, count, minY, maxY };
}
