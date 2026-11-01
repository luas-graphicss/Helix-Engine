import { createEffectsSettings, type AudioEffectsSettings } from './audio-effects';
import type { AudioClipSettings } from './audio-clip-settings';
export interface AudioClipPreset {
    readonly id: string;
    readonly label: string;
    readonly description: string;
    readonly apply: (settings: AudioClipSettings) => AudioClipSettings;
}
type EffectsPatch = {
    [K in keyof AudioEffectsSettings]?: Partial<AudioEffectsSettings[K]>;
};
function effects(patch: EffectsPatch): AudioEffectsSettings {
    const base = createEffectsSettings();
    for (const key of Object.keys(patch) as Array<keyof AudioEffectsSettings>) {
        Object.assign(base[key], { enabled: true }, patch[key]);
    }
    return base;
}
function withTone(settings: AudioClipSettings, patch: Partial<Pick<AudioClipSettings, 'volumeDb' | 'pitch' | 'pan'>>, chain: AudioEffectsSettings): AudioClipSettings {
    return { ...settings, volumeDb: patch.volumeDb ?? settings.volumeDb, pitch: patch.pitch ?? settings.pitch, pan: patch.pan ?? settings.pan, effects: chain };
}
export const AUDIO_CLIP_PRESETS: readonly AudioClipPreset[] = [
    {
        id: 'clean',
        label: 'Limpo',
        description: 'Desliga todos os efeitos e zera volume, tom e pan.',
        apply: (settings) => withTone(settings, { volumeDb: 0, pitch: 0, pan: 0 }, createEffectsSettings()),
    },
    {
        id: 'small-room',
        label: 'Sala pequena',
        description: 'Reverberação curta e discreta: um cômodo com móveis.',
        apply: (settings) => withTone(settings, {}, effects({ reverb: { size: 0.7, decay: 4, damping: 6000, preDelay: 0.008, mix: 0.22 } })),
    },
    {
        id: 'hall',
        label: 'Salão',
        description: 'Espaço amplo e claro, como um ginásio ou saguão.',
        apply: (settings) => withTone(settings, {}, effects({ reverb: { size: 3, decay: 2.5, damping: 7000, preDelay: 0.025, mix: 0.4 } })),
    },
    {
        id: 'cathedral',
        label: 'Catedral',
        description: 'Cauda longa e brilhante que demora a morrer.',
        apply: (settings) => withTone(settings, {}, effects({ reverb: { size: 7, decay: 1.6, damping: 5500, preDelay: 0.045, mix: 0.55 } })),
    },
    {
        id: 'cave',
        label: 'Caverna',
        description: 'Reverberação escura com ecos de pedra.',
        apply: (settings) => withTone(settings, {}, effects({ reverb: { size: 4.5, decay: 2.2, damping: 2800, preDelay: 0.03, mix: 0.5 }, delay: { time: 0.28, feedback: 0.35, damping: 2500, mix: 0.2 } })),
    },
    {
        id: 'distant',
        label: 'Ao longe',
        description: 'Abafado, mais baixo e espaçoso: vem de outro cômodo ou do fim da rua.',
        apply: (settings) => withTone(settings, { volumeDb: -9 }, effects({ filter: { type: 'lowpass', frequency: 1800, q: 0.7 }, reverb: { size: 3, decay: 2.5, damping: 3000, preDelay: 0.04, mix: 0.45 } })),
    },
    {
        id: 'underwater',
        label: 'Debaixo d’água',
        description: 'Graves pesados, agudos sumidos e tom levemente mais baixo.',
        apply: (settings) => withTone(settings, { pitch: -2 }, effects({ filter: { type: 'lowpass', frequency: 480, q: 1.2 }, reverb: { size: 2.5, decay: 3, damping: 1200, preDelay: 0.01, mix: 0.4 } })),
    },
    {
        id: 'radio',
        label: 'Rádio',
        description: 'Banda estreita, comprimido e com um pouco de saturação.',
        apply: (settings) => withTone(settings, {}, effects({
            filter: { type: 'bandpass', frequency: 1500, q: 0.8 },
            eq: { lowGainDb: -12, lowFrequency: 300, midGainDb: 4, midFrequency: 2200, midQ: 1.2, highGainDb: -10, highFrequency: 4000 },
            distortion: { drive: 0.25, mix: 0.6, oversample: true },
            compressor: { thresholdDb: -24, knee: 6, ratio: 8, attack: 0.003, release: 0.15, makeupDb: 6 },
        })),
    },
    {
        id: 'telephone',
        label: 'Telefone',
        description: 'Voz fina de linha telefônica.',
        apply: (settings) => withTone(settings, {}, effects({ filter: { type: 'bandpass', frequency: 1700, q: 1.6 }, distortion: { drive: 0.15, mix: 0.5, oversample: true } })),
    },
    {
        id: 'megaphone',
        label: 'Megafone',
        description: 'Médios gritados, agressivo e comprimido.',
        apply: (settings) => withTone(settings, {}, effects({
            filter: { type: 'highpass', frequency: 450, q: 0.9 },
            eq: { lowGainDb: -6, lowFrequency: 250, midGainDb: 8, midFrequency: 1600, midQ: 1.4, highGainDb: -4, highFrequency: 5000 },
            distortion: { drive: 0.55, mix: 0.8, oversample: true },
            compressor: { thresholdDb: -20, knee: 4, ratio: 10, attack: 0.002, release: 0.1, makeupDb: 5 },
        })),
    },
    {
        id: 'lofi',
        label: 'Lo-fi',
        description: 'Agudos cortados e saturação morna, como uma fita velha.',
        apply: (settings) => withTone(settings, {}, effects({
            eq: { lowGainDb: -3, lowFrequency: 150, midGainDb: 2, midFrequency: 800, midQ: 0.8, highGainDb: -14, highFrequency: 5000 },
            filter: { type: 'lowpass', frequency: 4500, q: 0.6 },
            distortion: { drive: 0.35, mix: 0.7, oversample: false },
        })),
    },
    {
        id: 'dream',
        label: 'Sonho',
        description: 'Ecos longos e reverberação envolvente, suavizados.',
        apply: (settings) => withTone(settings, {}, effects({ filter: { type: 'lowpass', frequency: 3800, q: 0.5 }, delay: { time: 0.42, feedback: 0.5, damping: 2200, mix: 0.35 }, reverb: { size: 5.5, decay: 1.8, damping: 3500, preDelay: 0.05, mix: 0.6 } })),
    },
    {
        id: 'punch',
        label: 'Impacto',
        description: 'Graves reforçados e compressão rápida para efeitos de ação.',
        apply: (settings) => withTone(settings, {}, effects({
            eq: { lowGainDb: 5, lowFrequency: 90, midGainDb: -2, midFrequency: 500, midQ: 1, highGainDb: 2, highFrequency: 6000 },
            compressor: { thresholdDb: -16, knee: 3, ratio: 6, attack: 0.003, release: 0.12, makeupDb: 4 },
        })),
    },
];
export function findClipPreset(id: string): AudioClipPreset | null {
    return AUDIO_CLIP_PRESETS.find((preset) => preset.id === id) ?? null;
}
