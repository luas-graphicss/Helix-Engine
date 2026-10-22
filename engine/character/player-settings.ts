import { createCharacterSettings, type CharacterSettings } from './character-settings';
export interface PlayerCameraSettings {
    distance: number;
    minDistance: number;
    maxDistance: number;
    pitch: number;
    minPitch: number;
    maxPitch: number;
    sensitivity: number;
    invertY: boolean;
    pivotHeight: number;
}
export interface PlayerSettings {
    enabled: boolean;
    spawnIfMissing: boolean;
    character: CharacterSettings;
    camera: PlayerCameraSettings;
}
export function createPlayerCameraSettings(overrides: Partial<PlayerCameraSettings> = {}): PlayerCameraSettings {
    return {
        distance: 3.6,
        minDistance: 1.2,
        maxDistance: 8,
        pitch: -14,
        minPitch: -75,
        maxPitch: 60,
        sensitivity: 0.12,
        invertY: false,
        pivotHeight: 0.85,
        ...overrides,
    };
}
export function createPlayerSettings(overrides: Partial<PlayerSettings> = {}): PlayerSettings {
    return {
        enabled: true,
        spawnIfMissing: true,
        character: createCharacterSettings(),
        camera: createPlayerCameraSettings(),
        ...overrides,
    };
}
