import type { CullingOptions } from '@/engine/renderer/culling/visible-set';
import type { LodSettings } from '@/engine/renderer/lod/lod-selector';
import { createMyriadSettings, type MyriadSettings } from '@/engine/renderer/myriad/runtime/myriad-settings';
import type { LightHelperMode } from '@/engine/renderer/passes/light-helper-pass';
import type { SoundHelperMode } from '@/engine/renderer/passes/sound-helper-pass';
import type { VfxHelperMode } from '@/engine/renderer/passes/vfx-helper-pass';
export const DEFAULT_MIN_PIXEL_SIZE = 2;
export interface TerrainRenderSettings {
    materialCache: boolean;
}
export interface PostCompareSettings {
    enabled: boolean;
    split: number;
}
export interface RenderSettings {
    readonly culling: CullingOptions;
    readonly lod: LodSettings;
    readonly myriad: MyriadSettings;
    readonly terrain: TerrainRenderSettings;
    readonly postCompare: PostCompareSettings;
    showCsgBrushes: boolean;
    lightHelpers: LightHelperMode;
    soloLightId: number | null;
    soundHelpers: SoundHelperMode;
    vfxHelpers: VfxHelperMode;
    profileGpu: boolean;
    perfHud: boolean;
    renderOnDemand: boolean;
}
export function createRenderSettings(): RenderSettings {
    return {
        culling: { frustumCulling: true, minPixelSize: DEFAULT_MIN_PIXEL_SIZE },
        lod: { enabled: true, bias: 0 },
        myriad: createMyriadSettings(),
        terrain: { materialCache: true },
        postCompare: { enabled: false, split: 0.5 },
        showCsgBrushes: true,
        lightHelpers: 'all',
        soloLightId: null,
        soundHelpers: 'all',
        vfxHelpers: 'all',
        profileGpu: false,
        perfHud: false,
        renderOnDemand: true,
    };
}
