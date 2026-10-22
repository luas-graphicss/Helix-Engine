import type { GL } from '@/engine/renderer/gl/context';
import type { Terrain } from '@/engine/terrain/core/terrain';
import { createRegion, isRegionEmpty, type GridRegion } from '@/engine/terrain/core/heightfield';
import type { RegionChangeLog } from '@/engine/terrain/chunks/region-change-log';
import { buildGrassChunk, grassCandidateCount, grassChunksForRegion, grassChunksPerSide, grassLayersKey, GrassScratch, GRASS_INSTANCE_BYTES, GRASS_TIERS, } from '@/engine/terrain/foliage/grass-placement';
import { grassPlacementKey } from '@/engine/terrain/foliage/grass-settings';
const RETENTION_FRAMES = 300;
export const UNBUILT_TIER = GRASS_TIERS.length;
export class GrassChunk {
    buffer: WebGLBuffer | null = null;
    count = 0;
    dirty = true;
    tier = UNBUILT_TIER;
    minY = 0;
    maxY = 0;
    constructor(readonly chunkX: number, readonly chunkZ: number) { }
}
export class TerrainGrassResources {
    chunksPerSide = 0;
    chunks: GrassChunk[] = [];
    lastUsedFrame = 0;
    private seenHeights = -1;
    private seenSplat = -1;
    private seenGrass = -1;
    private key = '';
    private readonly region = createRegion();
    private readonly chunkRegion = createRegion();
    constructor(private readonly gl: GL) { }
    sync(terrain: Terrain): void {
        const perSide = grassChunksPerSide(terrain);
        if (perSide !== this.chunksPerSide) {
            this.disposeChunks();
            this.chunksPerSide = perSide;
            this.chunks = new Array<GrassChunk>(perSide * perSide);
            for (let z = 0; z < perSide; z++)
                for (let x = 0; x < perSide; x++)
                    this.chunks[z * perSide + x] = new GrassChunk(x, z);
        }
        const key = `${grassPlacementKey(terrain.grass)}|${grassLayersKey(terrain)}|${terrain.splat.resolution}|${terrain.grassMap.resolution}`;
        if (key !== this.key) {
            this.key = key;
            this.markAll();
        }
        this.seenHeights = this.invalidate(terrain, terrain.heightLog, this.seenHeights, terrain.resolution);
        this.seenSplat = this.invalidate(terrain, terrain.splatLog, this.seenSplat, terrain.splat.resolution);
        this.seenGrass = this.invalidate(terrain, terrain.grassLog, this.seenGrass, terrain.grassMap.resolution);
    }
    build(terrain: Terrain, chunk: GrassChunk, scratch: GrassScratch, tier: number): void {
        const { gl } = this;
        const limit = Math.ceil(grassCandidateCount(terrain.grass.density) * GRASS_TIERS[tier].fraction);
        const result = buildGrassChunk(terrain, chunk.chunkX, chunk.chunkZ, scratch, limit);
        chunk.count = result.count;
        chunk.minY = result.minY;
        chunk.maxY = result.maxY;
        chunk.dirty = false;
        chunk.tier = tier;
        if (result.count > 0) {
            if (!chunk.buffer)
                chunk.buffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, chunk.buffer);
            gl.bufferData(gl.ARRAY_BUFFER, result.bytes.subarray(0, result.count * GRASS_INSTANCE_BYTES), gl.STATIC_DRAW);
            gl.bindBuffer(gl.ARRAY_BUFFER, null);
        }
        else if (chunk.buffer) {
            gl.deleteBuffer(chunk.buffer);
            chunk.buffer = null;
        }
    }
    private invalidate(terrain: Terrain, log: RegionChangeLog, seen: number, resolution: number): number {
        if (seen === log.version)
            return seen;
        const { region, chunkRegion } = this;
        if (!log.collect(seen, region)) {
            this.markAll();
            return log.version;
        }
        if (!isRegionEmpty(region)) {
            grassChunksForRegion(terrain, region, resolution, chunkRegion);
            this.markRegion(chunkRegion);
        }
        return log.version;
    }
    private markAll(): void {
        for (const chunk of this.chunks)
            chunk.dirty = true;
    }
    private markRegion(range: GridRegion): void {
        const { chunksPerSide, chunks } = this;
        for (let z = range.z0; z <= range.z1; z++) {
            for (let x = range.x0; x <= range.x1; x++)
                chunks[z * chunksPerSide + x].dirty = true;
        }
    }
    private disposeChunks(): void {
        for (const chunk of this.chunks)
            if (chunk.buffer)
                this.gl.deleteBuffer(chunk.buffer);
        this.chunks = [];
    }
    dispose(): void {
        this.disposeChunks();
    }
}
export class GrassChunkCache {
    private readonly entries = new Map<Terrain, TerrainGrassResources>();
    private readonly scratch = new GrassScratch();
    private frame = 0;
    constructor(private readonly gl: GL) { }
    resolve(terrain: Terrain): TerrainGrassResources {
        let entry = this.entries.get(terrain);
        if (!entry) {
            entry = new TerrainGrassResources(this.gl);
            this.entries.set(terrain, entry);
        }
        entry.sync(terrain);
        entry.lastUsedFrame = this.frame;
        return entry;
    }
    build(terrain: Terrain, resources: TerrainGrassResources, chunk: GrassChunk, tier: number): void {
        resources.build(terrain, chunk, this.scratch, tier);
    }
    endFrame(): void {
        this.frame++;
        for (const [terrain, entry] of this.entries) {
            if (this.frame - entry.lastUsedFrame > RETENTION_FRAMES) {
                entry.dispose();
                this.entries.delete(terrain);
            }
        }
    }
    dispose(): void {
        for (const entry of this.entries.values())
            entry.dispose();
        this.entries.clear();
    }
}
