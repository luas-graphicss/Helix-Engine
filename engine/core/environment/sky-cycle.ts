import * as vec3 from '@/engine/core/math/vec3';
import type { Scene } from '@/engine/core/scene/scene';
import type { SkySettings } from './sky-settings';
import { sunDirectionFromTime, sunRotationFromDirection } from './celestial';
const scratchDirection = vec3.create();
export function wrapTimeOfDay(hours: number): number {
    return ((hours % 24) + 24) % 24;
}
export function advanceSkyCycle(sky: SkySettings, deltaSeconds: number): boolean {
    if (sky.cycleSpeed <= 0 || deltaSeconds <= 0)
        return false;
    sky.timeOfDay = wrapTimeOfDay(sky.timeOfDay + sky.cycleSpeed * deltaSeconds);
    return true;
}
export function syncSunLightToSky(scene: Scene): boolean {
    const sun = scene.findSunLight();
    if (!sun)
        return false;
    const { sky } = scene;
    sunDirectionFromTime(scratchDirection, sky.timeOfDay, sky.latitude, sky.sunAzimuth);
    sunRotationFromDirection(sun.transform.rotation, scratchDirection);
    return true;
}
