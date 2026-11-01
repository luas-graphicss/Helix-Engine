import { clamp, dbToGain, gainToDb } from '@/engine/audio/core/decibels';
export type AudioDistanceModel = 'inverse' | 'linear' | 'exponential';
export type AudioPanningModel = 'equalpower' | 'hrtf';
export type AudioSourceTrigger = 'auto' | 'proximity' | 'manual';
export type AudioSourceLoopMode = 'clip' | 'loop' | 'once';
export interface AudioSourceCone {
    enabled: boolean;
    innerAngle: number;
    outerAngle: number;
    outerGainDb: number;
}
export interface AudioSourceOcclusion {
    enabled: boolean;
    attenuationDb: number;
    lowpass: number;
}
export interface AudioSourceSettings {
    readonly version: 1;
    assetId: string | null;
    muted: boolean;
    volumeDb: number;
    pitch: number;
    loopMode: AudioSourceLoopMode;
    trigger: AudioSourceTrigger;
    triggerRadius: number;
    stopOnExit: boolean;
    fadeIn: number;
    fadeOut: number;
    repeatMin: number;
    repeatMax: number;
    randomStart: boolean;
    spatial: boolean;
    panningModel: AudioPanningModel;
    distanceModel: AudioDistanceModel;
    minDistance: number;
    maxDistance: number;
    rolloff: number;
    airAbsorption: number;
    cone: AudioSourceCone;
    doppler: number;
    occlusion: AudioSourceOcclusion;
    reverbSend: number;
    priority: number;
}
export const SOURCE_VOLUME_MIN_DB = -60;
export const SOURCE_VOLUME_MAX_DB = 12;
export const SOURCE_PITCH_RANGE = 24;
export const SOURCE_MIN_DISTANCE_MIN = 0.1;
export const SOURCE_MAX_DISTANCE_MAX = 2000;
export const SOURCE_ROLLOFF_MAX = 8;
export const SOURCE_AIR_ABSORPTION_MAX = 2;
export const SOURCE_FADE_MAX_SECONDS = 30;
export const SOURCE_REPEAT_MAX_SECONDS = 600;
export const SOURCE_DOPPLER_MAX = 4;
export const SOURCE_PRIORITY_MAX = 10;
export const CONE_OUTER_GAIN_MIN_DB = -60;
export const OCCLUSION_ATTENUATION_MIN_DB = -60;
export const RANGE_FADE_FRACTION = 0.12;
export const SPEED_OF_SOUND = 343;
export const AUDIO_DISTANCE_MODELS: ReadonlyArray<{
    value: AudioDistanceModel;
    label: string;
    description: string;
}> = [
    { value: 'inverse', label: 'Inverso', description: 'Lei física 1/d: cai rápido perto, devagar longe. O padrão para quase tudo.' },
    { value: 'linear', label: 'Linear', description: 'Queda reta até o alcance máximo: previsível, bom para ambientes e música ligada a um lugar.' },
    { value: 'exponential', label: 'Exponencial', description: 'Cai mais depressa que o inverso: sons que precisam ficar bem locais.' },
];
export const AUDIO_PANNING_MODELS: ReadonlyArray<{
    value: AudioPanningModel;
    label: string;
}> = [
    { value: 'equalpower', label: 'Estéreo' },
    { value: 'hrtf', label: 'HRTF' },
];
export const AUDIO_SOURCE_TRIGGERS: ReadonlyArray<{
    value: AudioSourceTrigger;
    label: string;
    description: string;
}> = [
    { value: 'auto', label: 'Automático', description: 'Começa com o jogo (e na audição do editor) e segue enquanto estiver ao alcance.' },
    { value: 'proximity', label: 'Proximidade', description: 'Dispara quando o ouvinte entra no raio do gatilho.' },
    { value: 'manual', label: 'Manual', description: 'Só toca por comando: o botão do inspetor, a lista da cena ou um script.' },
];
export const AUDIO_SOURCE_LOOP_MODES: ReadonlyArray<{
    value: AudioSourceLoopMode;
    label: string;
}> = [
    { value: 'clip', label: 'Do clipe' },
    { value: 'loop', label: 'Laço' },
    { value: 'once', label: 'Uma vez' },
];
export const AUDIO_SOURCE_TRIGGER_LABEL: Record<AudioSourceTrigger, string> = { auto: 'Automático', proximity: 'Proximidade', manual: 'Manual' };
export function createAudioSourceCone(options: Partial<AudioSourceCone> = {}): AudioSourceCone {
    return {
        enabled: options.enabled ?? false,
        innerAngle: options.innerAngle ?? 60,
        outerAngle: options.outerAngle ?? 150,
        outerGainDb: options.outerGainDb ?? -18,
    };
}
export function createAudioSourceOcclusion(options: Partial<AudioSourceOcclusion> = {}): AudioSourceOcclusion {
    return {
        enabled: options.enabled ?? true,
        attenuationDb: options.attenuationDb ?? -12,
        lowpass: options.lowpass ?? 1200,
    };
}
export function createAudioSourceSettings(options: Partial<AudioSourceSettings> = {}): AudioSourceSettings {
    return {
        version: 1,
        assetId: options.assetId ?? null,
        muted: options.muted ?? false,
        volumeDb: options.volumeDb ?? 0,
        pitch: options.pitch ?? 0,
        loopMode: options.loopMode ?? 'clip',
        trigger: options.trigger ?? 'auto',
        triggerRadius: options.triggerRadius ?? 0,
        stopOnExit: options.stopOnExit ?? true,
        fadeIn: options.fadeIn ?? 0.25,
        fadeOut: options.fadeOut ?? 0.4,
        repeatMin: options.repeatMin ?? 0,
        repeatMax: options.repeatMax ?? 0,
        randomStart: options.randomStart ?? true,
        spatial: options.spatial ?? true,
        panningModel: options.panningModel ?? 'equalpower',
        distanceModel: options.distanceModel ?? 'inverse',
        minDistance: options.minDistance ?? 1.5,
        maxDistance: options.maxDistance ?? 30,
        rolloff: options.rolloff ?? 1,
        airAbsorption: options.airAbsorption ?? 1,
        cone: options.cone ? { ...options.cone } : createAudioSourceCone(),
        doppler: options.doppler ?? 0,
        occlusion: options.occlusion ? { ...options.occlusion } : createAudioSourceOcclusion(),
        reverbSend: options.reverbSend ?? 0.5,
        priority: options.priority ?? 5,
    };
}
export function cloneAudioSourceSettings(settings: AudioSourceSettings): AudioSourceSettings {
    return { ...settings, cone: { ...settings.cone }, occlusion: { ...settings.occlusion } };
}
function numberOr(value: unknown, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
function oneOf<T extends string>(value: unknown, options: ReadonlyArray<{
    value: T;
}>, fallback: T): T {
    return options.some((option) => option.value === value) ? (value as T) : fallback;
}
export function sanitizeAudioSourceSettings(stored: unknown): AudioSourceSettings {
    const defaults = createAudioSourceSettings();
    if (!stored || typeof stored !== 'object')
        return defaults;
    const record = stored as Record<string, unknown>;
    const cone = (record.cone && typeof record.cone === 'object' ? record.cone : {}) as Partial<AudioSourceCone>;
    const occlusion = (record.occlusion && typeof record.occlusion === 'object' ? record.occlusion : {}) as Partial<AudioSourceOcclusion>;
    const minDistance = clamp(numberOr(record.minDistance, defaults.minDistance), SOURCE_MIN_DISTANCE_MIN, SOURCE_MAX_DISTANCE_MAX);
    const outerAngle = clamp(numberOr(cone.outerAngle, defaults.cone.outerAngle), 1, 360);
    return {
        version: 1,
        assetId: typeof record.assetId === 'string' ? record.assetId : null,
        muted: record.muted === true,
        volumeDb: clamp(numberOr(record.volumeDb, 0), SOURCE_VOLUME_MIN_DB, SOURCE_VOLUME_MAX_DB),
        pitch: clamp(numberOr(record.pitch, 0), -SOURCE_PITCH_RANGE, SOURCE_PITCH_RANGE),
        loopMode: oneOf(record.loopMode, AUDIO_SOURCE_LOOP_MODES, defaults.loopMode),
        trigger: oneOf(record.trigger, AUDIO_SOURCE_TRIGGERS, defaults.trigger),
        triggerRadius: clamp(numberOr(record.triggerRadius, 0), 0, SOURCE_MAX_DISTANCE_MAX),
        stopOnExit: record.stopOnExit !== false,
        fadeIn: clamp(numberOr(record.fadeIn, defaults.fadeIn), 0, SOURCE_FADE_MAX_SECONDS),
        fadeOut: clamp(numberOr(record.fadeOut, defaults.fadeOut), 0, SOURCE_FADE_MAX_SECONDS),
        repeatMin: clamp(numberOr(record.repeatMin, 0), 0, SOURCE_REPEAT_MAX_SECONDS),
        repeatMax: clamp(numberOr(record.repeatMax, 0), 0, SOURCE_REPEAT_MAX_SECONDS),
        randomStart: record.randomStart !== false,
        spatial: record.spatial !== false,
        panningModel: oneOf(record.panningModel, AUDIO_PANNING_MODELS, defaults.panningModel),
        distanceModel: oneOf(record.distanceModel, AUDIO_DISTANCE_MODELS, defaults.distanceModel),
        minDistance,
        maxDistance: clamp(numberOr(record.maxDistance, defaults.maxDistance), minDistance, SOURCE_MAX_DISTANCE_MAX),
        rolloff: clamp(numberOr(record.rolloff, 1), 0, SOURCE_ROLLOFF_MAX),
        airAbsorption: clamp(numberOr(record.airAbsorption, defaults.airAbsorption), 0, SOURCE_AIR_ABSORPTION_MAX),
        cone: {
            enabled: cone.enabled === true,
            innerAngle: clamp(numberOr(cone.innerAngle, defaults.cone.innerAngle), 0, outerAngle),
            outerAngle,
            outerGainDb: clamp(numberOr(cone.outerGainDb, defaults.cone.outerGainDb), CONE_OUTER_GAIN_MIN_DB, 0),
        },
        doppler: clamp(numberOr(record.doppler, 0), 0, SOURCE_DOPPLER_MAX),
        occlusion: {
            enabled: occlusion.enabled !== false,
            attenuationDb: clamp(numberOr(occlusion.attenuationDb, defaults.occlusion.attenuationDb), OCCLUSION_ATTENUATION_MIN_DB, 0),
            lowpass: clamp(numberOr(occlusion.lowpass, defaults.occlusion.lowpass), 100, 20000),
        },
        reverbSend: clamp(numberOr(record.reverbSend, defaults.reverbSend), 0, 1),
        priority: clamp(Math.round(numberOr(record.priority, defaults.priority)), 0, SOURCE_PRIORITY_MAX),
    };
}
export function effectiveTriggerRadius(settings: AudioSourceSettings): number {
    return settings.triggerRadius > 0 ? settings.triggerRadius : settings.maxDistance;
}
export function distanceModelGain(settings: AudioSourceSettings, distance: number): number {
    const ref = Math.max(settings.minDistance, 1e-3);
    const max = Math.max(settings.maxDistance, ref + 1e-3);
    const rolloff = Math.max(settings.rolloff, 0);
    const d = Math.max(distance, ref);
    switch (settings.distanceModel) {
        case 'linear':
            return Math.max(0, 1 - (rolloff * (Math.min(d, max) - ref)) / (max - ref));
        case 'exponential':
            return Math.pow(d / ref, -rolloff);
        default:
            return ref / (ref + rolloff * (d - ref));
    }
}
export function rangeFadeGain(settings: AudioSourceSettings, distance: number): number {
    const max = settings.maxDistance;
    const fadeStart = max * (1 - RANGE_FADE_FRACTION);
    if (distance <= fadeStart)
        return 1;
    if (distance >= max)
        return 0;
    const t = (distance - fadeStart) / (max - fadeStart);
    return 1 - t * t * (3 - 2 * t);
}
export function sourceDistanceGain(settings: AudioSourceSettings, distance: number): number {
    if (!settings.spatial)
        return 1;
    return distanceModelGain(settings, distance) * rangeFadeGain(settings, distance);
}
export function sourceDistanceDb(settings: AudioSourceSettings, distance: number): number {
    return gainToDb(sourceDistanceGain(settings, distance));
}
const REVERB_DISTANCE_COMPENSATION_MAX = 4;
export function reverbSendGain(settings: AudioSourceSettings, distance: number): number {
    if (!settings.spatial)
        return settings.reverbSend;
    const direct = Math.max(distanceModelGain(settings, distance), 1e-4);
    return settings.reverbSend * Math.min(REVERB_DISTANCE_COMPENSATION_MAX, 1 / Math.sqrt(direct));
}
export function coneGain(cone: AudioSourceCone, angleDegrees: number): number {
    if (!cone.enabled)
        return 1;
    const inner = cone.innerAngle * 0.5;
    const outer = Math.max(cone.outerAngle * 0.5, inner + 1e-3);
    const outerGain = dbToGain(cone.outerGainDb);
    if (angleDegrees <= inner)
        return 1;
    if (angleDegrees >= outer)
        return outerGain;
    const t = (angleDegrees - inner) / (outer - inner);
    return 1 + (outerGain - 1) * t;
}
export interface AudioSourcePreset {
    readonly id: string;
    readonly label: string;
    readonly description: string;
    readonly apply: (current: AudioSourceSettings) => AudioSourceSettings;
}
