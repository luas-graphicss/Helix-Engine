import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import * as mat3 from '@/engine/core/math/mat3';
import type { Mat3 } from '@/engine/core/math/mat3';
import { celestialPoleAxis, hourAngleFromTime, moonDirectionFromSun, moonLitFraction, sunDirectionFromTime, } from '@/engine/core/environment/celestial';
import type { SkySettings } from '@/engine/core/environment/sky-settings';
import type { FrameLighting } from '@/engine/renderer/lighting/frame-lighting';
const SUN_ANGULAR_RADIUS = 0.00465;
const MOON_ANGULAR_RADIUS = 0.00452;
const MOON_TINT = vec3.create(0.72, 0.8, 1.0);
const scratchAxis = vec3.create();
export interface SkyFrame {
    enabled: boolean;
    skyLighting: boolean;
    cloudsEnabled: boolean;
    readonly sunDirection: Vec3;
    readonly sunIrradiance: Vec3;
    readonly moonDirection: Vec3;
    readonly moonIrradiance: Vec3;
    shadowOnMoon: boolean;
    readonly shadowCasterDirection: Vec3;
    readonly starRotation: Mat3;
    nightFactor: number;
    starsIntensity: number;
    mieScale: number;
    sunAngularRadius: number;
    moonAngularRadius: number;
}
export function createSkyFrame(): SkyFrame {
    return {
        enabled: false,
        skyLighting: false,
        cloudsEnabled: false,
        sunDirection: vec3.create(0, 1, 0),
        sunIrradiance: vec3.create(),
        moonDirection: vec3.create(0, -1, 0),
        moonIrradiance: vec3.create(),
        shadowOnMoon: false,
        shadowCasterDirection: vec3.create(0, 1, 0),
        starRotation: mat3.create(),
        nightFactor: 0,
        starsIntensity: 0,
        mieScale: 1,
        sunAngularRadius: SUN_ANGULAR_RADIUS,
        moonAngularRadius: MOON_ANGULAR_RADIUS,
    };
}
function smoothstep(edge0: number, edge1: number, x: number): number {
    const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
}
export function resolveSkyFrame(out: SkyFrame, settings: SkySettings, lighting: FrameLighting): SkyFrame {
    out.enabled = settings.enabled;
    out.skyLighting = settings.enabled && settings.skyLighting;
    out.cloudsEnabled = settings.enabled && settings.clouds.enabled;
    if (lighting.hasSun) {
        vec3.copy(out.sunDirection, lighting.sunDirection);
    }
    else {
        sunDirectionFromTime(out.sunDirection, settings.timeOfDay, settings.latitude, settings.sunAzimuth);
    }
    vec3.copy(out.sunIrradiance, lighting.sunRadiance);
    moonDirectionFromSun(out.moonDirection, out.sunDirection, settings.moonPhase, settings.latitude, settings.sunAzimuth);
    const litFraction = moonLitFraction(out.sunDirection, out.moonDirection);
    vec3.scale(out.moonIrradiance, MOON_TINT, settings.moonlight * Math.pow(litFraction, 1.5));
    out.shadowOnMoon =
        settings.enabled && out.sunDirection[1] < -0.02 && out.moonDirection[1] > 0.02 && settings.moonlight > 0;
    vec3.copy(out.shadowCasterDirection, out.shadowOnMoon ? out.moonDirection : out.sunDirection);
    celestialPoleAxis(scratchAxis, settings.latitude, settings.sunAzimuth);
    mat3.fromAxisAngle(out.starRotation, scratchAxis, hourAngleFromTime(settings.timeOfDay));
    out.nightFactor = 1 - smoothstep(-0.12, 0.1, out.sunDirection[1]);
    out.starsIntensity = settings.starsIntensity * out.nightFactor;
    out.mieScale = 0.3 + 4.7 * settings.haze * settings.haze;
    out.sunAngularRadius = SUN_ANGULAR_RADIUS * settings.sunDiskScale;
    out.moonAngularRadius = MOON_ANGULAR_RADIUS * settings.moonScale;
    return out;
}
