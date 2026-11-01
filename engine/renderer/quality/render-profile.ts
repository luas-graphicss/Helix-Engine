import type { GpuTier } from '../gl/capabilities';
export type HdrFormat = 'rgba16f' | 'rg11b10f';
export interface RenderProfile {
    readonly tier: GpuTier;
    readonly maxPixelRatio: number;
    readonly fpsLimit: number;
    readonly editorLite: boolean;
    readonly cloudStepsPerFrame: number;
    readonly cloudInterleave: boolean;
    readonly shadowMapSize: number;
    readonly nearCascadePadding: number;
    readonly farCascadePeriod: number;
    readonly midCascadePeriod: number;
    readonly shadowMaskScale: number;
    readonly terrainCacheLevels: number;
    readonly terrainCacheSize: number;
    readonly terrainCacheTexelsPerMeter: number;
    readonly terrainVirtualTextureSlices: number;
    readonly terrainCacheTilesPerFrame: number;
    readonly myriadActivationTriangles: number;
    readonly antialias: 'smaa' | 'taa';
    readonly smaaStencil: boolean;
    readonly maxLocalLights: number;
    readonly localShadowMapSize: number;
    readonly localShadowFaces: number;
    readonly localShadowFacesPerFrame: number;
    readonly bloomLevels: number;
    readonly bloomStartScale: number;
    readonly depthOfFieldTaps: number;
    readonly hdrFormat: HdrFormat;
    readonly reflectionProbeSize: number;
    readonly screenReflectionScale: number;
    readonly screenReflectionSteps: number;
    readonly screenReflectionStride: number;
}
const PROFILES: Record<GpuTier, RenderProfile> = {
    low: {
        tier: 'low',
        maxPixelRatio: 1,
        fpsLimit: 60,
        editorLite: true,
        cloudStepsPerFrame: 12,
        cloudInterleave: true,
        shadowMapSize: 1024,
        nearCascadePadding: 1.08,
        farCascadePeriod: 4,
        midCascadePeriod: 2,
        shadowMaskScale: 0.5,
        terrainCacheLevels: 6,
        terrainCacheSize: 512,
        terrainCacheTexelsPerMeter: 256,
        terrainVirtualTextureSlices: 0,
        terrainCacheTilesPerFrame: 8,
        myriadActivationTriangles: 0,
        antialias: 'smaa',
        smaaStencil: true,
        maxLocalLights: 16,
        localShadowMapSize: 256,
        localShadowFaces: 6,
        localShadowFacesPerFrame: 2,
        bloomLevels: 3,
        bloomStartScale: 0.25,
        depthOfFieldTaps: 12,
        hdrFormat: 'rg11b10f',
        reflectionProbeSize: 64,
        screenReflectionScale: 0.5,
        screenReflectionSteps: 40,
        screenReflectionStride: 16,
    },
    mid: {
        tier: 'mid',
        maxPixelRatio: 1.5,
        fpsLimit: 0,
        editorLite: true,
        cloudStepsPerFrame: 28,
        cloudInterleave: true,
        shadowMapSize: 2048,
        nearCascadePadding: 1.08,
        farCascadePeriod: 2,
        midCascadePeriod: 2,
        shadowMaskScale: 0.5,
        terrainCacheLevels: 10,
        terrainCacheSize: 2048,
        terrainCacheTexelsPerMeter: 2048,
        terrainVirtualTextureSlices: 1,
        terrainCacheTilesPerFrame: 32,
        myriadActivationTriangles: 0,
        antialias: 'smaa',
        smaaStencil: true,
        maxLocalLights: 64,
        localShadowMapSize: 1024,
        localShadowFaces: 18,
        localShadowFacesPerFrame: 8,
        bloomLevels: 6,
        bloomStartScale: 0.5,
        depthOfFieldTaps: 36,
        hdrFormat: 'rg11b10f',
        reflectionProbeSize: 128,
        screenReflectionScale: 0.5,
        screenReflectionSteps: 64,
        screenReflectionStride: 12,
    },
    high: {
        tier: 'high',
        maxPixelRatio: 2,
        fpsLimit: 0,
        editorLite: false,
        cloudStepsPerFrame: 40,
        cloudInterleave: false,
        shadowMapSize: 2048,
        nearCascadePadding: 1.08,
        farCascadePeriod: 1,
        midCascadePeriod: 1,
        shadowMaskScale: 1,
        terrainCacheLevels: 10,
        terrainCacheSize: 2048,
        terrainCacheTexelsPerMeter: 2048,
        terrainVirtualTextureSlices: 2,
        terrainCacheTilesPerFrame: 64,
        myriadActivationTriangles: 0,
        antialias: 'smaa',
        smaaStencil: true,
        maxLocalLights: 96,
        localShadowMapSize: 1024,
        localShadowFaces: 30,
        localShadowFacesPerFrame: 30,
        bloomLevels: 7,
        bloomStartScale: 0.5,
        depthOfFieldTaps: 48,
        hdrFormat: 'rgba16f',
        reflectionProbeSize: 192,
        screenReflectionScale: 0.5,
        screenReflectionSteps: 96,
        screenReflectionStride: 8,
    },
};
export function renderProfileForTier(tier: GpuTier): RenderProfile {
    return PROFILES[tier];
}
