import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import * as mat4 from '@/engine/core/math/mat4';
import type { Mat4 } from '@/engine/core/math/mat4';
import { clamp } from '@/engine/audio/core/decibels';
import type { DelaySettings, ReverbSettings } from '@/engine/audio/clip/audio-effects';
export type AudioZoneShape = 'box' | 'sphere';
export interface AudioZoneFilter {
    enabled: boolean;
    frequency: number;
}
export interface AudioZoneAmbience {
    assetId: string | null;
    volumeDb: number;
}
export interface AudioZoneSettings {
    readonly version: 1;
    enabled: boolean;
    shape: AudioZoneShape;
    size: Vec3;
    radius: number;
    falloff: number;
    priority: number;
    reverb: ReverbSettings;
    echo: DelaySettings;
    filter: AudioZoneFilter;
    ambience: AudioZoneAmbience;
}
export const ZONE_SIZE_MIN = 0.25;
export const ZONE_SIZE_MAX = 1000;
export const ZONE_FALLOFF_MAX = 50;
export const ZONE_PRIORITY_MAX = 10;
export const ZONE_AMBIENCE_MIN_DB = -60;
export const ZONE_AMBIENCE_MAX_DB = 12;
export const AUDIO_ZONE_SHAPES: ReadonlyArray<{
    value: AudioZoneShape;
    label: string;
}> = [
    { value: 'box', label: 'Caixa' },
    { value: 'sphere', label: 'Esfera' },
];
export function createZoneReverb(options: Partial<ReverbSettings> = {}): ReverbSettings {
    return {
        enabled: options.enabled ?? true,
        size: options.size ?? 1.8,
        decay: options.decay ?? 3,
        damping: options.damping ?? 5000,
        preDelay: options.preDelay ?? 0.015,
        mix: options.mix ?? 0.35,
    };
}
export function createZoneEcho(options: Partial<DelaySettings> = {}): DelaySettings {
    return {
        enabled: options.enabled ?? false,
        time: options.time ?? 0.35,
        feedback: options.feedback ?? 0.3,
        damping: options.damping ?? 3000,
        mix: options.mix ?? 0.25,
    };
}
export function createAudioZoneSettings(options: Partial<Omit<AudioZoneSettings, 'size'>> & {
    size?: Vec3 | readonly [
        number,
        number,
        number
    ];
} = {}): AudioZoneSettings {
    const size = options.size ? vec3.create(options.size[0], options.size[1], options.size[2]) : vec3.create(8, 3.5, 8);
    return {
        version: 1,
        enabled: options.enabled ?? true,
        shape: options.shape ?? 'box',
        size,
        radius: options.radius ?? 5,
        falloff: options.falloff ?? 1.5,
        priority: options.priority ?? 5,
        reverb: options.reverb ? { ...options.reverb } : createZoneReverb(),
        echo: options.echo ? { ...options.echo } : createZoneEcho(),
        filter: options.filter ? { ...options.filter } : { enabled: false, frequency: 900 },
        ambience: options.ambience ? { ...options.ambience } : { assetId: null, volumeDb: -6 },
    };
}
export function cloneAudioZoneSettings(settings: AudioZoneSettings): AudioZoneSettings {
    return {
        ...settings,
        size: vec3.copy(vec3.create(), settings.size),
        reverb: { ...settings.reverb },
        echo: { ...settings.echo },
        filter: { ...settings.filter },
        ambience: { ...settings.ambience },
    };
}
function numberOr(value: unknown, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
function mergeNumbers<T extends object>(defaults: T, stored: unknown): T {
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
export function sanitizeAudioZoneSettings(stored: unknown): AudioZoneSettings {
    const defaults = createAudioZoneSettings();
    if (!stored || typeof stored !== 'object')
        return defaults;
    const record = stored as Record<string, unknown>;
    const rawSize = record.size;
    const size = rawSize && typeof rawSize === 'object' && 'length' in rawSize && (rawSize as ArrayLike<number>).length >= 3
        ? vec3.create(clamp(numberOr((rawSize as ArrayLike<number>)[0], defaults.size[0]), ZONE_SIZE_MIN, ZONE_SIZE_MAX), clamp(numberOr((rawSize as ArrayLike<number>)[1], defaults.size[1]), ZONE_SIZE_MIN, ZONE_SIZE_MAX), clamp(numberOr((rawSize as ArrayLike<number>)[2], defaults.size[2]), ZONE_SIZE_MIN, ZONE_SIZE_MAX))
        : defaults.size;
    const ambience = (record.ambience && typeof record.ambience === 'object' ? record.ambience : {}) as Partial<AudioZoneAmbience>;
    return {
        version: 1,
        enabled: record.enabled !== false,
        shape: AUDIO_ZONE_SHAPES.some((shape) => shape.value === record.shape) ? (record.shape as AudioZoneShape) : defaults.shape,
        size,
        radius: clamp(numberOr(record.radius, defaults.radius), ZONE_SIZE_MIN * 0.5, ZONE_SIZE_MAX * 0.5),
        falloff: clamp(numberOr(record.falloff, defaults.falloff), 0, ZONE_FALLOFF_MAX),
        priority: clamp(Math.round(numberOr(record.priority, defaults.priority)), 0, ZONE_PRIORITY_MAX),
        reverb: mergeNumbers(defaults.reverb, record.reverb),
        echo: mergeNumbers(defaults.echo, record.echo),
        filter: mergeNumbers(defaults.filter, record.filter),
        ambience: {
            assetId: typeof ambience.assetId === 'string' ? ambience.assetId : null,
            volumeDb: clamp(numberOr(ambience.volumeDb, defaults.ambience.volumeDb), ZONE_AMBIENCE_MIN_DB, ZONE_AMBIENCE_MAX_DB),
        },
    };
}
const inverse = mat4.create();
const local = vec3.create();
const axisScale = vec3.create();
function columnLength(m: Mat4, column: number): number {
    const i = column * 4;
    return Math.hypot(m[i], m[i + 1], m[i + 2]) || 1;
}
export function zoneWorldVolume(settings: AudioZoneSettings, worldMatrix: Mat4): number {
    const sx = columnLength(worldMatrix, 0);
    const sy = columnLength(worldMatrix, 1);
    const sz = columnLength(worldMatrix, 2);
    if (settings.shape === 'sphere') {
        const r = settings.radius * ((sx + sy + sz) / 3);
        return (4 / 3) * Math.PI * r * r * r;
    }
    return settings.size[0] * sx * settings.size[1] * sy * settings.size[2] * sz;
}
export function zoneWeightAt(settings: AudioZoneSettings, worldMatrix: Mat4, point: Vec3): number {
    if (!settings.enabled || !mat4.invert(inverse, worldMatrix))
        return 0;
    mat4.transformPoint(local, inverse, point);
    vec3.set(axisScale, columnLength(worldMatrix, 0), columnLength(worldMatrix, 1), columnLength(worldMatrix, 2));
    let outside: number;
    if (settings.shape === 'sphere') {
        const scale = (axisScale[0] + axisScale[1] + axisScale[2]) / 3;
        outside = Math.max(0, vec3.length(local) * scale - settings.radius * scale);
    }
    else {
        let sum = 0;
        for (let axis = 0; axis < 3; axis++) {
            const half = settings.size[axis] * 0.5;
            const over = Math.max(0, Math.abs(local[axis]) - half) * axisScale[axis];
            sum += over * over;
        }
        outside = Math.sqrt(sum);
    }
    if (outside <= 0)
        return 1;
    if (settings.falloff <= 0)
        return 0;
    const t = Math.min(1, outside / settings.falloff);
    return 1 - t * t * (3 - 2 * t);
}
export interface AudioZonePreset {
    readonly id: string;
    readonly label: string;
    readonly description: string;
    readonly create: () => Pick<AudioZoneSettings, 'reverb' | 'echo' | 'filter'>;
}
export const AUDIO_ZONE_PRESETS: readonly AudioZonePreset[] = [
    {
        id: 'small-room',
        label: 'Sala pequena',
        description: 'Quarto, escritório: cauda curta e seca.',
        create: () => ({ reverb: createZoneReverb({ size: 0.6, decay: 4, damping: 4500, preDelay: 0.008, mix: 0.22 }), echo: createZoneEcho(), filter: { enabled: false, frequency: 900 } }),
    },
    {
        id: 'large-room',
        label: 'Sala grande',
        description: 'Sala de estar ampla, loja: presença sem borrar.',
        create: () => ({ reverb: createZoneReverb({ size: 1.4, decay: 3.2, damping: 5000, preDelay: 0.015, mix: 0.3 }), echo: createZoneEcho(), filter: { enabled: false, frequency: 900 } }),
    },
    {
        id: 'corridor',
        label: 'Corredor',
        description: 'Paredes próximas: reflexões rápidas e um eco curto.',
        create: () => ({
            reverb: createZoneReverb({ size: 1, decay: 3.5, damping: 4000, preDelay: 0.01, mix: 0.3 }),
            echo: createZoneEcho({ enabled: true, time: 0.09, feedback: 0.25, damping: 3500, mix: 0.18 }),
            filter: { enabled: false, frequency: 900 },
        }),
    },
    {
        id: 'bathroom',
        label: 'Banheiro (azulejos)',
        description: 'Superfícies duras: brilhante e metálico.',
        create: () => ({ reverb: createZoneReverb({ size: 1.1, decay: 2.2, damping: 9000, preDelay: 0.006, mix: 0.4 }), echo: createZoneEcho(), filter: { enabled: false, frequency: 900 } }),
    },
    {
        id: 'hall',
        label: 'Salão / teatro',
        description: 'Cauda longa e escura, pré-atraso perceptível.',
        create: () => ({ reverb: createZoneReverb({ size: 3.2, decay: 2.4, damping: 3500, preDelay: 0.03, mix: 0.4 }), echo: createZoneEcho(), filter: { enabled: false, frequency: 900 } }),
    },
    {
        id: 'cathedral',
        label: 'Catedral',
        description: 'Cauda muito longa e luminosa; o som demora a morrer.',
        create: () => ({ reverb: createZoneReverb({ size: 6, decay: 1.6, damping: 6000, preDelay: 0.045, mix: 0.5 }), echo: createZoneEcho(), filter: { enabled: false, frequency: 900 } }),
    },
    {
        id: 'cave',
        label: 'Caverna',
        description: 'Pedra úmida: cauda longa e abafada com um rebate atrás.',
        create: () => ({
            reverb: createZoneReverb({ size: 4, decay: 1.9, damping: 2200, preDelay: 0.035, mix: 0.5 }),
            echo: createZoneEcho({ enabled: true, time: 0.28, feedback: 0.3, damping: 1800, mix: 0.22 }),
            filter: { enabled: false, frequency: 900 },
        }),
    },
    {
        id: 'canyon',
        label: 'Cânion (eco)',
        description: 'Ao ar livre entre paredões: pouca cauda, eco longo e nítido.',
        create: () => ({
            reverb: createZoneReverb({ size: 1.5, decay: 4, damping: 3000, preDelay: 0.02, mix: 0.15 }),
            echo: createZoneEcho({ enabled: true, time: 0.65, feedback: 0.42, damping: 2500, mix: 0.35 }),
            filter: { enabled: false, frequency: 900 },
        }),
    },
    {
        id: 'forest',
        label: 'Floresta (aberto)',
        description: 'Sem paredes: só um sopro de reflexões difusas das árvores.',
        create: () => ({ reverb: createZoneReverb({ size: 0.9, decay: 5, damping: 2600, preDelay: 0.02, mix: 0.12 }), echo: createZoneEcho(), filter: { enabled: false, frequency: 900 } }),
    },
    {
        id: 'hangar',
        label: 'Hangar / galpão',
        description: 'Metal e concreto em grande volume: cauda longa e ressoante.',
        create: () => ({
            reverb: createZoneReverb({ size: 4.5, decay: 1.8, damping: 4200, preDelay: 0.04, mix: 0.45 }),
            echo: createZoneEcho({ enabled: true, time: 0.18, feedback: 0.2, damping: 3000, mix: 0.15 }),
            filter: { enabled: false, frequency: 900 },
        }),
    },
    {
        id: 'underwater',
        label: "Debaixo d'água",
        description: 'Tudo abafado e lento, com uma cauda surda.',
        create: () => ({
            reverb: createZoneReverb({ size: 2.5, decay: 2.5, damping: 900, preDelay: 0.01, mix: 0.35 }),
            echo: createZoneEcho(),
            filter: { enabled: true, frequency: 520 },
        }),
    },
    {
        id: 'dry',
        label: 'Seco (sem acústica)',
        description: 'Desliga a reverberação do lugar: útil para isolar uma área dentro de outra zona.',
        create: () => ({ reverb: createZoneReverb({ enabled: false }), echo: createZoneEcho(), filter: { enabled: false, frequency: 900 } }),
    },
];
export function findAudioZonePreset(id: string): AudioZonePreset | null {
    return AUDIO_ZONE_PRESETS.find((preset) => preset.id === id) ?? null;
}
