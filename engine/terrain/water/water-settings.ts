import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import { cloneWaterFoamSettings, createWaterFoamSettings, type WaterFoamSettings } from './water-foam-settings';
export interface WaterSettings {
    enabled: boolean;
    level: number;
    readonly shallowColor: Vec3;
    readonly deepColor: Vec3;
    clarity: number;
    waveHeight: number;
    waveLength: number;
    waveSpeed: number;
    waveDirection: number;
    choppiness: number;
    ripples: number;
    readonly foam: WaterFoamSettings;
    reflectivity: number;
    roughness: number;
    refraction: number;
    caustics: number;
    subsurface: number;
}
export type WaterSettingsPatch = Partial<Omit<WaterSettings, 'foam'>> & {
    foam?: Partial<WaterFoamSettings>;
};
export function createWaterSettings(overrides: WaterSettingsPatch = {}): WaterSettings {
    const { foam, ...rest } = overrides;
    return {
        enabled: false,
        level: 0,
        shallowColor: vec3.create(0.12, 0.5, 0.52),
        deepColor: vec3.create(0.012, 0.085, 0.17),
        clarity: 5,
        waveHeight: 0.28,
        waveLength: 11,
        waveSpeed: 1,
        waveDirection: 35,
        choppiness: 0.5,
        ripples: 0.7,
        foam: createWaterFoamSettings(foam),
        reflectivity: 1,
        roughness: 0.06,
        refraction: 0.6,
        caustics: 0.7,
        subsurface: 0.6,
        ...rest,
    };
}
export function assignWaterSettings(target: WaterSettings, source: WaterSettingsPatch): void {
    const { shallowColor, deepColor, foam, ...scalars } = source;
    Object.assign(target, scalars);
    if (shallowColor)
        vec3.copy(target.shallowColor, shallowColor);
    if (deepColor)
        vec3.copy(target.deepColor, deepColor);
    if (foam)
        Object.assign(target.foam, foam);
}
export function cloneWaterSettings(settings: WaterSettings): WaterSettings {
    return {
        ...settings,
        shallowColor: vec3.copy(vec3.create(), settings.shallowColor),
        deepColor: vec3.copy(vec3.create(), settings.deepColor),
        foam: cloneWaterFoamSettings(settings.foam),
    };
}
