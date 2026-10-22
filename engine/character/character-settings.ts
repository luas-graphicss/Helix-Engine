export const MANNEQUIN_MODEL_ID = 'mannequin';
export type CharacterClipState = 'idle' | 'walk' | 'run' | 'crouch';
export const CHARACTER_CLIP_STATES: readonly CharacterClipState[] = ['idle', 'walk', 'run', 'crouch'];
export type CharacterClipBindings = Partial<Record<CharacterClipState, string>>;
export interface CharacterSettings {
    autoPossess: boolean;
    model: string;
    clips: CharacterClipBindings;
    radius: number;
    height: number;
    crouchHeight: number;
    walkSpeed: number;
    runSpeed: number;
    crouchSpeed: number;
    acceleration: number;
    braking: number;
    airControl: number;
    jumpHeight: number;
    maxSlopeDegrees: number;
    stepHeight: number;
    rotationRate: number;
    mass: number;
}
export function createCharacterSettings(overrides: Partial<CharacterSettings> = {}): CharacterSettings {
    return {
        autoPossess: true,
        model: MANNEQUIN_MODEL_ID,
        clips: {},
        radius: 0.3,
        height: 1.8,
        crouchHeight: 1.25,
        walkSpeed: 2,
        runSpeed: 5.5,
        crouchSpeed: 1.1,
        acceleration: 22,
        braking: 18,
        airControl: 0.35,
        jumpHeight: 1.05,
        maxSlopeDegrees: 45,
        stepHeight: 0.42,
        rotationRate: 540,
        mass: 80,
        ...overrides,
    };
}
export function cloneCharacterSettings(settings: CharacterSettings): CharacterSettings {
    return { ...settings, clips: { ...settings.clips } };
}
export function copyCharacterSettings(out: CharacterSettings, source: CharacterSettings): CharacterSettings {
    return Object.assign(out, source, { clips: { ...source.clips } });
}
