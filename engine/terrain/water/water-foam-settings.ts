export interface WaterFoamSettings {
    enabled: boolean;
    shoreWidth: number;
    shoreAmount: number;
    crestAmount: number;
    crestBias: number;
    persistence: number;
    scale: number;
    sharpness: number;
    bubbles: number;
    brightness: number;
}
export function createWaterFoamSettings(overrides: Partial<WaterFoamSettings> = {}): WaterFoamSettings {
    return {
        enabled: true,
        shoreWidth: 2.2,
        shoreAmount: 0.75,
        crestAmount: 0.8,
        crestBias: 0.35,
        persistence: 1.4,
        scale: 1,
        sharpness: 0.6,
        bubbles: 0.5,
        brightness: 0.92,
        ...overrides,
    };
}
export function cloneWaterFoamSettings(settings: WaterFoamSettings): WaterFoamSettings {
    return { ...settings };
}
