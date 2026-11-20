import type { InputInteraction, InputProcessors } from './input-asset';
export const PRESS_POINT = 0.5;
export const RELEASE_POINT_RATIO = 0.75;
export const MIN_INTERACTION_DURATION = 0.05;
export const MAX_INTERACTION_DURATION = 5;
export const MAX_DEADZONE = 0.95;
export const MIN_SCALE = 0.01;
export const MAX_SCALE = 100;
function clampNumber(value: number, min: number, max: number, fallback: number): number {
    return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}
export function clampInteraction({ kind, duration }: InputInteraction): InputInteraction {
    return { kind, duration: clampNumber(duration, MIN_INTERACTION_DURATION, MAX_INTERACTION_DURATION, MIN_INTERACTION_DURATION) };
}
export function clampProcessors({ deadzone, scale, invertX, invertY }: InputProcessors): InputProcessors {
    return { deadzone: clampNumber(deadzone, 0, MAX_DEADZONE, 0), scale: clampNumber(scale, MIN_SCALE, MAX_SCALE, 1), invertX, invertY };
}
