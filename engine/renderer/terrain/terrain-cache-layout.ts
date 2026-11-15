export const MAX_TERRAIN_CACHE_LEVELS = 11;
export const TERRAIN_CACHE_TILE_TEXELS = 64;
export const TERRAIN_CACHE_RING_MARGIN_TILES = 2;
const MIN_TERRAIN_CACHE_TEXELS = 512;
export interface TerrainCacheLadder {
    readonly baseCoverage: number;
    readonly ringCount: number;
}
export function terrainCacheUsableRadius(coverage: number, tilesPerSide: number): number {
    return coverage * (0.5 - TERRAIN_CACHE_RING_MARGIN_TILES / tilesPerSide);
}
export function terrainCacheLadder(texels: number, texelsPerMeter: number, terrainSize: number, maxLevels: number): TerrainCacheLadder {
    const maxRings = Math.max(maxLevels - 1, 0);
    const baseCoverage = Math.max(texels / texelsPerMeter, terrainSize / 2 ** maxRings);
    const ringCount = Math.min(maxRings, Math.max(0, Math.ceil(Math.log2(terrainSize / baseCoverage))));
    return { baseCoverage, ringCount };
}
export function terrainCacheTexels(pixelScale: number, maxTexels: number): number {
    let texels = Math.min(MIN_TERRAIN_CACHE_TEXELS, maxTexels);
    while (texels < maxTexels && terrainCacheUsableRadius(texels, texels / TERRAIN_CACHE_TILE_TEXELS) < pixelScale)
        texels *= 2;
    return texels;
}
