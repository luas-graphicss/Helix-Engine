import { clamp, lerp } from '@/engine/core/math/scalar';
import type { VehicleSettings } from '../vehicle-settings';
const STEER_FADE_SPEED = 40;
const STRAIGHT_ANGLE = 1e-4;
const MIN_TURN_REACH = 0.05;
export function steerTowards(currentDegrees: number, input: number, speed: number, settings: VehicleSettings, deltaSeconds: number): number {
    const fade = clamp(speed / STEER_FADE_SPEED, 0, 1);
    const reach = settings.maxSteerAngle * lerp(1, settings.highSpeedSteering, fade);
    const target = clamp(input, -1, 1) * reach;
    const stride = settings.steerSpeed * deltaSeconds;
    return currentDegrees + clamp(target - currentDegrees, -stride, stride);
}
export function ackermannAngle(centerAngle: number, leftOffset: number, wheelbase: number, ackermann: number): number {
    if (ackermann <= 0 || wheelbase <= 0 || Math.abs(centerAngle) < STRAIGHT_ANGLE)
        return centerAngle;
    const turnRadius = wheelbase / Math.tan(centerAngle);
    const reach = turnRadius + leftOffset;
    if (Math.abs(reach) < MIN_TURN_REACH || Math.sign(reach) !== Math.sign(turnRadius))
        return centerAngle;
    return lerp(centerAngle, Math.atan(wheelbase / reach), ackermann);
}
