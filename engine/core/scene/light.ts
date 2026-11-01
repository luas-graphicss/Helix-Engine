import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
export interface DirectionalLight {
    readonly type: 'directional';
    color: Vec3;
    intensity: number;
    castShadows: boolean;
}
export interface AmbientLight {
    readonly type: 'ambient';
    skyColor: Vec3;
    groundColor: Vec3;
    intensity: number;
}
export type LocalLightType = 'point' | 'spot' | 'rect' | 'disc' | 'tube';
export type LightAnimation = 'none' | 'flicker' | 'pulse' | 'strobe';
export interface LocalLightShadow {
    enabled: boolean;
    softness: number;
    bias: number;
    normalBias: number;
    strength: number;
}
export interface LocalLightBase {
    color: Vec3;
    temperature: number | null;
    intensity: number;
    range: number;
    falloff: number;
    sourceRadius: number;
    specular: number;
    shadow: LocalLightShadow;
    animation: LightAnimation;
    animationSpeed: number;
    animationAmount: number;
}
export interface PointLight extends LocalLightBase {
    readonly type: 'point';
}
export interface SpotLight extends LocalLightBase {
    readonly type: 'spot';
    innerAngle: number;
    outerAngle: number;
}
export interface RectLight extends LocalLightBase {
    readonly type: 'rect';
    width: number;
    height: number;
    twoSided: boolean;
}
export interface DiscLight extends LocalLightBase {
    readonly type: 'disc';
    radius: number;
    twoSided: boolean;
}
export interface TubeLight extends LocalLightBase {
    readonly type: 'tube';
    length: number;
}
export type LocalLight = PointLight | SpotLight | RectLight | DiscLight | TubeLight;
export type Light = DirectionalLight | AmbientLight | LocalLight;
export const LOCAL_LIGHT_TYPES: readonly LocalLightType[] = ['point', 'spot', 'rect', 'disc', 'tube'];
export const LOCAL_LIGHT_LABEL: Record<LocalLightType, string> = {
    point: 'Luz pontual',
    spot: 'Luz cônica',
    rect: 'Painel de luz',
    disc: 'Disco de luz',
    tube: 'Tubo de luz',
};
export const LOCAL_LIGHT_SHORT_LABEL: Record<LocalLightType, string> = {
    point: 'Pontual',
    spot: 'Cone',
    rect: 'Painel',
    disc: 'Disco',
    tube: 'Tubo',
};
export const LIGHT_ANIMATION_LABEL: Record<LightAnimation, string> = {
    none: 'Fixa',
    flicker: 'Tremular',
    pulse: 'Pulsar',
    strobe: 'Estrobo',
};
export const MIN_LIGHT_TEMPERATURE = 1000;
export const MAX_LIGHT_TEMPERATURE = 12000;
export const MAX_SPOT_ANGLE = 80;
const AUTO_RANGE_THRESHOLD = 0.02;
const MIN_AUTO_RANGE = 1;
const MAX_AUTO_RANGE = 60;
export function isLocalLight(light: Light | null | undefined): light is LocalLight {
    return light !== null && light !== undefined && light.type !== 'directional' && light.type !== 'ambient';
}
export function createLocalLightShadow(options: Partial<LocalLightShadow> = {}): LocalLightShadow {
    return {
        enabled: options.enabled ?? false,
        softness: options.softness ?? 0.35,
        bias: options.bias ?? 0.3,
        normalBias: options.normalBias ?? 1.5,
        strength: options.strength ?? 1,
    };
}
function createLocalBase(options: Partial<LocalLightBase>): LocalLightBase {
    return {
        color: options.color ?? vec3.create(1, 0.93, 0.82),
        temperature: options.temperature ?? null,
        intensity: options.intensity ?? 15,
        range: options.range ?? 10,
        falloff: options.falloff ?? 2,
        sourceRadius: options.sourceRadius ?? 0.05,
        specular: options.specular ?? 1,
        shadow: options.shadow ? { ...options.shadow } : createLocalLightShadow(),
        animation: options.animation ?? 'none',
        animationSpeed: options.animationSpeed ?? 2,
        animationAmount: options.animationAmount ?? 0.3,
    };
}
export function createPointLight(options: Partial<Omit<PointLight, 'type'>> = {}): PointLight {
    return { type: 'point', ...createLocalBase(options) };
}
export function createSpotLight(options: Partial<Omit<SpotLight, 'type'>> = {}): SpotLight {
    const outerAngle = Math.min(options.outerAngle ?? 35, MAX_SPOT_ANGLE);
    return {
        type: 'spot',
        ...createLocalBase({ intensity: 40, ...options }),
        innerAngle: Math.min(options.innerAngle ?? outerAngle * 0.7, outerAngle),
        outerAngle,
    };
}
export function createRectLight(options: Partial<Omit<RectLight, 'type'>> = {}): RectLight {
    return {
        type: 'rect',
        ...createLocalBase({ intensity: 12, sourceRadius: 0, ...options }),
        width: options.width ?? 1.2,
        height: options.height ?? 0.6,
        twoSided: options.twoSided ?? false,
    };
}
export function createDiscLight(options: Partial<Omit<DiscLight, 'type'>> = {}): DiscLight {
    return {
        type: 'disc',
        ...createLocalBase({ intensity: 12, sourceRadius: 0, ...options }),
        radius: options.radius ?? 0.5,
        twoSided: options.twoSided ?? false,
    };
}
export function createTubeLight(options: Partial<Omit<TubeLight, 'type'>> = {}): TubeLight {
    return {
        type: 'tube',
        ...createLocalBase({ intensity: 10, sourceRadius: 0.03, color: vec3.create(0.85, 0.95, 1), ...options }),
        length: options.length ?? 1.2,
    };
}
export function createLocalLight(type: LocalLightType, options: Partial<LocalLightBase> = {}): LocalLight {
    switch (type) {
        case 'point':
            return createPointLight(options);
        case 'spot':
            return createSpotLight(options);
        case 'rect':
            return createRectLight(options);
        case 'disc':
            return createDiscLight(options);
        case 'tube':
            return createTubeLight(options);
    }
}
export function createDirectionalLight(options: Partial<Omit<DirectionalLight, 'type'>> = {}): DirectionalLight {
    return {
        type: 'directional',
        color: options.color ?? vec3.create(1, 0.98, 0.95),
        intensity: options.intensity ?? 3.2,
        castShadows: options.castShadows ?? true,
    };
}
export function createAmbientLight(options: Partial<Omit<AmbientLight, 'type'>> = {}): AmbientLight {
    return {
        type: 'ambient',
        skyColor: options.skyColor ?? vec3.create(0.45, 0.55, 0.72),
        groundColor: options.groundColor ?? vec3.create(0.18, 0.15, 0.13),
        intensity: options.intensity ?? 0.4,
    };
}
export function shadowFaceCount(light: LocalLight): number {
    switch (light.type) {
        case 'spot':
            return 1;
        case 'rect':
        case 'disc':
            return light.twoSided ? 6 : 5;
        default:
            return 6;
    }
}
export function effectiveLightRange(light: LocalLight): number {
    if (light.range > 0)
        return light.range;
    const falloff = Math.max(light.falloff, 0.5);
    const range = Math.pow(Math.max(light.intensity, 1e-3) / AUTO_RANGE_THRESHOLD, 1 / falloff);
    return Math.min(Math.max(range, MIN_AUTO_RANGE), MAX_AUTO_RANGE);
}
export function temperatureToLinearRgb(out: Vec3, kelvin: number): Vec3 {
    const t = Math.min(Math.max(kelvin, MIN_LIGHT_TEMPERATURE), 40000) / 100;
    let r: number;
    let g: number;
    let b: number;
    if (t <= 66) {
        r = 255;
        g = 99.4708025861 * Math.log(t) - 161.1195681661;
        b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
    }
    else {
        r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
        g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
        b = 255;
    }
    const clamp01 = (v: number) => Math.min(Math.max(v / 255, 0), 1);
    const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    out[0] = srgbToLinear(clamp01(r));
    out[1] = srgbToLinear(clamp01(g));
    out[2] = srgbToLinear(clamp01(b));
    const peak = Math.max(out[0], out[1], out[2], 1e-4);
    return vec3.scale(out, out, 1 / peak);
}
export function resolveLocalLightColor(out: Vec3, light: LocalLight): Vec3 {
    return light.temperature !== null ? temperatureToLinearRgb(out, light.temperature) : vec3.copy(out, light.color);
}
export function lightAnimationFactor(light: LocalLight, seconds: number, seed: number): number {
    if (light.animation === 'none' || light.animationAmount <= 0)
        return 1;
    const amount = Math.min(Math.max(light.animationAmount, 0), 1);
    const t = seconds * Math.max(light.animationSpeed, 0) + seed * 7.31;
    switch (light.animation) {
        case 'flicker': {
            const noise = Math.sin(t * 6.1) * 0.5 + Math.sin(t * 13.7 + 1.3) * 0.3 + Math.sin(t * 29.3 + 2.1) * 0.2;
            return 1 - amount * (0.5 + 0.5 * noise);
        }
        case 'pulse':
            return 1 - amount * (0.5 + 0.5 * Math.sin(t * Math.PI * 2));
        case 'strobe':
            return (t * 2) % 2 < 1 ? 1 : 1 - amount;
    }
}
function cloneLocalLight(light: LocalLight): LocalLight {
    const base: LocalLightBase = {
        color: vec3.copy(vec3.create(), light.color),
        temperature: light.temperature,
        intensity: light.intensity,
        range: light.range,
        falloff: light.falloff,
        sourceRadius: light.sourceRadius,
        specular: light.specular,
        shadow: { ...light.shadow },
        animation: light.animation,
        animationSpeed: light.animationSpeed,
        animationAmount: light.animationAmount,
    };
    switch (light.type) {
        case 'point':
            return { type: 'point', ...base };
        case 'spot':
            return { type: 'spot', ...base, innerAngle: light.innerAngle, outerAngle: light.outerAngle };
        case 'rect':
            return { type: 'rect', ...base, width: light.width, height: light.height, twoSided: light.twoSided };
        case 'disc':
            return { type: 'disc', ...base, radius: light.radius, twoSided: light.twoSided };
        case 'tube':
            return { type: 'tube', ...base, length: light.length };
    }
}
export function convertLocalLight(light: LocalLight, type: LocalLightType): LocalLight {
    if (light.type === type)
        return cloneLocalLight(light);
    const { type: _previous, ...base } = cloneLocalLight(light);
    return createLocalLight(type, base);
}
export function cloneLight(light: Light): Light {
    if (light.type === 'directional') {
        return createDirectionalLight({ color: vec3.copy(vec3.create(), light.color), intensity: light.intensity, castShadows: light.castShadows });
    }
    if (light.type === 'ambient') {
        return createAmbientLight({
            skyColor: vec3.copy(vec3.create(), light.skyColor),
            groundColor: vec3.copy(vec3.create(), light.groundColor),
            intensity: light.intensity,
        });
    }
    return cloneLocalLight(light);
}
