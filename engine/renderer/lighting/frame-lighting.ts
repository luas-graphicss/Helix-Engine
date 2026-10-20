import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { Scene } from '@/engine/core/scene/scene';
export interface FrameLighting {
    hasSun: boolean;
    sunDirection: Vec3;
    sunRadiance: Vec3;
    sunCastShadows: boolean;
    skyIrradiance: Vec3;
    groundIrradiance: Vec3;
}
export function createFrameLighting(): FrameLighting {
    return {
        hasSun: false,
        sunDirection: vec3.create(0, 1, 0),
        sunRadiance: vec3.create(),
        sunCastShadows: false,
        skyIrradiance: vec3.create(),
        groundIrradiance: vec3.create(),
    };
}
export function collectFrameLighting(scene: Scene, out: FrameLighting): FrameLighting {
    out.hasSun = false;
    out.sunCastShadows = false;
    vec3.set(out.sunRadiance, 0, 0, 0);
    vec3.set(out.skyIrradiance, 0, 0, 0);
    vec3.set(out.groundIrradiance, 0, 0, 0);
    let hasAmbient = false;
    scene.traverseVisible((entity) => {
        const { light } = entity;
        if (!light)
            return;
        if (light.type === 'directional' && !out.hasSun) {
            out.hasSun = true;
            const m = entity.worldMatrix;
            vec3.normalize(out.sunDirection, vec3.set(out.sunDirection, m[8], m[9], m[10]));
            vec3.scale(out.sunRadiance, light.color, light.intensity);
            out.sunCastShadows = light.castShadows;
        }
        else if (light.type === 'ambient' && !hasAmbient) {
            hasAmbient = true;
            vec3.scale(out.skyIrradiance, light.skyColor, light.intensity);
            vec3.scale(out.groundIrradiance, light.groundColor, light.intensity);
        }
    });
    return out;
}
