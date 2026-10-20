export interface TerrainShading {
    heightBlendDepth: number;
    triplanarStart: number;
    triplanarRange: number;
    macroVariation: number;
    macroScale: number;
    distanceTiling: number;
    distanceBlendStart: number;
    distanceBlendEnd: number;
}
export function createTerrainShading(overrides: Partial<TerrainShading> = {}): TerrainShading {
    return {
        heightBlendDepth: 0.2,
        triplanarStart: 0.45,
        triplanarRange: 0.3,
        macroVariation: 0.4,
        macroScale: 34,
        distanceTiling: 6,
        distanceBlendStart: 9,
        distanceBlendEnd: 42,
        ...overrides,
    };
}
