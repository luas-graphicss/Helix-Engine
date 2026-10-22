import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
export interface GrassSettings {
    enabled: boolean;
    density: number;
    height: number;
    heightVariation: number;
    width: number;
    clumping: number;
    bend: number;
    viewDistance: number;
    maxSlope: number;
    windStrength: number;
    windSpeed: number;
    windDirection: number;
    readonly baseColor: Vec3;
    readonly tipColor: Vec3;
    colorVariation: number;
    groundBlend: number;
    translucency: number;
    trample: number;
    recoverySeconds: number;
}
export const MAX_GRASS_DENSITY = 400;
export function createGrassSettings(overrides: Partial<GrassSettings> = {}): GrassSettings {
    return {
        enabled: true,
        density: 220,
        height: 0.5,
        heightVariation: 0.4,
        width: 0.03,
        clumping: 0.65,
        bend: 0.45,
        viewDistance: 80,
        maxSlope: 40,
        windStrength: 0.5,
        windSpeed: 1,
        windDirection: 35,
        baseColor: vec3.create(0.021, 0.045, 0.006),
        tipColor: vec3.create(0.26, 0.4, 0.04),
        colorVariation: 0.5,
        groundBlend: 0.6,
        translucency: 0.7,
        trample: 0.9,
        recoverySeconds: 5,
        ...overrides,
    };
}
export function assignGrassSettings(target: GrassSettings, source: Partial<GrassSettings>): void {
    const { baseColor, tipColor, ...scalars } = source;
    Object.assign(target, scalars);
    if (baseColor)
        vec3.copy(target.baseColor, baseColor);
    if (tipColor)
        vec3.copy(target.tipColor, tipColor);
}
export function cloneGrassSettings(settings: GrassSettings): GrassSettings {
    return {
        ...settings,
        baseColor: vec3.copy(vec3.create(), settings.baseColor),
        tipColor: vec3.copy(vec3.create(), settings.tipColor),
    };
}
export function grassPlacementKey(settings: GrassSettings): string {
    return `${settings.density}|${settings.heightVariation}|${settings.maxSlope}|${settings.clumping}`;
}
