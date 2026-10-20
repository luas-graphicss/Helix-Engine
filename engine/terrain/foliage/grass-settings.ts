import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
export interface GrassSettings {
    enabled: boolean;
    density: number;
    height: number;
    heightVariation: number;
    width: number;
    viewDistance: number;
    maxSlope: number;
    windStrength: number;
    windSpeed: number;
    windDirection: number;
    readonly baseTint: Vec3;
    readonly tipTint: Vec3;
}
export function createGrassSettings(overrides: Partial<GrassSettings> = {}): GrassSettings {
    return {
        enabled: true,
        density: 16,
        height: 0.4,
        heightVariation: 0.45,
        width: 0.04,
        viewDistance: 70,
        maxSlope: 38,
        windStrength: 0.5,
        windSpeed: 1,
        windDirection: 35,
        baseTint: vec3.create(0.45, 0.5, 0.3),
        tipTint: vec3.create(1.15, 1.2, 0.85),
        ...overrides,
    };
}
export function cloneGrassSettings(settings: GrassSettings): GrassSettings {
    return { ...settings, baseTint: vec3.copy(vec3.create(), settings.baseTint), tipTint: vec3.copy(vec3.create(), settings.tipTint) };
}
export function grassPlacementKey(settings: GrassSettings): string {
    return `${settings.density}|${settings.heightVariation}|${settings.maxSlope}`;
}
