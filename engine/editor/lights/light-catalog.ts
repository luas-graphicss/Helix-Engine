import * as vec3 from '@/engine/core/math/vec3';
import { linearRgbToCss } from '@/engine/core/color/srgb';
import type { Entity } from '@/engine/core/scene/entity';
import type { Scene } from '@/engine/core/scene/scene';
import { isLocalLight, resolveLocalLightColor, type Light } from '@/engine/core/scene/light';
import { lightCastsShadows } from '@/engine/editor/operations/light-operations';
export interface LightEntry {
    readonly entity: Entity;
    readonly light: Light;
    readonly active: boolean;
}
export interface LightCatalog {
    readonly global: LightEntry[];
    readonly local: LightEntry[];
    readonly total: number;
    readonly localTotal: number;
    readonly shadowed: number;
    readonly inactive: number;
}
export function collectLights(scene: Scene, query = ''): LightCatalog {
    const normalized = query.trim().toLowerCase();
    const global: LightEntry[] = [];
    const local: LightEntry[] = [];
    let total = 0;
    let localTotal = 0;
    let shadowed = 0;
    let inactive = 0;
    const walk = (entity: Entity, parentActive: boolean) => {
        const active = parentActive && entity.visible;
        const { light } = entity;
        if (light) {
            total++;
            if (isLocalLight(light))
                localTotal++;
            if (lightCastsShadows(light))
                shadowed++;
            if (!active)
                inactive++;
            if (normalized === '' || entity.name.toLowerCase().includes(normalized)) {
                ;
                (isLocalLight(light) ? local : global).push({ entity, light, active });
            }
        }
        for (const child of entity.children)
            walk(child, active);
    };
    walk(scene.root, true);
    return { global, local, total, localTotal, shadowed, inactive };
}
const swatch = vec3.create();
export function lightCssColor(light: Light): string {
    if (light.type === 'directional')
        vec3.copy(swatch, light.color);
    else if (light.type === 'ambient')
        vec3.copy(swatch, light.skyColor);
    else
        resolveLocalLightColor(swatch, light);
    const peak = Math.max(swatch[0], swatch[1], swatch[2], 1e-3);
    return linearRgbToCss(vec3.scale(swatch, swatch, 1 / peak));
}
