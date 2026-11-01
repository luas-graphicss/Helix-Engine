import { clamp, semitonesToRate } from '@/engine/audio/core/decibels';
import { CLIP_BUSES, type ClipBusId } from '@/engine/audio/mixer/mixer-settings';
import { createEffectsSettings, sanitizeEffectsSettings, type AudioEffectsSettings } from './audio-effects';
export type FadeCurve = 'linear' | 'exponential' | 'smooth';
export interface FadeSettings {
    duration: number;
    curve: FadeCurve;
}
export interface AudioClipSettings {
    readonly version: 1;
    bus: ClipBusId;
    volumeDb: number;
    pitch: number;
    pan: number;
    loop: boolean;
    loopStart: number | null;
    loopEnd: number | null;
    trimStart: number;
    trimEnd: number | null;
    fadeIn: FadeSettings;
    fadeOut: FadeSettings;
    randomPitch: number;
    randomVolumeDb: number;
    effects: AudioEffectsSettings;
}
export const CLIP_VOLUME_MIN_DB = -60;
export const CLIP_VOLUME_MAX_DB = 12;
export const CLIP_PITCH_RANGE = 24;
export const CLIP_RANDOM_PITCH_MAX = 12;
export const CLIP_RANDOM_VOLUME_MAX_DB = 12;
export const FADE_MAX_SECONDS = 30;
export const MIN_REGION_SECONDS = 0.01;
export const FADE_CURVES: ReadonlyArray<{
    value: FadeCurve;
    label: string;
}> = [
    { value: 'linear', label: 'Linear' },
    { value: 'exponential', label: 'Exponencial' },
    { value: 'smooth', label: 'Suave' },
];
export function createClipSettings(): AudioClipSettings {
    return {
        version: 1,
        bus: 'sfx',
        volumeDb: 0,
        pitch: 0,
        pan: 0,
        loop: false,
        loopStart: null,
        loopEnd: null,
        trimStart: 0,
        trimEnd: null,
        fadeIn: { duration: 0, curve: 'smooth' },
        fadeOut: { duration: 0, curve: 'smooth' },
        randomPitch: 0,
        randomVolumeDb: 0,
        effects: createEffectsSettings(),
    };
}
function numberOr(value: unknown, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
function nullableNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
function fadeOr(value: unknown, fallback: FadeSettings): FadeSettings {
    if (!value || typeof value !== 'object')
        return { ...fallback };
    const record = value as Partial<FadeSettings>;
    const curve = FADE_CURVES.some((option) => option.value === record.curve) ? (record.curve as FadeCurve) : fallback.curve;
    return { duration: clamp(numberOr(record.duration, fallback.duration), 0, FADE_MAX_SECONDS), curve };
}
export function sanitizeClipSettings(stored: unknown): AudioClipSettings {
    const defaults = createClipSettings();
    if (!stored || typeof stored !== 'object')
        return defaults;
    const record = stored as Record<string, unknown>;
    const bus = CLIP_BUSES.some((info) => info.id === record.bus) ? (record.bus as ClipBusId) : defaults.bus;
    return {
        version: 1,
        bus,
        volumeDb: clamp(numberOr(record.volumeDb, 0), CLIP_VOLUME_MIN_DB, CLIP_VOLUME_MAX_DB),
        pitch: clamp(numberOr(record.pitch, 0), -CLIP_PITCH_RANGE, CLIP_PITCH_RANGE),
        pan: clamp(numberOr(record.pan, 0), -1, 1),
        loop: record.loop === true,
        loopStart: nullableNumber(record.loopStart),
        loopEnd: nullableNumber(record.loopEnd),
        trimStart: Math.max(0, numberOr(record.trimStart, 0)),
        trimEnd: nullableNumber(record.trimEnd),
        fadeIn: fadeOr(record.fadeIn, defaults.fadeIn),
        fadeOut: fadeOr(record.fadeOut, defaults.fadeOut),
        randomPitch: clamp(numberOr(record.randomPitch, 0), 0, CLIP_RANDOM_PITCH_MAX),
        randomVolumeDb: clamp(numberOr(record.randomVolumeDb, 0), 0, CLIP_RANDOM_VOLUME_MAX_DB),
        effects: sanitizeEffectsSettings(record.effects),
    };
}
export interface ClipRegion {
    readonly start: number;
    readonly end: number;
}
export function clipRegion(settings: AudioClipSettings, duration: number): ClipRegion {
    const end = clamp(settings.trimEnd ?? duration, MIN_REGION_SECONDS, duration);
    const start = clamp(settings.trimStart, 0, Math.max(0, end - MIN_REGION_SECONDS));
    return { start, end };
}
export function loopRegion(settings: AudioClipSettings, duration: number): ClipRegion {
    const region = clipRegion(settings, duration);
    const end = clamp(settings.loopEnd ?? region.end, region.start + MIN_REGION_SECONDS, region.end);
    const start = clamp(settings.loopStart ?? region.start, region.start, end - MIN_REGION_SECONDS);
    return { start, end };
}
export function clipRate(settings: AudioClipSettings, pitchOffset = 0): number {
    return semitonesToRate(settings.pitch + pitchOffset);
}
export function neutralizeClip(settings: AudioClipSettings): AudioClipSettings {
    return {
        ...createClipSettings(),
        bus: settings.bus,
        loop: settings.loop,
        loopStart: settings.loopStart,
        loopEnd: settings.loopEnd,
        trimStart: settings.trimStart,
        trimEnd: settings.trimEnd,
    };
}
export function rollClipVariation(settings: AudioClipSettings): {
    pitchOffset: number;
    volumeOffsetDb: number;
} {
    const spread = () => Math.random() * 2 - 1;
    return {
        pitchOffset: settings.randomPitch > 0 ? spread() * settings.randomPitch : 0,
        volumeOffsetDb: settings.randomVolumeDb > 0 ? spread() * settings.randomVolumeDb : 0,
    };
}
