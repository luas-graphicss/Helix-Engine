export const MIN_RENDER_SCALE = 0.6;
export const MAX_RENDER_SCALE = 1;
export function clampRenderScale(scale: number): number {
    if (!Number.isFinite(scale))
        return MAX_RENDER_SCALE;
    return Math.min(MAX_RENDER_SCALE, Math.max(MIN_RENDER_SCALE, scale));
}
