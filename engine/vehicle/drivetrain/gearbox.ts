import { clamp } from '@/engine/core/math/scalar';
import type { VehicleSettings } from '../vehicle-settings';
export const REVERSE_GEAR = -1;
export const FIRST_GEAR = 1;
const SHIFT_UP_RPM_RATIO = 0.88;
const SHIFT_DOWN_MARGIN = 0.7;
const SHIFT_COOLDOWN_SECONDS = 0.35;
export function gearRatio(settings: VehicleSettings, gear: number): number {
    if (gear === REVERSE_GEAR)
        return -settings.reverseGearRatio;
    const lastStep = settings.gearCount - FIRST_GEAR;
    if (lastStep <= 0)
        return settings.firstGearRatio;
    const progress = clamp((gear - FIRST_GEAR) / lastStep, 0, 1);
    return settings.firstGearRatio * Math.pow(settings.topGearRatio / settings.firstGearRatio, progress);
}
export class Gearbox {
    gear = FIRST_GEAR;
    private cooldown = 0;
    engageReverse(): void {
        this.gear = REVERSE_GEAR;
    }
    engageForward(): void {
        if (this.gear === REVERSE_GEAR)
            this.gear = FIRST_GEAR;
    }
    shift(settings: VehicleSettings, shaftRpm: number, deltaSeconds: number): void {
        this.cooldown = Math.max(0, this.cooldown - deltaSeconds);
        if (this.gear === REVERSE_GEAR)
            return;
        this.gear = clamp(this.gear, FIRST_GEAR, settings.gearCount);
        if (this.cooldown > 0)
            return;
        const shiftUpRpm = settings.maxRpm * SHIFT_UP_RPM_RATIO;
        const currentRatio = gearRatio(settings, this.gear);
        if (shaftRpm * currentRatio > shiftUpRpm && this.gear < settings.gearCount) {
            this.engage(this.gear + 1);
            return;
        }
        if (this.gear === FIRST_GEAR)
            return;
        const lowerRpm = shaftRpm * gearRatio(settings, this.gear - 1);
        if (lowerRpm < shiftUpRpm * SHIFT_DOWN_MARGIN)
            this.engage(this.gear - 1);
    }
    private engage(gear: number): void {
        this.gear = gear;
        this.cooldown = SHIFT_COOLDOWN_SECONDS;
    }
}
