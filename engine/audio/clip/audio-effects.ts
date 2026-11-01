export type FilterKind = 'lowpass' | 'highpass' | 'bandpass' | 'notch';
export interface EqSettings {
    enabled: boolean;
    lowGainDb: number;
    lowFrequency: number;
    midGainDb: number;
    midFrequency: number;
    midQ: number;
    highGainDb: number;
    highFrequency: number;
}
export interface FilterSettings {
    enabled: boolean;
    type: FilterKind;
    frequency: number;
    q: number;
}
export interface DistortionSettings {
    enabled: boolean;
    drive: number;
    mix: number;
    oversample: boolean;
}
export interface CompressorSettings {
    enabled: boolean;
    thresholdDb: number;
    knee: number;
    ratio: number;
    attack: number;
    release: number;
    makeupDb: number;
}
export interface DelaySettings {
    enabled: boolean;
    time: number;
    feedback: number;
    damping: number;
    mix: number;
}
export interface ReverbSettings {
    enabled: boolean;
    size: number;
    decay: number;
    damping: number;
    preDelay: number;
    mix: number;
}
export interface AudioEffectsSettings {
    eq: EqSettings;
    filter: FilterSettings;
    distortion: DistortionSettings;
    compressor: CompressorSettings;
    delay: DelaySettings;
    reverb: ReverbSettings;
}
export type AudioEffectKey = keyof AudioEffectsSettings;
export const EFFECT_ORDER: readonly AudioEffectKey[] = ['eq', 'filter', 'distortion', 'compressor', 'delay', 'reverb'];
export const EFFECT_LABELS: Record<AudioEffectKey, string> = {
    eq: 'Equalizador',
    filter: 'Filtro',
    distortion: 'Distorção',
    compressor: 'Compressor',
    delay: 'Eco',
    reverb: 'Reverberação',
};
export const FILTER_KINDS: ReadonlyArray<{
    value: FilterKind;
    label: string;
}> = [
    { value: 'lowpass', label: 'Passa-baixas' },
    { value: 'highpass', label: 'Passa-altas' },
    { value: 'bandpass', label: 'Passa-banda' },
    { value: 'notch', label: 'Rejeita-banda' },
];
export function createEffectsSettings(): AudioEffectsSettings {
    return {
        eq: { enabled: false, lowGainDb: 0, lowFrequency: 200, midGainDb: 0, midFrequency: 1000, midQ: 1, highGainDb: 0, highFrequency: 4000 },
        filter: { enabled: false, type: 'lowpass', frequency: 8000, q: 0.7 },
        distortion: { enabled: false, drive: 0.3, mix: 1, oversample: true },
        compressor: { enabled: false, thresholdDb: -18, knee: 12, ratio: 4, attack: 0.01, release: 0.2, makeupDb: 0 },
        delay: { enabled: false, time: 0.3, feedback: 0.35, damping: 4000, mix: 0.3 },
        reverb: { enabled: false, size: 2, decay: 3, damping: 5000, preDelay: 0.02, mix: 0.3 },
    };
}
export function effectsTopologyKey(effects: AudioEffectsSettings): string {
    return [
        effects.eq.enabled ? 'eq' : '-',
        effects.filter.enabled ? `f:${effects.filter.type}` : '-',
        effects.distortion.enabled ? `d:${effects.distortion.oversample ? '4x' : '1x'}` : '-',
        effects.compressor.enabled ? 'c' : '-',
        effects.delay.enabled ? 'dl' : '-',
        effects.reverb.enabled ? 'rv' : '-',
    ].join('|');
}
export function countEnabledEffects(effects: AudioEffectsSettings): number {
    return EFFECT_ORDER.reduce((total, key) => (effects[key].enabled ? total + 1 : total), 0);
}
function mergeEffect<T extends object>(defaults: T, stored: unknown): T {
    if (!stored || typeof stored !== 'object')
        return { ...defaults };
    const result = { ...defaults };
    for (const key of Object.keys(defaults) as Array<keyof T>) {
        const value = (stored as Record<string, unknown>)[key as string];
        if (value !== undefined && typeof value === typeof defaults[key])
            result[key] = value as T[keyof T];
    }
    return result;
}
export function sanitizeEffectsSettings(stored: unknown): AudioEffectsSettings {
    const defaults = createEffectsSettings();
    const source = stored && typeof stored === 'object' ? (stored as Record<string, unknown>) : {};
    return {
        eq: mergeEffect(defaults.eq, source.eq),
        filter: mergeEffect(defaults.filter, source.filter),
        distortion: mergeEffect(defaults.distortion, source.distortion),
        compressor: mergeEffect(defaults.compressor, source.compressor),
        delay: mergeEffect(defaults.delay, source.delay),
        reverb: mergeEffect(defaults.reverb, source.reverb),
    };
}
