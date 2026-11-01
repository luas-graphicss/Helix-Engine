import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { CloudSettings, SkySettings } from '@/engine/core/environment/sky-settings';
import { advanceSkyCycle, syncSunLightToSky, wrapTimeOfDay } from '@/engine/core/environment/sky-cycle';
import { formatTimeOfDay, hourAngleFromTime, moonDirectionFromSun, moonLitFraction, moonPhaseName, sunDirectionFromTime } from '@/engine/core/environment/celestial';
import { HelixArgumentError } from '../runtime/script-errors';
import type { RuntimeHost } from '../runtime/runtime-host';
import { assignSettings, optionalNumber, requireNumber, requireOneOf, toVec3 } from '../runtime/values';
export const SKY_PRESET_IDS = ['dawn', 'noon', 'dusk', 'night', 'overcast', 'storm'] as const;
export type SkyPresetId = (typeof SKY_PRESET_IDS)[number];
interface SkyPreset {
    readonly id: SkyPresetId;
    readonly label: string;
    readonly sky: Partial<Omit<SkySettings, 'clouds'>>;
    readonly clouds: Partial<CloudSettings>;
}
export const SKY_PRESETS: readonly SkyPreset[] = [
    { id: 'dawn', label: 'Amanhecer', sky: { enabled: true, timeOfDay: 6.3, haze: 0.55, starsIntensity: 0.15, moonlight: 0.2 }, clouds: { enabled: true, coverage: 0.45, density: 0.6, windSpeed: 4 } },
    { id: 'noon', label: 'Meio-dia', sky: { enabled: true, timeOfDay: 12.5, haze: 0.25, starsIntensity: 0, moonlight: 0 }, clouds: { enabled: true, coverage: 0.3, density: 0.5, windSpeed: 3 } },
    { id: 'dusk', label: 'Entardecer', sky: { enabled: true, timeOfDay: 18.4, haze: 0.7, starsIntensity: 0.25, moonlight: 0.4 }, clouds: { enabled: true, coverage: 0.5, density: 0.65, windSpeed: 2.5 } },
    { id: 'night', label: 'Noite', sky: { enabled: true, timeOfDay: 0.6, haze: 0.2, starsIntensity: 1, moonlight: 1, moonPhase: 0.5 }, clouds: { enabled: true, coverage: 0.2, density: 0.5, windSpeed: 2 } },
    { id: 'overcast', label: 'Nublado', sky: { enabled: true, timeOfDay: 13, haze: 0.9, starsIntensity: 0, moonlight: 0 }, clouds: { enabled: true, coverage: 0.95, density: 0.9, thickness: 1.2, windSpeed: 5, shadows: true } },
    { id: 'storm', label: 'Tempestade', sky: { enabled: true, timeOfDay: 15, haze: 1, starsIntensity: 0, moonlight: 0 }, clouds: { enabled: true, coverage: 1, density: 1, thickness: 1.5, windSpeed: 14, shadows: true } },
];
function applyKnown(target: Record<string, unknown>, patch: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(patch))
        if (key in target)
            target[key] = value;
}
export class SkyWatcher {
    private lastHour = -1;
    private lastSunUp: boolean | null = null;
    private readonly direction = vec3.create();
    constructor(private readonly host: RuntimeHost) { }
    reset(): void {
        this.lastHour = -1;
        this.lastSunUp = null;
    }
    tick(): void {
        const { sky } = this.host.session.scene;
        const hour = Math.floor(wrapTimeOfDay(sky.timeOfDay));
        if (hour !== this.lastHour) {
            const wasInitial = this.lastHour === -1;
            this.lastHour = hour;
            if (!wasInitial)
                this.host.bus.emit('sky.hourChanged', hour);
        }
        sunDirectionFromTime(this.direction, sky.timeOfDay, sky.latitude, sky.sunAzimuth);
        const sunUp = this.direction[1] > 0;
        if (this.lastSunUp !== null && sunUp !== this.lastSunUp)
            this.host.bus.emit(sunUp ? 'sky.sunrise' : 'sky.sunset', sky.timeOfDay);
        this.lastSunUp = sunUp;
    }
}
export function createSkyApi(host: RuntimeHost) {
    const { session } = host;
    const { scene } = session;
    const sky = scene.sky;
    const defaults = (timeOfDay: unknown, latitude: unknown, azimuth: unknown, member: string) => ({
        time: optionalNumber(timeOfDay, sky.timeOfDay, member, 'a hora do dia'),
        latitude: optionalNumber(latitude, sky.latitude, member, 'a latitude'),
        azimuth: optionalNumber(azimuth, sky.sunAzimuth, member, 'o azimute'),
    });
    return {
        get settings() {
            return sky;
        },
        get clouds() {
            return sky.clouds;
        },
        set: (patch: unknown) => {
            assignSettings(sky as unknown as Record<string, unknown>, patch, 'helix.sky.set');
            session.notify();
        },
        get enabled() {
            return sky.enabled;
        },
        set enabled(value: boolean) {
            sky.enabled = Boolean(value);
            session.notify();
        },
        get timeOfDay() {
            return sky.timeOfDay;
        },
        set timeOfDay(value: number) {
            sky.timeOfDay = wrapTimeOfDay(requireNumber(value, 'helix.sky.timeOfDay', 'a hora (0..24)'));
            if (session.skyDrivesSun)
                syncSunLightToSky(scene);
        },
        get cycleSpeed() {
            return sky.cycleSpeed;
        },
        set cycleSpeed(value: number) {
            sky.cycleSpeed = requireNumber(value, 'helix.sky.cycleSpeed', 'a velocidade do ciclo');
        },
        get driveSun() {
            return session.skyDrivesSun;
        },
        set driveSun(value: boolean) {
            session.skyDrivesSun = Boolean(value);
        },
        advance: (deltaSeconds: unknown) => {
            const advanced = advanceSkyCycle(sky, requireNumber(deltaSeconds, 'helix.sky.advance', 'os segundos'));
            if (advanced && session.skyDrivesSun)
                syncSunLightToSky(scene);
            return advanced;
        },
        syncSun: () => syncSunLightToSky(scene),
        wrapTimeOfDay: (hours: unknown) => wrapTimeOfDay(requireNumber(hours, 'helix.sky.wrapTimeOfDay', 'as horas')),
        formatTimeOfDay: (hours?: unknown) => formatTimeOfDay(hours === undefined ? sky.timeOfDay : requireNumber(hours, 'helix.sky.formatTimeOfDay', 'as horas')),
        sunDirection: (timeOfDay?: unknown, latitude?: unknown, azimuth?: unknown) => {
            const d = defaults(timeOfDay, latitude, azimuth, 'helix.sky.sunDirection');
            return sunDirectionFromTime(vec3.create(), d.time, d.latitude, d.azimuth);
        },
        moonDirection: (timeOfDay?: unknown, latitude?: unknown, azimuth?: unknown) => {
            const d = defaults(timeOfDay, latitude, azimuth, 'helix.sky.moonDirection');
            const sun = sunDirectionFromTime(vec3.create(), d.time, d.latitude, d.azimuth);
            return moonDirectionFromSun(vec3.create(), sun, sky.moonPhase, d.latitude, d.azimuth);
        },
        get isDay() {
            return sunDirectionFromTime(vec3.create(), sky.timeOfDay, sky.latitude, sky.sunAzimuth)[1] > 0;
        },
        moonPhaseName: (phase?: unknown) => moonPhaseName(phase === undefined ? sky.moonPhase : requireNumber(phase, 'helix.sky.moonPhaseName', 'a fase')),
        moonLitFraction: () => {
            const sun = sunDirectionFromTime(vec3.create(), sky.timeOfDay, sky.latitude, sky.sunAzimuth);
            const moon = moonDirectionFromSun(vec3.create(), sun, sky.moonPhase, sky.latitude, sky.sunAzimuth);
            return moonLitFraction(sun, moon);
        },
        hourAngle: (timeOfDay?: unknown) => hourAngleFromTime(timeOfDay === undefined ? sky.timeOfDay : requireNumber(timeOfDay, 'helix.sky.hourAngle', 'a hora')),
        presets: () => SKY_PRESETS.map((preset) => ({ id: preset.id, label: preset.label })),
        preset: (id: unknown) => {
            const presetId = requireOneOf(id, SKY_PRESET_IDS, 'helix.sky.preset', 'o preset');
            const preset = SKY_PRESETS.find((entry) => entry.id === presetId)!;
            applyKnown(sky as unknown as Record<string, unknown>, preset.sky as Record<string, unknown>);
            applyKnown(sky.clouds as unknown as Record<string, unknown>, preset.clouds as Record<string, unknown>);
            if (session.skyDrivesSun)
                syncSunLightToSky(scene);
            session.notify();
        },
        onHourChanged: (handler: unknown) => host.bus.on('sky.hourChanged', handler as (payload: unknown) => void, host.current),
        onSunrise: (handler: unknown) => host.bus.on('sky.sunrise', handler as (payload: unknown) => void, host.current),
        onSunset: (handler: unknown) => host.bus.on('sky.sunset', handler as (payload: unknown) => void, host.current),
    };
}
export function createWorldApi(host: RuntimeHost) {
    const { scene } = host.session;
    const wind = { direction: vec3.create(1, 0, 0), speed: 2 };
    function applyWind(): void {
        const angle = Math.atan2(wind.direction[0], wind.direction[2]);
        scene.traverse((entity) => {
            const terrain = entity.terrain;
            if (!terrain)
                return;
            const grass = terrain.grass as unknown as Record<string, unknown>;
            if ('windSpeed' in grass)
                grass.windSpeed = wind.speed;
            if ('windDirection' in grass) {
                if (grass.windDirection instanceof Float32Array)
                    vec3.set(grass.windDirection as Vec3, wind.direction[0], 0, wind.direction[2]);
                else if (typeof grass.windDirection === 'number')
                    grass.windDirection = (angle * 180) / Math.PI;
            }
            const water = terrain.water as unknown as Record<string, unknown>;
            if ('waveDirection' in water) {
                if (water.waveDirection instanceof Float32Array) {
                    const direction = water.waveDirection as Float32Array;
                    if (direction.length >= 2) {
                        direction[0] = wind.direction[0];
                        direction[1] = wind.direction[2];
                    }
                }
                else if (typeof water.waveDirection === 'number')
                    water.waveDirection = (angle * 180) / Math.PI;
            }
        });
    }
    return {
        wind: {
            get direction() {
                return wind.direction;
            },
            get speed() {
                return wind.speed;
            },
            set: (options: unknown) => {
                if (!options || typeof options !== 'object')
                    throw new HelixArgumentError('helix.world.wind.set', 'esperava { direction?, speed? }.');
                const patch = options as {
                    direction?: unknown;
                    speed?: unknown;
                };
                if (patch.direction !== undefined) {
                    toVec3(patch.direction, 'helix.world.wind.set', wind.direction);
                    wind.direction[1] = 0;
                    if (vec3.length(wind.direction) < 1e-6)
                        vec3.set(wind.direction, 1, 0, 0);
                    vec3.normalize(wind.direction, wind.direction);
                }
                if (patch.speed !== undefined)
                    wind.speed = Math.max(0, requireNumber(patch.speed, 'helix.world.wind.set', 'a velocidade'));
                applyWind();
            },
        },
        get gravity() {
            return scene.physics.gravity;
        },
        get sky() {
            return scene.sky;
        },
        get player() {
            return scene.player;
        },
    };
}
