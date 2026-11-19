import { clamp, lerp } from '@/engine/core/math/scalar';
import type { VehicleSettings } from '../vehicle-settings';
const IDLE_TORQUE_RATIO = 0.6;
const REDLINE_TORQUE_RATIO = 0.7;
const MIN_REV_SPAN = 1;
export const RPM_PER_RADIAN_PER_SECOND = 60 / (2 * Math.PI);
export function engineTorqueAt(settings: VehicleSettings, rpm: number): number {
    const { idleRpm, peakRpm, maxRpm, maxTorque } = settings;
    if (rpm >= maxRpm)
        return 0;
    if (rpm <= peakRpm) {
        const rise = clamp((rpm - idleRpm) / Math.max(peakRpm - idleRpm, MIN_REV_SPAN), 0, 1);
        return maxTorque * lerp(IDLE_TORQUE_RATIO, 1, rise);
    }
    const fall = (rpm - peakRpm) / Math.max(maxRpm - peakRpm, MIN_REV_SPAN);
    return maxTorque * lerp(1, REDLINE_TORQUE_RATIO, fall);
}
