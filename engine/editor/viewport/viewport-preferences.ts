import type { RenderProfile } from '@/engine/renderer/quality/render-profile';
import { engineSettings } from '@/engine/settings/engine-settings-store';
export function resolveMaxPixelRatio(profile: RenderProfile): number {
    const value = engineSettings.get('render.maxPixelRatio');
    if (value === 'auto')
        return profile.maxPixelRatio;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : profile.maxPixelRatio;
}
export function resolveFrameInterval(profile: RenderProfile): number {
    const value = engineSettings.get('render.fpsLimit');
    if (value === 'auto')
        return profile.fpsLimit > 0 ? 1000 / profile.fpsLimit : 0;
    if (value === 'unlimited')
        return 0;
    const fps = Number(value);
    return Number.isFinite(fps) && fps > 0 ? 1000 / fps : 0;
}
export function resolveEditorLite(profile: RenderProfile): boolean {
    const value = engineSettings.get('render.editorLite');
    return value === 'auto' ? profile.editorLite : value === 'on';
}
export type QualityLadderMode = 'off' | 'play' | 'always';
export function resolveQualityLadder(_profile: RenderProfile): QualityLadderMode {
    const value = engineSettings.get('render.dynamicResolution');
    if (value === 'off')
        return 'off';
    return value === 'on' ? 'always' : 'play';
}
