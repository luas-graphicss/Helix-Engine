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
export type Light = DirectionalLight | AmbientLight;
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
export function cloneLight(light: Light): Light {
    if (light.type === 'directional') {
        return createDirectionalLight({ color: vec3.copy(vec3.create(), light.color), intensity: light.intensity, castShadows: light.castShadows });
    }
    return createAmbientLight({
        skyColor: vec3.copy(vec3.create(), light.skyColor),
        groundColor: vec3.copy(vec3.create(), light.groundColor),
        intensity: light.intensity,
    });
}
