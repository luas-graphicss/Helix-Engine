export interface ReflectionSettings {
    probe: boolean;
    screenSpace: boolean;
    water: boolean;
    intensity: number;
}
export const DEFAULT_REFLECTION_SETTINGS: Readonly<ReflectionSettings> = Object.freeze({
    probe: true,
    screenSpace: true,
    water: true,
    intensity: 1,
});
