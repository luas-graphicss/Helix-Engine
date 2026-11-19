import type { VehicleInput } from '../input/vehicle-input';
export interface DriveCommand {
    throttle: number;
    brake: number;
    handbrake: number;
    reverse: boolean;
}
const INTENT_DEADZONE = 0.02;
const DIRECTION_SWITCH_SPEED = 0.5;
export function createDriveCommand(): DriveCommand {
    return { throttle: 0, brake: 0, handbrake: 0, reverse: false };
}
export function resolveDriveCommand(out: DriveCommand, input: VehicleInput, forwardSpeed: number): DriveCommand {
    const intent = input.throttle;
    out.throttle = 0;
    out.brake = input.brake;
    out.handbrake = input.handbrake;
    if (Math.abs(intent) < INTENT_DEADZONE)
        return out;
    const wantsReverse = intent < 0;
    const movingAgainstIntent = wantsReverse ? forwardSpeed > DIRECTION_SWITCH_SPEED : forwardSpeed < -DIRECTION_SWITCH_SPEED;
    if (movingAgainstIntent) {
        out.brake = Math.max(out.brake, Math.abs(intent));
        return out;
    }
    out.reverse = wantsReverse;
    out.throttle = Math.abs(intent);
    return out;
}
