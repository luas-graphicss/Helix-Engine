import type { GL } from '@/engine/renderer/gl/context';
import type { ShaderProgram } from '@/engine/renderer/gl/shader-program';
import type { Terrain } from '@/engine/terrain/core/terrain';
import { MAX_TERRAIN_LAYERS } from '@/engine/terrain/core/splat-map';
import type { HiresMapKind, HiresMapSource } from '@/engine/terrain/materials/material-catalog';
import { TERRAIN_VT_ALBEDO_TEXTURE_UNIT, TERRAIN_VT_NORMAL_TEXTURE_UNIT, TERRAIN_VT_PAGES_TEXTURE_UNIT } from '../terrain-texture-units';
import { VT_CACHE_TEXELS, VT_LEVELS, VT_MAX_IN_FLIGHT, VT_PAGE_TABLE_SLICES, VT_PAGES_PER_SIDE, VT_SLOT_TEXELS, VT_SLOTS_PER_SIDE, VT_SLOTS_PER_SLICE, VT_UPLOADS_PER_FRAME, VT_VIRTUAL_SIZE_LOG2, vtPageKey, vtSourceLevels, } from './vt-layout';
import { VtTileStreamer, type VtSourceEvent } from './vt-tile-streamer';
const KINDS: readonly HiresMapKind[] = ['albedo', 'normal'];
const STALE_REQUEST_FRAMES = 2;
const HOT_FRAMES = 1;
const MIN_WEIGHT_BYTE = 1;
export interface TerrainVirtualTextureStats {
    sources: number;
    ready: number;
    errors: number;
    downloadLoaded: number;
    downloadTotal: number;
    tilingDone: number;
    tilingTotal: number;
    resident: number;
    capacity: number;
    pending: number;
    inFlight: number;
    uploads: number;
    virtualTexels: number;
    physicalBytes: number;
}
class VirtualSource {
    size = 0;
    sizeLog2 = 0;
    levels = 0;
    state: 'opening' | 'ready' | 'error' = 'opening';
    downloadLoaded = 0;
    downloadTotal = 0;
    tilingDone = 0;
    tilingTotal = 0;
    constructor(readonly id: number, readonly kind: HiresMapKind, readonly url: string) { }
    virtualLevel(level: number): number {
        return level + (VT_VIRTUAL_SIZE_LOG2 - this.sizeLog2);
    }
}
interface PendingPage {
    key: number;
    source: VirtualSource;
    level: number;
    px: number;
    py: number;
    touched: number;
    inFlight: boolean;
}
interface ArrivedPage {
    pending: PendingPage;
    bitmap: ImageBitmap;
}
class PhysicalCache {
    readonly texture: WebGLTexture;
    readonly resident = new Map<number, number>();
    readonly slotKey: Float64Array;
    readonly slotTouched: Int32Array;
    private readonly free: number[] = [];
    constructor(private readonly gl: GL, internalFormat: number, readonly slices: number) {
        const count = slices * VT_SLOTS_PER_SLICE;
        this.slotKey = new Float64Array(count).fill(-1);
        this.slotTouched = new Int32Array(count).fill(-1);
        for (let slot = count - 1; slot >= 0; slot--)
            this.free.push(slot);
        const texture = gl.createTexture();
        if (!texture)
            throw new Error('Não foi possível alocar o cache físico da textura virtual.');
        this.texture = texture;
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, texture);
        gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, internalFormat, VT_CACHE_TEXELS, VT_CACHE_TEXELS, slices);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
    }
    get capacity(): number {
        return this.slotKey.length;
    }
    allocate(frame: number): number {
        const free = this.free.pop();
        if (free !== undefined)
            return free;
        let victim = -1;
        let oldest = frame - HOT_FRAMES;
        for (let slot = 0; slot < this.slotTouched.length; slot++) {
            const touched = this.slotTouched[slot];
            if (touched < oldest) {
                oldest = touched;
                victim = slot;
            }
        }
        if (victim >= 0)
            this.resident.delete(this.slotKey[victim]);
        return victim;
    }
    upload(slot: number, key: number, frame: number, bitmap: ImageBitmap): void {
        const { gl } = this;
        const slice = Math.floor(slot / VT_SLOTS_PER_SLICE);
        const within = slot - slice * VT_SLOTS_PER_SLICE;
        const x = (within % VT_SLOTS_PER_SIDE) * VT_SLOT_TEXELS;
        const y = Math.floor(within / VT_SLOTS_PER_SIDE) * VT_SLOT_TEXELS;
        gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, x, y, slice, VT_SLOT_TEXELS, VT_SLOT_TEXELS, 1, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);
        this.slotKey[slot] = key;
        this.slotTouched[slot] = frame;
        this.resident.set(key, slot);
    }
    dispose(): void {
        this.gl.deleteTexture(this.texture);
    }
}
export class TerrainVirtualTexture {
    readonly stats: TerrainVirtualTextureStats = {
        sources: 0,
        ready: 0,
        errors: 0,
        downloadLoaded: 0,
        downloadTotal: 0,
        tilingDone: 0,
        tilingTotal: 0,
        resident: 0,
        capacity: 0,
        pending: 0,
        inFlight: 0,
        uploads: 0,
        virtualTexels: 0,
        physicalBytes: 0,
    };
    residencyVersion = 0;
    private readonly caches: Record<HiresMapKind, PhysicalCache> | null;
    private readonly streamer: VtTileStreamer | null;
    private readonly sources = new Map<string, VirtualSource>();
    private readonly sourcesById = new Map<number, VirtualSource>();
    private nextSourceId = 1;
    private readonly pending = new Map<number, PendingPage>();
    private readonly arrived: ArrivedPage[] = [];
    private readonly dispatchQueue: PendingPage[] = [];
    private inFlight = 0;
    private frame = 0;
    private disposed = false;
    private readonly pageTable: WebGLTexture | null;
    private readonly pageTableMips: Uint8Array[] = [];
    private pageTableDirty = true;
    private boundSignature = '';
    private readonly layerInfo = new Float32Array(MAX_TERRAIN_LAYERS * 4);
    constructor(private readonly gl: GL, slices: number) {
        if (slices <= 0 || typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap !== 'function') {
            this.caches = null;
            this.streamer = null;
            this.pageTable = null;
            return;
        }
        this.caches = {
            albedo: new PhysicalCache(gl, gl.SRGB8_ALPHA8, slices),
            normal: new PhysicalCache(gl, gl.RGBA8, slices),
        };
        this.streamer = new VtTileStreamer();
        this.stats.capacity = this.caches.albedo.capacity + this.caches.normal.capacity;
        this.stats.physicalBytes = 2 * slices * VT_CACHE_TEXELS * VT_CACHE_TEXELS * 4;
        const table = gl.createTexture();
        if (!table)
            throw new Error('Não foi possível alocar a tabela de páginas da textura virtual.');
        this.pageTable = table;
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, table);
        gl.texStorage3D(gl.TEXTURE_2D_ARRAY, VT_LEVELS, gl.RGBA8UI, VT_PAGES_PER_SIDE, VT_PAGES_PER_SIDE, VT_PAGE_TABLE_SLICES);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
        for (let level = 0; level < VT_LEVELS; level++) {
            const pages = VT_PAGES_PER_SIDE >> level;
            this.pageTableMips.push(new Uint8Array(VT_PAGE_TABLE_SLICES * pages * pages * 4));
        }
    }
    get enabled(): boolean {
        return this.caches !== null;
    }
    get busy(): boolean {
        if (!this.enabled)
            return false;
        if (this.pending.size > 0 || this.arrived.length > 0)
            return true;
        for (const source of this.sources.values())
            if (source.state === 'opening')
                return true;
        return false;
    }
    requestTile(terrain: Terrain, x0: number, z0: number, x1: number, z1: number, texelSize: number, far: number): boolean {
        if (!this.enabled)
            return true;
        const { layers } = terrain;
        const count = Math.min(layers.length, MAX_TERRAIN_LAYERS);
        const distanceTiling = Math.max(terrain.shading.distanceTiling, 1);
        let needMask = 0;
        for (let i = 0; i < count; i++) {
            const layer = layers[i];
            const tiling = Math.max(layer.tiling, 0.01);
            for (const kind of KINDS) {
                const hires = layer.material.hires[kind];
                if (!hires)
                    continue;
                const levels = vtSourceLevels(Math.round(Math.log2(hires.size)));
                const near = far < 1 ? pageLevel(texelSize / tiling, hires.size) : levels;
                const distant = far > 0 ? pageLevel(texelSize / (tiling * distanceTiling), hires.size) : levels;
                if (near < levels || distant < levels)
                    needMask |= 1 << i;
            }
        }
        if (needMask === 0)
            return true;
        const mask = layerMask(terrain, x0, z0, x1, z1) & needMask;
        if (mask === 0)
            return true;
        let complete = true;
        for (let i = 0; i < count; i++) {
            if ((mask & (1 << i)) === 0)
                continue;
            const layer = layers[i];
            const tiling = Math.max(layer.tiling, 0.01);
            for (const kind of KINDS) {
                const hires = layer.material.hires[kind];
                if (!hires)
                    continue;
                const source = this.sourceOf(hires, kind);
                if (source.state !== 'ready') {
                    if (source.state === 'opening')
                        complete = false;
                    continue;
                }
                if (far < 1 && !this.requestRect(source, x0 / tiling, z0 / tiling, x1 / tiling, z1 / tiling, texelSize / tiling))
                    complete = false;
                if (far > 0) {
                    const farTiling = tiling * distanceTiling;
                    if (!this.requestRect(source, x0 / farTiling, z0 / farTiling, x1 / farTiling, z1 / farTiling, texelSize / farTiling))
                        complete = false;
                }
            }
        }
        return complete;
    }
    beginFrame(): void {
        this.stats.uploads = 0;
        if (!this.caches)
            return;
        this.frame++;
        this.uploadArrived();
    }
}
