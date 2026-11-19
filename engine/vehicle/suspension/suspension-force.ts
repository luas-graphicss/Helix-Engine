import type { WheelSettings } from '../wheel/wheel-settings';
export const BUMP_TRAVEL_RATIO = 0.5;
const BUMP_STOP_STIFFNESS = 4;
export interface SuspensionSample {
    readonly sprungMass: number;
    readonly compression: number;
    readonly compressionSpeed: number;
}
export function suspensionForce(sample: SuspensionSample, settings: WheelSettings, gravity: number, deltaSeconds: number): number {
    const { sprungMass, compression, compressionSpeed } = sample;
    const angularFrequency = 2 * Math.PI * settings.suspensionFrequency;
    const springRate = sprungMass * angularFrequency * angularFrequency;
    const damping = Math.min(2 * settings.suspensionDamping * sprungMass * angularFrequency, sprungMass / deltaSeconds);
    const bumpStop = Math.max(0, compression - settings.suspensionTravel * BUMP_TRAVEL_RATIO) * BUMP_STOP_STIFFNESS;
    return Math.max(0, sprungMass * gravity + springRate * (compression + bumpStop) + damping * compressionSpeed);
}
