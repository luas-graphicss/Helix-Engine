import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
export type ToneMapper = 'aces' | 'agx' | 'filmic' | 'neutral' | 'reinhard' | 'none';
export const TONE_MAPPERS: readonly ToneMapper[] = ['aces', 'agx', 'filmic', 'neutral', 'reinhard', 'none'];
export interface WhiteBalanceSettings {
    temperature: number;
    tint: number;
}
export interface ColorGradingSettings {
    contrast: number;
    saturation: number;
    vibrance: number;
    shadows: number;
    midtones: number;
    highlights: number;
    shadowTint: Vec3;
    highlightTint: Vec3;
    toneBalance: number;
}
export interface BloomSettings {
    enabled: boolean;
    intensity: number;
    threshold: number;
    softKnee: number;
    radius: number;
}
export interface DepthOfFieldSettings {
    enabled: boolean;
    focusDistance: number;
    focalLength: number;
    aperture: number;
    maxBlur: number;
}
export interface VignetteSettings {
    enabled: boolean;
    intensity: number;
    smoothness: number;
    roundness: number;
}
export interface ChromaticAberrationSettings {
    enabled: boolean;
    intensity: number;
}
export interface FilmGrainSettings {
    enabled: boolean;
    intensity: number;
    size: number;
    luminanceResponse: number;
}
export interface LensDistortionSettings {
    enabled: boolean;
    intensity: number;
    scale: number;
}
export interface SharpenSettings {
    enabled: boolean;
    intensity: number;
}
export interface PostProcessSettings {
    enabled: boolean;
    exposure: number;
    toneMapper: ToneMapper;
    whiteBalance: WhiteBalanceSettings;
    grading: ColorGradingSettings;
    bloom: BloomSettings;
    depthOfField: DepthOfFieldSettings;
    vignette: VignetteSettings;
    chromaticAberration: ChromaticAberrationSettings;
    filmGrain: FilmGrainSettings;
    lensDistortion: LensDistortionSettings;
    sharpen: SharpenSettings;
}
export type PostProcessEffectKey = Exclude<keyof PostProcessSettings, 'enabled' | 'exposure' | 'toneMapper'>;
export const NEUTRAL_TINT = 0.2158605;
export type PostProcessSettingsOptions = Partial<Omit<PostProcessSettings, PostProcessEffectKey>> & {
    [K in PostProcessEffectKey]?: Partial<PostProcessSettings[K]>;
};
function neutralTint(): Vec3 {
    return vec3.create(NEUTRAL_TINT, NEUTRAL_TINT, NEUTRAL_TINT);
}
export function createPostProcessSettings(options: PostProcessSettingsOptions = {}): PostProcessSettings {
    const { whiteBalance, grading, bloom, depthOfField, vignette, chromaticAberration, filmGrain, lensDistortion, sharpen, ...rest } = options;
    return {
        enabled: true,
        exposure: 0,
        toneMapper: 'aces',
        ...rest,
        whiteBalance: { temperature: 0, tint: 0, ...whiteBalance },
        grading: {
            contrast: 0,
            saturation: 0,
            vibrance: 0,
            shadows: 0,
            midtones: 0,
            highlights: 0,
            toneBalance: 0,
            ...grading,
            shadowTint: grading?.shadowTint ? vec3.copy(vec3.create(), grading.shadowTint) : neutralTint(),
            highlightTint: grading?.highlightTint ? vec3.copy(vec3.create(), grading.highlightTint) : neutralTint(),
        },
        bloom: { enabled: true, intensity: 0.35, threshold: 1, softKnee: 0.5, radius: 0.55, ...bloom },
        depthOfField: { enabled: false, focusDistance: 12, focalLength: 50, aperture: 2.8, maxBlur: 16, ...depthOfField },
        vignette: { enabled: true, intensity: 0.25, smoothness: 0.6, roundness: 0.5, ...vignette },
        chromaticAberration: { enabled: false, intensity: 0.2, ...chromaticAberration },
        filmGrain: { enabled: false, intensity: 0.25, size: 1.6, luminanceResponse: 0.8, ...filmGrain },
        lensDistortion: { enabled: false, intensity: -0.2, scale: 1.05, ...lensDistortion },
        sharpen: { enabled: false, intensity: 0.4, ...sharpen },
    };
}
export function assignPostProcessSettings(target: PostProcessSettings, source: PostProcessSettings): void {
    target.enabled = source.enabled;
    target.exposure = source.exposure;
    target.toneMapper = source.toneMapper;
    Object.assign(target.whiteBalance, source.whiteBalance);
    const { shadowTint, highlightTint, ...gradingScalars } = source.grading;
    Object.assign(target.grading, gradingScalars);
    vec3.copy(target.grading.shadowTint, shadowTint);
    vec3.copy(target.grading.highlightTint, highlightTint);
    Object.assign(target.bloom, source.bloom);
    Object.assign(target.depthOfField, source.depthOfField);
    Object.assign(target.vignette, source.vignette);
    Object.assign(target.chromaticAberration, source.chromaticAberration);
    Object.assign(target.filmGrain, source.filmGrain);
    Object.assign(target.lensDistortion, source.lensDistortion);
    Object.assign(target.sharpen, source.sharpen);
}
export interface PostProcessPreset {
    readonly id: string;
    readonly name: string;
    readonly description: string;
    readonly create: () => PostProcessSettings;
}
function tint(r: number, g: number, b: number): Vec3 {
    const toLinear = (byte: number) => {
        const c = byte / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return vec3.create(toLinear(r), toLinear(g), toLinear(b));
}
export const POST_PROCESS_PRESETS: readonly PostProcessPreset[] = [
    {
        id: 'natural',
        name: 'Natural',
        description: 'Bloom discreto e vinheta leve: a referência da engine.',
        create: () => createPostProcessSettings(),
    },
    {
        id: 'cinematic',
        name: 'Cinematográfico',
        description: 'AgX com contraste, teal nas sombras, âmbar nos realces, grão fino e lente 50 mm aberta.',
        create: () => createPostProcessSettings({
            toneMapper: 'agx',
            exposure: 0.15,
            whiteBalance: { temperature: 0.08, tint: 0 },
            grading: {
                contrast: 0.18,
                saturation: -0.08,
                vibrance: 0.2,
                shadows: -0.1,
                highlights: 0.05,
                shadowTint: tint(96, 128, 140),
                highlightTint: tint(150, 132, 112),
                toneBalance: 0.1,
            },
            bloom: { enabled: true, intensity: 0.45, threshold: 0.9, softKnee: 0.6, radius: 0.7 },
            depthOfField: { enabled: true, focusDistance: 10, focalLength: 50, aperture: 1.8, maxBlur: 18 },
            vignette: { enabled: true, intensity: 0.4, smoothness: 0.7, roundness: 0.35 },
            filmGrain: { enabled: true, intensity: 0.18, size: 1.4, luminanceResponse: 0.85 },
            chromaticAberration: { enabled: true, intensity: 0.12 },
            sharpen: { enabled: true, intensity: 0.25 },
        }),
    },
    {
        id: 'vivid',
        name: 'Vibrante',
        description: 'Cores vivas, contraste alto e bloom generoso para mundos estilizados.',
        create: () => createPostProcessSettings({
            toneMapper: 'aces',
            exposure: 0.2,
            grading: { contrast: 0.25, saturation: 0.25, vibrance: 0.35, highlights: 0.1 },
            bloom: { enabled: true, intensity: 0.7, threshold: 0.85, softKnee: 0.7, radius: 0.6 },
            vignette: { enabled: true, intensity: 0.15, smoothness: 0.8, roundness: 0.5 },
            sharpen: { enabled: true, intensity: 0.5 },
        }),
    },
    {
        id: 'vintage',
        name: 'Vintage',
        description: 'Filme desbotado: pretos elevados, sépia nas sombras, grão forte e vinheta pesada.',
        create: () => createPostProcessSettings({
            toneMapper: 'filmic',
            exposure: 0.1,
            whiteBalance: { temperature: 0.25, tint: 0.05 },
            grading: {
                contrast: -0.1,
                saturation: -0.3,
                vibrance: 0.1,
                shadows: 0.35,
                highlights: -0.15,
                shadowTint: tint(140, 112, 86),
                highlightTint: tint(150, 140, 110),
                toneBalance: 0.2,
            },
            bloom: { enabled: true, intensity: 0.5, threshold: 0.7, softKnee: 0.9, radius: 0.9 },
            vignette: { enabled: true, intensity: 0.55, smoothness: 0.5, roundness: 0.6 },
            filmGrain: { enabled: true, intensity: 0.45, size: 2.2, luminanceResponse: 0.6 },
            chromaticAberration: { enabled: true, intensity: 0.3 },
            lensDistortion: { enabled: true, intensity: -0.12, scale: 1.03 },
        }),
    },
    {
        id: 'noir',
        name: 'Noir',
        description: 'Preto e branco de alto contraste, sombras densas e grão de celuloide.',
        create: () => createPostProcessSettings({
            toneMapper: 'filmic',
            exposure: -0.1,
            grading: { contrast: 0.45, saturation: -1, shadows: -0.25, midtones: -0.1, highlights: 0.1 },
            bloom: { enabled: true, intensity: 0.3, threshold: 1.1, softKnee: 0.4, radius: 0.5 },
            vignette: { enabled: true, intensity: 0.6, smoothness: 0.45, roundness: 0.4 },
            filmGrain: { enabled: true, intensity: 0.5, size: 1.8, luminanceResponse: 0.5 },
        }),
    },
    {
        id: 'dreamy',
        name: 'Sonho',
        description: 'Luz difusa e lavada: bloom amplo, sombras suaves, realces quentes e lente 85 mm.',
        create: () => createPostProcessSettings({
            toneMapper: 'agx',
            exposure: 0.35,
            whiteBalance: { temperature: 0.15, tint: -0.05 },
            grading: { contrast: -0.2, saturation: -0.05, vibrance: 0.25, shadows: 0.3, highlights: 0.1, highlightTint: tint(160, 140, 120), toneBalance: -0.2 },
            bloom: { enabled: true, intensity: 1.1, threshold: 0.6, softKnee: 1, radius: 1 },
            depthOfField: { enabled: true, focusDistance: 8, focalLength: 85, aperture: 1.4, maxBlur: 24 },
            vignette: { enabled: true, intensity: 0.2, smoothness: 1, roundness: 0.5 },
            filmGrain: { enabled: true, intensity: 0.1, size: 1.2, luminanceResponse: 0.9 },
        }),
    },
    {
        id: 'clean',
        name: 'Limpo',
        description: 'Sem efeitos de lente: tone mapping neutro, fiel aos materiais, só com nitidez.',
        create: () => createPostProcessSettings({
            toneMapper: 'neutral',
            bloom: { enabled: false },
            vignette: { enabled: false },
            sharpen: { enabled: true, intensity: 0.35 },
        }),
    },
];
export function findPostProcessPreset(id: string): PostProcessPreset | undefined {
    return POST_PROCESS_PRESETS.find((preset) => preset.id === id);
}
const EPSILON = 1e-4;
function settingsEqual(a: unknown, b: unknown): boolean {
    if (typeof a === 'number' && typeof b === 'number')
        return Math.abs(a - b) <= EPSILON;
    if (a instanceof Float32Array && b instanceof Float32Array) {
        return a.length === b.length && a.every((value, index) => Math.abs(value - b[index]) <= EPSILON);
    }
    if (a && b && typeof a === 'object' && typeof b === 'object') {
        const left = a as Record<string, unknown>;
        const right = b as Record<string, unknown>;
        const keys = Object.keys(left);
        return keys.length === Object.keys(right).length && keys.every((key) => settingsEqual(left[key], right[key]));
    }
    return a === b;
}
export function postProcessSettingsEqual(a: PostProcessSettings, b: PostProcessSettings): boolean {
    return settingsEqual(a, b);
}
export function matchPostProcessPreset(settings: PostProcessSettings): string | null {
    return POST_PROCESS_PRESETS.find((preset) => postProcessSettingsEqual(settings, preset.create()))?.id ?? null;
}
