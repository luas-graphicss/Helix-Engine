import { GAMEPAD_CONTROLS, KEYBOARD_CONTROLS, MOUSE_CONTROLS, RIGHT_HAND, XR_CONTROLLER_CONTROLS } from '@/engine/input/controls/device-layouts';
import { InputDevice } from '@/engine/input/devices/input-device';
import type { ActionState } from '@/engine/input/runtime/action-state';
import type { InputSystem } from '@/engine/input/runtime/input-system';
import type { InteractionSignal } from '@/engine/input/runtime/interactions';
export const FRAME = 1 / 60;
const SIGNALS: readonly InteractionSignal[] = ['started', 'performed', 'canceled'];
export function createKeyboard(): InputDevice {
    return new InputDevice({ id: 'keyboard', layout: 'Keyboard', name: 'Keyboard', controls: KEYBOARD_CONTROLS });
}
export function createMouse(): InputDevice {
    return new InputDevice({ id: 'mouse', layout: 'Mouse', name: 'Mouse', controls: MOUSE_CONTROLS });
}
export function createGamepad(index: number): InputDevice {
    return new InputDevice({ id: `gamepad:${index}`, layout: 'Gamepad', name: `Gamepad ${index}`, controls: GAMEPAD_CONTROLS });
}
export function createRightHand(): InputDevice {
    return new InputDevice({ id: 'xr:right', layout: 'XRController', name: 'Right hand', controls: XR_CONTROLLER_CONTROLS, usages: [RIGHT_HAND] });
}
export function advance(system: InputSystem, seconds: number): void {
    for (let elapsed = 0; elapsed < seconds; elapsed += FRAME)
        system.update(FRAME);
}
export function recordSignals(state: ActionState): string[] {
    const signals: string[] = [];
    for (const signal of SIGNALS)
        state.on(signal, () => signals.push(signal));
    return signals;
}
export function requireAction(state: ActionState | null, path: string): ActionState {
    if (!state)
        throw new Error(`The action "${path}" is missing from the asset under test.`);
    return state;
}
