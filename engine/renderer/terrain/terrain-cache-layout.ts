export const MAX_TERRAIN_CACHE_LEVELS = 11;
export const TERRAIN_CACHE_TILE_TEXELS = 64;
export const TERRAIN_CACHE_RING_MARGIN_TILES = 2;
export function terrainCacheBaseCoverage(size: number, texelsPerMeter: number): number {
    return size / texelsPerMeter;
}
export function terrainCacheUsableRadius(coverage: number, tilesPerSide: number): number {
    return coverage * (0.5 - TERRAIN_CACHE_RING_MARGIN_TILES / tilesPerSide);
}
