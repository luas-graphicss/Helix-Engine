import type { GpuTier } from '../gl/capabilities';
export interface RenderProfile {
    readonly tier: GpuTier;
    readonly cloudStepsPerFrame: number;
    readonly cloudInterleave: boolean;
    readonly shadowMapSize: number;
    readonly farCascadePeriod: number;
    readonly midCascadePeriod: number;
    readonly terrainCacheLevels: number;
    readonly terrainCacheSize: number;
    readonly terrainCacheTilesPerFrame: number;
    readonly myriadActivationTriangles: number;
    readonly antialias: 'smaa' | 'taa';
}
const PROFILES: Record<GpuTier, RenderProfile> = {
    low: {
        tier: 'low',
        cloudStepsPerFrame: 20,
        cloudInterleave: true,
        shadowMapSize: 2048,
        farCascadePeriod: 4,
        midCascadePeriod: 2,
        terrainCacheLevels: 8,
        terrainCacheSize: 1024,
        terrainCacheTilesPerFrame: 8,
        myriadActivationTriangles: 400000,
        antialias: 'smaa',
    },
    mid: {
        tier: 'mid',
        cloudStepsPerFrame: 28,
        cloudInterleave: true,
        shadowMapSize: 2048,
        farCascadePeriod: 2,
        midCascadePeriod: 2,
        terrainCacheLevels: 7,
        terrainCacheSize: 2048,
        terrainCacheTilesPerFrame: 16,
        myriadActivationTriangles: 1000000,
        antialias: 'smaa',
    },
    high: {
        tier: 'high',
        cloudStepsPerFrame: 40,
        cloudInterleave: false,
        shadowMapSize: 2048,
        farCascadePeriod: 1,
        midCascadePeriod: 1,
        terrainCacheLevels: 7,
        terrainCacheSize: 2048,
        terrainCacheTilesPerFrame: 32,
        myriadActivationTriangles: 1500000,
        antialias: 'smaa',
    },
};
export function renderProfileForTier(tier: GpuTier): RenderProfile {
    return PROFILES[tier];
}
