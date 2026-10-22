import * as aabb from '@/engine/core/math/aabb';
import { maxAxisScale } from '@/engine/core/math/mat4';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { Entity } from '@/engine/core/scene/entity';
import type { Terrain } from '@/engine/terrain/core/terrain';
import { TILE_CELLS, TILE_LEVELS } from '@/engine/terrain/chunks/terrain-tiles';
import type { Frustum } from '@/engine/renderer/culling/frustum';
import type { InstanceBuffer } from '@/engine/renderer/gl/instance-buffer';
import { selectLodLevel, type LodSettings } from '@/engine/renderer/lod/lod-selector';
import { STITCH_EAST, STITCH_NORTH, STITCH_SOUTH, STITCH_VARIANTS, STITCH_WEST } from './terrain-patch';
const CELL_PIXELS = 10;
const VARIANT_COUNT = TILE_LEVELS * STITCH_VARIANTS;
const TILE_FLOATS = 2;
export interface TerrainTileBatch {
    level: number;
    stitchMask: number;
    firstInstance: number;
    count: number;
}
export interface TerrainTileStats {
    tiles: number;
    drawn: number;
    readonly perLevel: Uint32Array;
}
class TileState {
    readonly levels: Int8Array;
    readonly visible: Uint8Array;
    readonly distances: Float32Array;
    readonly variants: Uint8Array;
    readonly order: number[] = [];
    readonly byDistance = (a: number, b: number): number => this.distances[a] - this.distances[b];
    readonly lightOrder: number[] = [];
    readonly lightLevels: Int8Array;
    readonly lightVariants: Uint8Array;
    constructor(readonly tileCount: number) {
        this.levels = new Int8Array(tileCount).fill(-1);
        this.visible = new Uint8Array(tileCount);
        this.distances = new Float32Array(tileCount);
        this.variants = new Uint8Array(tileCount);
        this.lightLevels = new Int8Array(tileCount);
        this.lightVariants = new Uint8Array(tileCount);
    }
}
export function shadowLevelForTexel(texelWorldSize: number, cellWorldSize: number, lod: LodSettings): number {
    if (!lod.enabled)
        return 0;
    const level = Math.floor(Math.log2(texelWorldSize / Math.max(cellWorldSize, 1e-6)) + lod.bias);
    return Math.min(Math.max(level, 0), TILE_LEVELS - 1);
}
function constrainNeighbors(levels: Int8Array, n: number): void {
    let changed = true;
    while (changed) {
        changed = false;
        for (let tz = 0; tz < n; tz++) {
            for (let tx = 0; tx < n; tx++) {
                const t = tz * n + tx;
                let limit = TILE_LEVELS;
                if (tx > 0)
                    limit = Math.min(limit, levels[t - 1] + 1);
                if (tx < n - 1)
                    limit = Math.min(limit, levels[t + 1] + 1);
                if (tz > 0)
                    limit = Math.min(limit, levels[t - n] + 1);
                if (tz < n - 1)
                    limit = Math.min(limit, levels[t + n] + 1);
                if (levels[t] > limit) {
                    levels[t] = limit;
                    changed = true;
                }
            }
        }
    }
}
export class TerrainTileSelector {
    readonly batches: TerrainTileBatch[] = [];
    readonly stats: TerrainTileStats = { tiles: 0, drawn: 0, perLevel: new Uint32Array(TILE_LEVELS) };
    private readonly states = new WeakMap<Terrain, TileState>();
    private readonly batchPool: TerrainTileBatch[] = [];
    private readonly variantBatch = new Int16Array(VARIANT_COUNT);
    private readonly variantCursor = new Uint32Array(VARIANT_COUNT);
    private readonly local = aabb.create();
    private readonly world = aabb.create();
    beginFrame(): void {
        this.stats.tiles = 0;
        this.stats.drawn = 0;
        this.stats.perLevel.fill(0);
    }
    selectForCamera(entity: Entity, terrain: Terrain, frustum: Frustum | null, cameraPosition: Vec3, pixelScale: number, lod: LodSettings, instances: InstanceBuffer): void {
        const { tiles } = terrain;
        const n = tiles.tilesPerSide;
        const state = this.resolveState(terrain);
        const { levels, visible, distances, variants, order } = state;
        const cellWorldSize = terrain.cellSize * maxAxisScale(entity.worldMatrix);
        const levelCount = lod.enabled ? TILE_LEVELS : 1;
        order.length = 0;
        for (let tz = 0; tz < n; tz++) {
            for (let tx = 0; tx < n; tx++) {
                const t = tz * n + tx;
                const box = this.tileWorldBounds(entity, terrain, tx, tz);
                visible[t] = !frustum || frustum.intersectsAabb(box) ? 1 : 0;
                if (visible[t])
                    order.push(t);
                const distance = aabb.distanceToPoint(box, cameraPosition);
                distances[t] = distance;
                const pixelsPerCell = distance > 0 ? (cellWorldSize * pixelScale) / distance : Infinity;
                levels[t] = selectLodLevel(pixelsPerCell, CELL_PIXELS, levelCount, lod.bias, levels[t]);
            }
        }
        constrainNeighbors(levels, n);
        order.sort(state.byDistance);
        this.buildBatches(order, levels, variants, n, instances);
        const { stats } = this;
        for (const batch of this.batches)
            stats.perLevel[batch.level] += batch.count;
        stats.tiles += state.tileCount;
        stats.drawn += order.length;
    }
    selectForLight(entity: Entity, terrain: Terrain, frustum: Frustum, fallbackLevel: number, instances: InstanceBuffer): number {
        const n = terrain.tiles.tilesPerSide;
        const state = this.resolveState(terrain);
        const { lightOrder, lightLevels, lightVariants } = state;
        const cameraLevels = state.levels[0] >= 0 ? state.levels : null;
        lightOrder.length = 0;
        for (let tz = 0; tz < n; tz++) {
            for (let tx = 0; tx < n; tx++) {
                const t = tz * n + tx;
                lightLevels[t] = cameraLevels ? cameraLevels[t] : fallbackLevel;
                if (frustum.intersectsAabb(this.tileWorldBounds(entity, terrain, tx, tz)))
                    lightOrder.push(t);
            }
        }
        this.buildBatches(lightOrder, lightLevels, lightVariants, n, instances);
        return lightOrder.length;
    }
    private buildBatches(order: readonly number[], levels: Int8Array, variants: Uint8Array, n: number, instances: InstanceBuffer): void {
        const { variantBatch, variantCursor, batches } = this;
        variantBatch.fill(-1);
        batches.length = 0;
        for (let i = 0; i < order.length; i++) {
            const t = order[i];
            const variant = levels[t] * STITCH_VARIANTS + this.stitchMask(levels, n, t);
            variants[t] = variant;
            let index = variantBatch[variant];
            if (index < 0) {
                index = batches.length;
                variantBatch[variant] = index;
                batches.push(this.acquireBatch(index, Math.floor(variant / STITCH_VARIANTS), variant % STITCH_VARIANTS, 0, 0));
            }
            batches[index].count++;
        }
        let offset = instances.allocate(order.length);
        for (const batch of batches) {
            batch.firstInstance = offset;
            variantCursor[batch.level * STITCH_VARIANTS + batch.stitchMask] = offset;
            offset += batch.count;
        }
        const { data } = instances;
        for (let i = 0; i < order.length; i++) {
            const t = order[i];
            const slot = variantCursor[variants[t]]++ * TILE_FLOATS;
            data[slot] = (t % n) * TILE_CELLS;
            data[slot + 1] = Math.floor(t / n) * TILE_CELLS;
        }
    }
    private resolveState(terrain: Terrain): TileState {
        let state = this.states.get(terrain);
        if (!state || state.tileCount !== terrain.tiles.count) {
            state = new TileState(terrain.tiles.count);
            this.states.set(terrain, state);
        }
        return state;
    }
    private tileWorldBounds(entity: Entity, terrain: Terrain, tx: number, tz: number): aabb.Aabb {
        const { tiles } = terrain;
        const index = tz * tiles.tilesPerSide + tx;
        const { local } = this;
        local.min[0] = terrain.gridToLocal(tiles.firstSample(tx));
        local.min[1] = tiles.minHeights[index];
        local.min[2] = terrain.gridToLocal(tiles.firstSample(tz));
        local.max[0] = terrain.gridToLocal(tiles.lastSample(tx));
        local.max[1] = tiles.maxHeights[index];
        local.max[2] = terrain.gridToLocal(tiles.lastSample(tz));
        return aabb.transform(this.world, local, entity.worldMatrix);
    }
    private stitchMask(levels: Int8Array, n: number, t: number): number {
        const level = levels[t];
        const tx = t % n;
        const tz = Math.floor(t / n);
        let mask = 0;
        if (tz > 0 && levels[t - n] > level)
            mask |= STITCH_NORTH;
        if (tx < n - 1 && levels[t + 1] > level)
            mask |= STITCH_EAST;
        if (tz < n - 1 && levels[t + n] > level)
            mask |= STITCH_SOUTH;
        if (tx > 0 && levels[t - 1] > level)
            mask |= STITCH_WEST;
        return mask;
    }
    private acquireBatch(index: number, level: number, stitchMask: number, firstInstance: number, count: number): TerrainTileBatch {
        let batch = this.batchPool[index];
        if (!batch) {
            batch = { level, stitchMask, firstInstance, count };
            this.batchPool[index] = batch;
        }
        else {
            batch.level = level;
            batch.stitchMask = stitchMask;
            batch.firstInstance = firstInstance;
            batch.count = count;
        }
        return batch;
    }
}
