import type { Vec3 } from '@/engine/core/math/vec3';
import * as aabb from '@/engine/core/math/aabb';
import type { Aabb } from '@/engine/core/math/aabb';
import { clamp } from '@/engine/core/math/scalar';
import { RegionChangeLog } from '@/engine/terrain/chunks/region-change-log';
import { TerrainTileBounds } from '@/engine/terrain/chunks/terrain-tiles';
import { Heightfield, type GridRegion } from './heightfield';
import { MAX_TERRAIN_LAYERS, SplatMap } from './splat-map';
import { cloneTerrainLayer, type TerrainLayer } from './terrain-layer';
import { createTerrainShading, type TerrainShading } from './terrain-shading';
import { cloneGrassSettings, createGrassSettings, type GrassSettings } from '@/engine/terrain/foliage/grass-settings';
export const TERRAIN_RESOLUTIONS = [65, 129, 257, 513] as const;
export const TERRAIN_SPLAT_RESOLUTIONS = [256, 512, 1024] as const;
export const MIN_TERRAIN_SIZE = 10;
export const MAX_TERRAIN_SIZE = 2000;
export interface TerrainOptions {
    size?: number;
    resolution?: number;
    splatResolution?: number;
    heightfield?: Heightfield;
    splat?: SplatMap;
    layers?: TerrainLayer[];
    shading?: TerrainShading;
    grass?: GrassSettings;
}
export interface TerrainHit {
    distance: number;
    readonly point: Vec3;
}
const RAYCAST_STEP_CELLS = 0.5;
const RAYCAST_REFINE_ITERATIONS = 10;
const RAYCAST_BOUNDS_PADDING = 1;
export class Terrain {
    size: number;
    heightfield: Heightfield;
    splat: SplatMap;
    readonly layers: TerrainLayer[];
    readonly shading: TerrainShading;
    readonly grass: GrassSettings;
    tiles: TerrainTileBounds;
    readonly heightLog = new RegionChangeLog();
    readonly localBounds: Aabb = aabb.create();
    splatVersion = 0;
    constructor(options: TerrainOptions = {}) {
        this.size = clamp(options.size ?? 200, MIN_TERRAIN_SIZE, MAX_TERRAIN_SIZE);
        this.heightfield = options.heightfield ?? new Heightfield(options.resolution ?? 257);
        this.splat = options.splat ?? new SplatMap(options.splatResolution ?? 512);
        this.layers = options.layers ?? [];
        this.shading = options.shading ?? createTerrainShading();
        this.grass = options.grass ?? createGrassSettings();
        this.tiles = new TerrainTileBounds(this.heightfield.resolution);
        this.heightsChanged();
    }
    get heightVersion(): number {
        return this.heightLog.version;
    }
    get resolution(): number {
        return this.heightfield.resolution;
    }
    get cellSize(): number {
        return this.size / (this.heightfield.resolution - 1);
    }
    get halfSize(): number {
        return this.size / 2;
    }
    localToGrid(value: number): number {
        return (value + this.halfSize) / this.cellSize;
    }
    gridToLocal(grid: number): number {
        return grid * this.cellSize - this.halfSize;
    }
    localToSplat(value: number): number {
        return ((value + this.halfSize) / this.size) * (this.splat.resolution - 1);
    }
    heightAtLocal(x: number, z: number): number {
        return this.heightfield.sample(this.localToGrid(x), this.localToGrid(z));
    }
    normalAtLocal(out: Vec3, x: number, z: number): Vec3 {
        return this.heightfield.normalAt(out, this.localToGrid(x), this.localToGrid(z), this.cellSize);
    }
    containsLocal(x: number, z: number): boolean {
        const half = this.halfSize;
        return x >= -half && x <= half && z >= -half && z <= half;
    }
    gridRegionAround(x: number, z: number, radius: number, out: GridRegion): GridRegion {
        const last = this.resolution - 1;
        out.x0 = clamp(Math.floor(this.localToGrid(x - radius)), 0, last);
        out.z0 = clamp(Math.floor(this.localToGrid(z - radius)), 0, last);
        out.x1 = clamp(Math.ceil(this.localToGrid(x + radius)), 0, last);
        out.z1 = clamp(Math.ceil(this.localToGrid(z + radius)), 0, last);
        return out;
    }
    splatRegionAround(x: number, z: number, radius: number, out: GridRegion): GridRegion {
        const last = this.splat.resolution - 1;
        out.x0 = clamp(Math.floor(this.localToSplat(x - radius)), 0, last);
        out.z0 = clamp(Math.floor(this.localToSplat(z - radius)), 0, last);
        out.x1 = clamp(Math.ceil(this.localToSplat(x + radius)), 0, last);
        out.z1 = clamp(Math.ceil(this.localToSplat(z + radius)), 0, last);
        return out;
    }
    heightsChanged(region: GridRegion | null = null): void {
        this.tiles.update(this.heightfield, region);
        const half = this.halfSize;
        const { localBounds, tiles } = this;
        localBounds.min[0] = -half;
        localBounds.min[1] = tiles.minHeight;
        localBounds.min[2] = -half;
        localBounds.max[0] = half;
        localBounds.max[1] = tiles.maxHeight;
        localBounds.max[2] = half;
        if (region)
            this.heightLog.push(region);
        else
            this.heightLog.reset();
    }
    markSplatDirty(): void {
        this.splatVersion++;
    }
    get canAddLayer(): boolean {
        return this.layers.length < MAX_TERRAIN_LAYERS;
    }
    layerIndex(id: number): number {
        return this.layers.findIndex((layer) => layer.id === id);
    }
    replaceHeightfield(heightfield: Heightfield, size: number = this.size): void {
        this.heightfield = heightfield;
        this.size = clamp(size, MIN_TERRAIN_SIZE, MAX_TERRAIN_SIZE);
        this.tiles = new TerrainTileBounds(heightfield.resolution);
        this.heightsChanged();
    }
    replaceSplat(splat: SplatMap): void {
        this.splat = splat;
        this.markSplatDirty();
    }
    raycast(origin: Vec3, direction: Vec3, out: TerrainHit): TerrainHit | null {
        const half = this.halfSize;
        const { minHeight, maxHeight } = this.tiles;
        let tMin = 0;
        let tMax = Infinity;
        const bounds: ReadonlyArray<readonly [
            number,
            number,
            number,
            number
        ]> = [
            [origin[0], direction[0], -half, half],
            [origin[1], direction[1], minHeight - RAYCAST_BOUNDS_PADDING, maxHeight + RAYCAST_BOUNDS_PADDING],
            [origin[2], direction[2], -half, half],
        ];
        for (const [o, d, lo, hi] of bounds) {
            if (Math.abs(d) < 1e-9) {
                if (o < lo || o > hi)
                    return null;
                continue;
            }
            let t1 = (lo - o) / d;
            let t2 = (hi - o) / d;
            if (t1 > t2)
                [t1, t2] = [t2, t1];
            tMin = Math.max(tMin, t1);
            tMax = Math.min(tMax, t2);
            if (tMin > tMax)
                return null;
        }
        const horizontal = Math.hypot(direction[0], direction[2]);
        const step = horizontal > 1e-6 ? (this.cellSize * RAYCAST_STEP_CELLS) / horizontal : (tMax - tMin) / 64;
        let t = tMin;
        let previousT = tMin;
        let previousAbove = origin[1] + direction[1] * tMin - this.heightAtLocal(origin[0] + direction[0] * tMin, origin[2] + direction[2] * tMin);
        if (previousAbove < 0)
            return this.finishHit(origin, direction, tMin, out);
        while (t < tMax) {
            t = Math.min(t + step, tMax);
            const x = origin[0] + direction[0] * t;
            const z = origin[2] + direction[2] * t;
            const above = origin[1] + direction[1] * t - this.heightAtLocal(x, z);
            if (above <= 0) {
                let lo = previousT;
                let hi = t;
                for (let i = 0; i < RAYCAST_REFINE_ITERATIONS; i++) {
                    const mid = (lo + hi) * 0.5;
                    const midAbove = origin[1] + direction[1] * mid - this.heightAtLocal(origin[0] + direction[0] * mid, origin[2] + direction[2] * mid);
                    if (midAbove > 0)
                        lo = mid;
                    else
                        hi = mid;
                }
                return this.finishHit(origin, direction, (lo + hi) * 0.5, out);
            }
            previousT = t;
            previousAbove = above;
        }
        return previousAbove <= 0 ? this.finishHit(origin, direction, tMax, out) : null;
    }
    private finishHit(origin: Vec3, direction: Vec3, t: number, out: TerrainHit): TerrainHit {
        out.distance = t;
        out.point[0] = origin[0] + direction[0] * t;
        out.point[2] = origin[2] + direction[2] * t;
        out.point[1] = this.heightAtLocal(out.point[0], out.point[2]);
        return out;
    }
    clone(): Terrain {
        return new Terrain({
            size: this.size,
            heightfield: this.heightfield.clone(),
            splat: this.splat.clone(),
            layers: this.layers.map(cloneTerrainLayer),
            shading: { ...this.shading },
            grass: cloneGrassSettings(this.grass),
        });
    }
}
