import type { CullingOptions } from '@/engine/renderer/culling/visible-set';
import type { LodSettings } from '@/engine/renderer/lod/lod-selector';
export const DEFAULT_MIN_PIXEL_SIZE = 2;
export interface RenderSettings {
    readonly culling: CullingOptions;
    readonly lod: LodSettings;
}
export function createRenderSettings(): RenderSettings {
    return {
        culling: { frustumCulling: true, minPixelSize: DEFAULT_MIN_PIXEL_SIZE },
        lod: { enabled: true, bias: 0 },
    };
}
