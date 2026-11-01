import { clamp } from '@/engine/audio/core/decibels';
import type { AudioClipSettings, ClipRegion, FadeCurve } from '@/engine/audio/clip/audio-clip-settings';
const CURVE_STEP_SECONDS = 0.005;
const CURVE_MAX_POINTS = 4096;
export function fadeShape(curve: FadeCurve, t: number): number {
    const x = clamp(t, 0, 1);
    switch (curve) {
        case 'linear':
            return x;
        case 'exponential':
            return x * x;
        case 'smooth':
            return x * x * (3 - 2 * x);
    }
}
export function fadeGainAt(settings: AudioClipSettings, region: ClipRegion, time: number): number {
    let gain = 1;
    const { fadeIn, fadeOut } = settings;
    if (fadeIn.duration > 0 && time < region.start + fadeIn.duration) {
        gain *= fadeShape(fadeIn.curve, (time - region.start) / fadeIn.duration);
    }
    if (!settings.loop && fadeOut.duration > 0 && time > region.end - fadeOut.duration) {
        gain *= fadeShape(fadeOut.curve, (region.end - time) / fadeOut.duration);
    }
    return gain;
}
function automationEnd(settings: AudioClipSettings, region: ClipRegion, from: number): number | null {
    if (settings.loop) {
        const inEnd = region.start + settings.fadeIn.duration;
        return settings.fadeIn.duration > 0 && from < inEnd ? Math.min(inEnd, region.end) : null;
    }
    const needsIn = settings.fadeIn.duration > 0 && from < region.start + settings.fadeIn.duration;
    const needsOut = settings.fadeOut.duration > 0;
    return needsIn || needsOut ? region.end : null;
}
export function scheduleFadeAutomation(param: AudioParam, settings: AudioClipSettings, region: ClipRegion, from: number, rate: number, when: number): void {
    param.cancelScheduledValues(when);
    const initial = fadeGainAt(settings, region, from);
    param.setValueAtTime(initial, when);
    const end = automationEnd(settings, region, from);
    if (end === null || end - from <= 1e-4)
        return;
    const span = end - from;
    const points = clamp(Math.ceil(span / CURVE_STEP_SECONDS), 2, CURVE_MAX_POINTS);
    const values = new Float32Array(points);
    for (let i = 0; i < points; i++)
        values[i] = fadeGainAt(settings, region, from + (span * i) / (points - 1));
    param.setValueCurveAtTime(values, when, span / rate);
}
