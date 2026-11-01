export interface VfxSettings {
    readonly assetId: string | null;
    readonly autoPlay: boolean;
    readonly playInEditor: boolean;
    readonly loop: boolean | null;
    readonly scale: number;
    readonly timeScale: number;
    readonly seed: number;
    readonly cullDistance: number;
}
export const VFX_SCALE_MIN = 0.01;
export const VFX_SCALE_MAX = 100;
export const VFX_TIME_SCALE_MAX = 8;
export const VFX_CULL_DISTANCE_MAX = 2000;
export function createVfxSettings(patch: Partial<VfxSettings> = {}): VfxSettings {
    return {
        assetId: null,
        autoPlay: true,
        playInEditor: true,
        loop: null,
        scale: 1,
        timeScale: 1,
        seed: 0,
        cullDistance: 0,
        ...patch,
    };
}
export function cloneVfxSettings(settings: VfxSettings): VfxSettings {
    return { ...settings };
}
