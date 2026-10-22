import type { CullingOptions } from '@/engine/renderer/culling/visible-set';
import type { LodSettings } from '@/engine/renderer/lod/lod-selector';
import { createMyriadSettings, type MyriadSettings } from '@/engine/renderer/myriad/runtime/myriad-settings';
export const DEFAULT_MIN_PIXEL_SIZE = 2;
export interface TerrainRenderSettings {
    materialCache: boolean;
}
export interface RenderSettings {
    readonly culling: CullingOptions;
    readonly lod: LodSettings;
    readonly myriad: MyriadSettings;
    readonly terrain: TerrainRenderSettings;
    showCsgBrushes: boolean;
}
export function createRenderSettings(): RenderSettings {
    return {
        culling: { frustumCulling: true, minPixelSize: DEFAULT_MIN_PIXEL_SIZE },
        lod: { enabled: true, bias: 0 },
        myriad: createMyriadSettings(),
        terrain: { materialCache: true },
        showCsgBrushes: true,
    };
}
