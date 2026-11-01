import { MAX_TERRAIN_LAYERS } from '@/engine/terrain/core/splat-map';
export const VT_PAGE_TEXELS = 256;
export const VT_PAGE_BORDER = 4;
export const VT_SLOT_TEXELS = VT_PAGE_TEXELS + 2 * VT_PAGE_BORDER;
export const VT_CACHE_TEXELS = 4096;
export const VT_SLOTS_PER_SIDE = Math.floor(VT_CACHE_TEXELS / VT_SLOT_TEXELS);
export const VT_SLOTS_PER_SLICE = VT_SLOTS_PER_SIDE * VT_SLOTS_PER_SIDE;
export const VT_VIRTUAL_SIZE_LOG2 = 13;
export const VT_PROXY_SIZE_LOG2 = 10;
export const VT_LEVELS = VT_VIRTUAL_SIZE_LOG2 - VT_PROXY_SIZE_LOG2;
export const VT_PAGES_PER_SIDE = (1 << VT_VIRTUAL_SIZE_LOG2) / VT_PAGE_TEXELS;
export const VT_PAGE_TABLE_SLICES = 2 * MAX_TERRAIN_LAYERS;
export const VT_UPLOADS_PER_FRAME = 16;
export const VT_MAX_IN_FLIGHT = 48;
export function vtSourceLevels(sizeLog2: number): number {
    return Math.max(0, Math.min(VT_LEVELS, sizeLog2 - VT_PROXY_SIZE_LOG2));
}
export function vtPageLevel(uvPerTexel: number, sourceSize: number): number {
    const lod = Math.log2(Math.max(uvPerTexel * sourceSize, 1e-12));
    return Math.max(Math.floor(lod + 0.5), 0);
}
export function vtPageKey(sourceId: number, level: number, px: number, py: number): number {
    return ((sourceId * 4 + level) * VT_PAGES_PER_SIDE + py) * VT_PAGES_PER_SIDE + px;
}
