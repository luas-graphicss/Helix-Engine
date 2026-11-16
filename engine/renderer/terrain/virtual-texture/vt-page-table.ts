import type { GL } from '@/engine/renderer/gl/context';
import { VT_LEVELS, VT_PAGE_TABLE_SLICES, VT_PAGES_PER_SIDE, VT_SLOTS_PER_SIDE, VT_SLOTS_PER_SLICE, VT_VIRTUAL_SIZE_LOG2, vtPageKey } from './vt-layout';
const ENTRY_BYTES = 4;
const UNASSIGNED = 0;
export interface VtPageTableSource {
    readonly id: number;
    readonly sizeLog2: number;
    readonly levels: number;
    readonly residency: number;
}
export class VtPageTable {
    readonly texture: WebGLTexture;
    private readonly mips: Uint8Array[] = [];
    private readonly sliceSource = new Int32Array(VT_PAGE_TABLE_SLICES);
    private readonly sliceResidency = new Int32Array(VT_PAGE_TABLE_SLICES);
    private stale = false;
    constructor(private readonly gl: GL) {
        const texture = gl.createTexture();
        if (!texture)
            throw new Error('Não foi possível alocar a tabela de páginas da textura virtual.');
        this.texture = texture;
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, texture);
        gl.texStorage3D(gl.TEXTURE_2D_ARRAY, VT_LEVELS, gl.RGBA8UI, VT_PAGES_PER_SIDE, VT_PAGES_PER_SIDE, VT_PAGE_TABLE_SLICES);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
        for (let mip = 0; mip < VT_LEVELS; mip++) {
            const pages = VT_PAGES_PER_SIDE >> mip;
            this.mips.push(new Uint8Array(VT_PAGE_TABLE_SLICES * pages * pages * ENTRY_BYTES));
        }
    }
    assign(slice: number, source: VtPageTableSource | null, resident: ReadonlyMap<number, number>): void {
        const sourceId = source ? source.id : UNASSIGNED;
        const residency = source ? source.residency : 0;
        if (this.sliceSource[slice] === sourceId && this.sliceResidency[slice] === residency)
            return;
        this.sliceSource[slice] = sourceId;
        this.sliceResidency[slice] = residency;
        this.writeSlice(slice, source, resident);
        this.stale = true;
    }
    upload(): void {
        if (!this.stale)
            return;
        const { gl, mips } = this;
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.texture);
        for (let mip = 0; mip < VT_LEVELS; mip++) {
            const pages = VT_PAGES_PER_SIDE >> mip;
            gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, mip, 0, 0, 0, pages, pages, VT_PAGE_TABLE_SLICES, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, mips[mip]);
        }
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
        this.stale = false;
    }
    dispose(): void {
        this.gl.deleteTexture(this.texture);
    }
    private writeSlice(slice: number, source: VtPageTableSource | null, resident: ReadonlyMap<number, number>): void {
        const { mips } = this;
        const sourceId = source ? source.id : UNASSIGNED;
        for (let mip = VT_LEVELS - 1; mip >= 0; mip--) {
            const pages = VT_PAGES_PER_SIDE >> mip;
            const data = mips[mip];
            const parent = mip + 1 < VT_LEVELS ? mips[mip + 1] : null;
            const parentPages = pages >> 1;
            const base = slice * pages * pages * ENTRY_BYTES;
            const parentBase = slice * parentPages * parentPages * ENTRY_BYTES;
            const level = source ? mip - (VT_VIRTUAL_SIZE_LOG2 - source.sizeLog2) : -1;
            const served = source !== null && level >= 0 && level < source.levels;
            for (let py = 0; py < pages; py++) {
                for (let px = 0; px < pages; px++) {
                    const offset = base + (py * pages + px) * ENTRY_BYTES;
                    const slot = served ? resident.get(vtPageKey(sourceId, level, px, py)) : undefined;
                    if (slot !== undefined) {
                        const cacheSlice = Math.floor(slot / VT_SLOTS_PER_SLICE);
                        const within = slot - cacheSlice * VT_SLOTS_PER_SLICE;
                        data[offset] = within % VT_SLOTS_PER_SIDE;
                        data[offset + 1] = Math.floor(within / VT_SLOTS_PER_SIDE);
                        data[offset + 2] = cacheSlice;
                        data[offset + 3] = mip + 1;
                    }
                    else if (parent) {
                        const parentOffset = parentBase + ((py >> 1) * parentPages + (px >> 1)) * ENTRY_BYTES;
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
}
