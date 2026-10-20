export type CloudQuality = 'low' | 'medium' | 'high';
export interface CloudSettings {
    enabled: boolean;
    coverage: number;
    density: number;
    altitude: number;
    thickness: number;
    detail: number;
    windSpeed: number;
    windDirection: number;
    shadows: boolean;
    quality: CloudQuality;
}
export interface SkySettings {
    enabled: boolean;
    timeOfDay: number;
    cycleSpeed: number;
    latitude: number;
    sunAzimuth: number;
    haze: number;
    sunDiskScale: number;
    moonPhase: number;
    moonScale: number;
    moonlight: number;
    starsIntensity: number;
    skyLighting: boolean;
    clouds: CloudSettings;
}
export function createCloudSettings(options: Partial<CloudSettings> = {}): CloudSettings {
    return {
        enabled: true,
        coverage: 0.45,
        density: 0.6,
        altitude: 1500,
        thickness: 700,
        detail: 0.5,
        windSpeed: 0,
        windDirection: 35,
        shadows: true,
        quality: 'medium',
        ...options,
    };
}
type SkySettingsOptions = Partial<Omit<SkySettings, 'clouds'>> & {
    clouds?: Partial<CloudSettings>;
};
export function createSkySettings(options: SkySettingsOptions = {}): SkySettings {
    const { clouds, ...rest } = options;
    return {
        enabled: true,
        timeOfDay: 10.5,
        cycleSpeed: 0,
        latitude: 35,
        sunAzimuth: 0,
        haze: 0.4,
        sunDiskScale: 1.6,
        moonPhase: 0.5,
        moonScale: 2.2,
        moonlight: 0.25,
        starsIntensity: 1,
        skyLighting: true,
        ...rest,
        clouds: createCloudSettings(clouds),
    };
}
