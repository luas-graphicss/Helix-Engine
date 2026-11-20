import type { InputProcessors } from '../actions/input-asset';
import type { InputVector } from './input-vector';
export function applyProcessors(value: InputVector, { deadzone, scale, invertX, invertY }: InputProcessors): void {
    const magnitude = Math.hypot(value.x, value.y);
    if (deadzone > 0 && magnitude <= 1) {
        const live = magnitude <= deadzone ? 0 : (magnitude - deadzone) / (1 - deadzone) / magnitude;
        value.x *= live;
        value.y *= live;
    }
    value.x *= invertX ? -scale : scale;
    value.y *= invertY ? -scale : scale;
}
