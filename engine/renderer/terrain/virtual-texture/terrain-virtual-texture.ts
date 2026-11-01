import type { GL } from '@/engine/renderer/gl/context';
import type { ShaderProgram } from '@/engine/renderer/gl/shader-program';
import type { Terrain } from '@/engine/terrain/core/terrain';
import { MAX_TERRAIN_LAYERS } from '@/engine/terrain/core/splat-map';
import type { HiresMapKind, HiresMapSource } from '@/engine/terrain/materials/material-catalog';
import { TERRAIN_VT_ALBEDO_TEXTURE_UNIT, TERRAIN_VT_NORMAL_TEXTURE_UNIT, TERRAIN_VT_PAGES_TEXTURE_UNIT } from '../terrain-texture-units';
import { VT_CACHE_TEXELS, VT_LEVELS, VT_MAX_IN_FLIGHT, VT_PAGE_TABLE_SLICES, VT_PAGES_PER_SIDE, VT_SLOT_TEXELS, VT_SLOTS_PER_SIDE, VT_SLOTS_PER_SLICE, VT_UPLOADS_PER_FRAME, VT_VIRTUAL_SIZE_LOG2, vtPageKey, vtPageLevel, vtSourceLevels, } from './vt-layout';
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
                const near = far < 1 ? vtPageLevel(texelSize / tiling, hires.size) : levels;
                const distant = far > 0 ? vtPageLevel(texelSize / (tiling * distanceTiling), hires.size) : levels;
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
    endFrame(): void {
        const { stats } = this;
        if (!this.caches || !this.streamer)
            return;
        this.dispatch();
        stats.sources = this.sources.size;
        stats.ready = 0;
        stats.errors = 0;
        stats.downloadLoaded = 0;
        stats.downloadTotal = 0;
        stats.tilingDone = 0;
        stats.tilingTotal = 0;
        stats.virtualTexels = 0;
        for (const source of this.sources.values()) {
            if (source.state === 'ready') {
                stats.ready++;
                stats.virtualTexels += source.size * source.size;
            }
            else if (source.state === 'error')
                stats.errors++;
            else {
                stats.downloadLoaded += source.downloadLoaded;
                stats.downloadTotal += source.downloadTotal;
                stats.tilingDone += source.tilingDone;
                stats.tilingTotal += source.tilingTotal;
            }
        }
        stats.resident = this.caches.albedo.resident.size + this.caches.normal.resident.size;
        stats.pending = this.pending.size;
        stats.inFlight = this.inFlight;
    }
    bindSamplers(program: ShaderProgram): void {
        if (!this.enabled)
            return;
        const { gl } = this;
        gl.uniform1i(program.uniform('u_vtPages'), TERRAIN_VT_PAGES_TEXTURE_UNIT);
        gl.uniform1i(program.uniform('u_vtCacheAlbedo'), TERRAIN_VT_ALBEDO_TEXTURE_UNIT);
        gl.uniform1i(program.uniform('u_vtCacheNormal'), TERRAIN_VT_NORMAL_TEXTURE_UNIT);
    }
    bind(program: ShaderProgram, terrain: Terrain): void {
        if (!this.caches || !this.pageTable)
            return;
        const { gl, layerInfo } = this;
        let signature = '';
        for (let i = 0; i < MAX_TERRAIN_LAYERS; i++) {
            const layer = terrain.layers[i];
            for (let k = 0; k < KINDS.length; k++) {
                const source = layer ? this.readySource(layer.material.hires[KINDS[k]]) : null;
                layerInfo[i * 4 + k] = source ? source.sizeLog2 : 0;
                signature += source ? `${source.id},` : '-,';
            }
            layerInfo[i * 4 + 2] = 0;
            layerInfo[i * 4 + 3] = 0;
        }
        if (this.pageTableDirty || signature !== this.boundSignature) {
            this.rebuildPageTable(terrain);
            this.boundSignature = signature;
            this.pageTableDirty = false;
        }
        gl.uniform4fv(program.uniform('u_vtLayer[0]'), layerInfo);
        gl.activeTexture(gl.TEXTURE0 + TERRAIN_VT_PAGES_TEXTURE_UNIT);
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.pageTable);
        gl.activeTexture(gl.TEXTURE0 + TERRAIN_VT_ALBEDO_TEXTURE_UNIT);
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.caches.albedo.texture);
        gl.activeTexture(gl.TEXTURE0 + TERRAIN_VT_NORMAL_TEXTURE_UNIT);
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.caches.normal.texture);
    }
    unbind(): void {
        if (!this.enabled)
            return;
        const { gl } = this;
        for (const unit of [TERRAIN_VT_PAGES_TEXTURE_UNIT, TERRAIN_VT_ALBEDO_TEXTURE_UNIT, TERRAIN_VT_NORMAL_TEXTURE_UNIT]) {
            gl.activeTexture(gl.TEXTURE0 + unit);
            gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
        }
    }
    dispose(): void {
        this.disposed = true;
        this.streamer?.dispose();
        this.caches?.albedo.dispose();
        this.caches?.normal.dispose();
        if (this.pageTable)
            this.gl.deleteTexture(this.pageTable);
        for (const page of this.arrived)
            page.bitmap.close();
        this.arrived.length = 0;
        this.pending.clear();
        this.sources.clear();
        this.sourcesById.clear();
    }
    private readySource(hires: HiresMapSource | null): VirtualSource | null {
        if (!hires)
            return null;
        const source = this.sources.get(hires.url);
        return source && source.state === 'ready' ? source : null;
    }
    private sourceOf(hires: HiresMapSource, kind: HiresMapKind): VirtualSource {
        let source = this.sources.get(hires.url);
        if (source)
            return source;
        source = new VirtualSource(this.nextSourceId++, kind, hires.url);
        source.size = hires.size;
        source.sizeLog2 = Math.round(Math.log2(hires.size));
        source.levels = vtSourceLevels(source.sizeLog2);
        this.sources.set(hires.url, source);
        this.sourcesById.set(source.id, source);
        const id = source.id;
        this.streamer?.open(id, hires.url, hires.url, hires.size, (event) => this.onSourceEvent(id, event));
        return source;
    }
    private onSourceEvent(id: number, event: VtSourceEvent): void {
        const source = this.sourcesById.get(id);
        if (!source || this.disposed)
            return;
        switch (event.type) {
            case 'progress':
                if (event.phase === 'download') {
                    source.downloadLoaded = event.loaded;
                    source.downloadTotal = event.total;
                }
                else {
                    source.tilingDone = event.loaded;
                    source.tilingTotal = event.total;
                }
                break;
            case 'ready':
                source.size = event.size;
                source.sizeLog2 = Math.round(Math.log2(event.size));
                source.levels = event.levels;
                source.state = 'ready';
                this.pageTableDirty = true;
                break;
            case 'error':
                source.state = 'error';
                console.warn(`[terreno] Textura virtual indisponível para ${source.url}: ${event.message}`);
                break;
        }
    }
    private requestRect(source: VirtualSource, u0: number, v0: number, u1: number, v1: number, uvPerTexel: number): boolean {
        const level = vtPageLevel(uvPerTexel, source.size);
        if (level >= source.levels)
            return true;
        const pages = VT_PAGES_PER_SIDE >> source.virtualLevel(level);
        const a0 = Math.floor(u0 * pages);
        const a1 = Math.floor(u1 * pages);
        const b0 = Math.floor(v0 * pages);
        const b1 = Math.floor(v1 * pages);
        const spanX = Math.min(a1 - a0 + 1, pages);
        const spanY = Math.min(b1 - b0 + 1, pages);
        let complete = true;
        for (let j = 0; j < spanY; j++) {
            const py = (((b0 + j) % pages) + pages) % pages;
            for (let i = 0; i < spanX; i++) {
                const px = (((a0 + i) % pages) + pages) % pages;
                if (!this.requestPage(source, level, px, py))
                    complete = false;
            }
        }
        return complete;
    }
    private requestPage(source: VirtualSource, level: number, px: number, py: number): boolean {
        const caches = this.caches as Record<HiresMapKind, PhysicalCache>;
        const key = vtPageKey(source.id, level, px, py);
        const cache = caches[source.kind];
        const slot = cache.resident.get(key);
        if (slot !== undefined) {
            cache.slotTouched[slot] = this.frame;
            return true;
        }
        const pending = this.pending.get(key);
        if (pending)
            pending.touched = this.frame;
        else
            this.pending.set(key, { key, source, level, px, py, touched: this.frame, inFlight: false });
        return false;
    }
    private dispatch(): void {
        const streamer = this.streamer as VtTileStreamer;
        const queue = this.dispatchQueue;
        queue.length = 0;
        for (const page of this.pending.values()) {
            if (page.inFlight)
                continue;
            if (this.frame - page.touched > STALE_REQUEST_FRAMES) {
                this.pending.delete(page.key);
                continue;
            }
            queue.push(page);
        }
        if (queue.length === 0 || this.inFlight >= VT_MAX_IN_FLIGHT)
            return;
        queue.sort((a, b) => b.level - a.level || b.touched - a.touched);
        for (const page of queue) {
            if (this.inFlight >= VT_MAX_IN_FLIGHT)
                break;
            page.inFlight = true;
            this.inFlight++;
            const sent = streamer.request(page.source.id, page.level, page.px, page.py, (bitmap) => this.onTile(page, bitmap));
            if (!sent) {
                page.inFlight = false;
                this.inFlight--;
                this.pending.delete(page.key);
            }
        }
    }
    private onTile(page: PendingPage, bitmap: ImageBitmap | null): void {
        this.inFlight--;
        if (this.disposed) {
            bitmap?.close();
            return;
        }
        if (!bitmap) {
            this.pending.delete(page.key);
            return;
        }
        this.arrived.push({ pending: page, bitmap });
    }
    private uploadArrived(): void {
        const caches = this.caches as Record<HiresMapKind, PhysicalCache>;
        const { gl, arrived } = this;
        if (arrived.length === 0)
            return;
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
        let bound: PhysicalCache | null = null;
        const count = Math.min(arrived.length, VT_UPLOADS_PER_FRAME);
        for (let i = 0; i < count; i++) {
            const { pending, bitmap } = arrived[i];
            this.pending.delete(pending.key);
            const cache = caches[pending.source.kind];
            if (!cache.resident.has(pending.key)) {
                const slot = cache.allocate(this.frame);
                if (slot >= 0) {
                    if (bound !== cache) {
                        gl.bindTexture(gl.TEXTURE_2D_ARRAY, cache.texture);
                        bound = cache;
                    }
                    cache.upload(slot, pending.key, this.frame, bitmap);
                    this.stats.uploads++;
                    this.residencyVersion++;
                    this.pageTableDirty = true;
                }
            }
            bitmap.close();
        }
        arrived.splice(0, count);
        if (bound)
            gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
    }
    private rebuildPageTable(terrain: Terrain): void {
        const caches = this.caches as Record<HiresMapKind, PhysicalCache>;
        const { gl, pageTableMips } = this;
        for (let slice = 0; slice < VT_PAGE_TABLE_SLICES; slice++) {
            const kind = KINDS[Math.floor(slice / MAX_TERRAIN_LAYERS)];
            const layer = terrain.layers[slice % MAX_TERRAIN_LAYERS];
            const source = layer ? this.readySource(layer.material.hires[kind]) : null;
            const cache = caches[kind];
            for (let mip = VT_LEVELS - 1; mip >= 0; mip--) {
                const pages = VT_PAGES_PER_SIDE >> mip;
                const data = pageTableMips[mip];
                const parent = mip + 1 < VT_LEVELS ? pageTableMips[mip + 1] : null;
                const parentPages = pages >> 1;
                const base = slice * pages * pages * 4;
                const parentBase = slice * parentPages * parentPages * 4;
                const level = source ? mip - (VT_VIRTUAL_SIZE_LOG2 - source.sizeLog2) : -1;
                const served = source !== null && level >= 0 && level < source.levels;
                for (let py = 0; py < pages; py++) {
                    for (let px = 0; px < pages; px++) {
                        const offset = base + (py * pages + px) * 4;
                        const slot = served ? cache.resident.get(vtPageKey((source as VirtualSource).id, level, px, py)) : undefined;
                        if (slot !== undefined) {
                            const cacheSlice = Math.floor(slot / VT_SLOTS_PER_SLICE);
                            const within = slot - cacheSlice * VT_SLOTS_PER_SLICE;
                            data[offset] = within % VT_SLOTS_PER_SIDE;
                            data[offset + 1] = Math.floor(within / VT_SLOTS_PER_SIDE);
                            data[offset + 2] = cacheSlice;
                            data[offset + 3] = mip + 1;
                        }
                        else if (parent) {
                            const parentOffset = parentBase + ((py >> 1) * parentPages + (px >> 1)) * 4;
                            data[offset] = parent[parentOffset];
                            data[offset + 1] = parent[parentOffset + 1];
                            data[offset + 2] = parent[parentOffset + 2];
                            data[offset + 3] = parent[parentOffset + 3];
                        }
                        else {
                            data[offset] = data[offset + 1] = data[offset + 2] = data[offset + 3] = 0;
                        }
                    }
                }
            }
        }
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.pageTable);
        for (let mip = 0; mip < VT_LEVELS; mip++) {
            const pages = VT_PAGES_PER_SIDE >> mip;
            gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, mip, 0, 0, 0, pages, pages, VT_PAGE_TABLE_SLICES, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, pageTableMips[mip]);
        }
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
    }
}
function layerMask(terrain: Terrain, x0: number, z0: number, x1: number, z1: number): number {
    const { splat, layers } = terrain;
    const { resolution, planes } = splat;
    const last = resolution - 1;
    const scale = last / terrain.size;
    const tx0 = Math.max(Math.floor((x0 + terrain.halfSize) * scale) - 1, 0);
    const tx1 = Math.min(Math.ceil((x1 + terrain.halfSize) * scale) + 1, last);
    const tz0 = Math.max(Math.floor((z0 + terrain.halfSize) * scale) - 1, 0);
    const tz1 = Math.min(Math.ceil((z1 + terrain.halfSize) * scale) + 1, last);
    const count = Math.min(layers.length, MAX_TERRAIN_LAYERS);
    let mask = 0;
    let any = false;
    for (let tz = tz0; tz <= tz1; tz++) {
        for (let tx = tx0; tx <= tx1; tx++) {
            const texel = (tz * resolution + tx) * 4;
            for (let i = 0; i < count; i++) {
                if (planes[i >> 2][texel + (i & 3)] >= MIN_WEIGHT_BYTE) {
                    mask |= 1 << i;
                    any = true;
                }
            }
        }
    }
    return any ? mask : count > 0 ? 1 : 0;
}
