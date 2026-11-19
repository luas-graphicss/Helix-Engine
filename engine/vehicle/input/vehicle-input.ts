import { clamp } from '@/engine/core/math/scalar';
export interface VehicleInput {
    throttle: number;
    brake: number;
    steer: number;
    handbrake: number;
}
const INPUT_RANGE = {
    throttle: [-1, 1],
    brake: [0, 1],
    steer: [-1, 1],
    handbrake: [0, 1],
} as const satisfies Record<keyof VehicleInput, readonly [number, number]>;
export const VEHICLE_INPUT_AXES = Object.keys(INPUT_RANGE) as (keyof VehicleInput)[];
export function createVehicleInput(): VehicleInput {
    return { throttle: 0, brake: 0, steer: 0, handbrake: 0 };
}
export function setVehicleInputAxis(input: VehicleInput, axis: keyof VehicleInput, value: number): void {
    if (!Number.isFinite(value))
        return;
    const [min, max] = INPUT_RANGE[axis];
    input[axis] = clamp(value, min, max);
}
export function clearVehicleInput(input: VehicleInput): void {
    input.throttle = 0;
    input.brake = 0;
    input.steer = 0;
    input.handbrake = 0;
}
