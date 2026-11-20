import { GAMEPAD_CONTROLS, joystickControls } from '../../controls/device-layouts';
import type { DeviceRegistry } from '../device-registry';
import { InputDevice } from '../input-device';
import type { DeviceSource, SourceContext } from './device-source';
export interface GamepadButtonLike {
    readonly pressed: boolean;
    readonly value: number;
}
export interface GamepadLike {
    readonly index: number;
    readonly id: string;
    readonly mapping: string;
    readonly connected: boolean;
    readonly axes: readonly number[];
    readonly buttons: readonly GamepadButtonLike[];
}
export type GamepadReader = () => readonly (GamepadLike | null)[];
const STANDARD_MAPPING = 'standard';
const STANDARD_BUTTONS = ['buttonSouth', 'buttonEast', 'buttonWest', 'buttonNorth', 'leftShoulder', 'rightShoulder', 'leftTrigger', 'rightTrigger', 'select', 'start', 'leftStickPress', 'rightStickPress'] as const;
const DPAD_UP = 12;
const DPAD_DOWN = 13;
const DPAD_LEFT = 14;
const DPAD_RIGHT = 15;
const HOME_BUTTON = 16;
const STICK_NOISE_GATE = 0.08;
function readBrowserGamepads(): readonly (GamepadLike | null)[] {
    return typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
}
export function gamepadButtonValue(buttons: readonly GamepadButtonLike[], index: number): number {
    const button = buttons[index];
    if (!button)
        return 0;
    return button.pressed ? Math.max(button.value, 1) : button.value;
}
export function writeStick(device: InputDevice, control: string, axes: readonly number[], horizontal: number): void {
    const x = axes[horizontal] ?? 0;
    const y = -(axes[horizontal + 1] ?? 0);
    const resting = Math.hypot(x, y) < STICK_NOISE_GATE;
    device.writeVector(control, resting ? 0 : x, resting ? 0 : y);
}
function createDevice(pad: GamepadLike): InputDevice {
    const standard = pad.mapping === STANDARD_MAPPING;
    return new InputDevice({
        id: `gamepad:${pad.index}`,
        layout: standard ? 'Gamepad' : 'Joystick',
        name: pad.id || `Controle ${pad.index + 1}`,
        controls: standard ? GAMEPAD_CONTROLS : joystickControls(pad.axes.length, pad.buttons.length),
    });
}
function writeStandard(device: InputDevice, pad: GamepadLike): void {
    for (let index = 0; index < STANDARD_BUTTONS.length; index++)
        device.write(STANDARD_BUTTONS[index], gamepadButtonValue(pad.buttons, index));
    device.write('home', gamepadButtonValue(pad.buttons, HOME_BUTTON));
    device.writeVector('dpad', gamepadButtonValue(pad.buttons, DPAD_RIGHT) - gamepadButtonValue(pad.buttons, DPAD_LEFT), gamepadButtonValue(pad.buttons, DPAD_UP) - gamepadButtonValue(pad.buttons, DPAD_DOWN));
    writeStick(device, 'leftStick', pad.axes, 0);
    writeStick(device, 'rightStick', pad.axes, 2);
}
function writeJoystick(device: InputDevice, pad: GamepadLike): void {
    for (let index = 0; index < pad.axes.length; index++)
        device.write(`axis${index}`, pad.axes[index]);
    for (let index = 0; index < pad.buttons.length; index++)
        device.write(`button${index}`, gamepadButtonValue(pad.buttons, index));
    device.write('trigger', gamepadButtonValue(pad.buttons, 0));
    writeStick(device, 'stick', pad.axes, 0);
}
export class GamepadSource implements DeviceSource {
    private readonly devices = new Map<number, InputDevice>();
    private registry: DeviceRegistry | null = null;
    constructor(private readonly readGamepads: GamepadReader = readBrowserGamepads) { }
    attach({ registry }: SourceContext): void {
        this.registry = registry;
        for (const device of this.devices.values())
            registry.add(device);
    }
    poll(): void {
        const registry = this.registry;
        if (!registry)
            return;
        const connected = new Set<number>();
        for (const pad of this.readGamepads()) {
            if (!pad?.connected)
                continue;
            connected.add(pad.index);
            this.sync(registry, pad);
        }
        for (const [index, device] of this.devices) {
            if (connected.has(index))
                continue;
            this.devices.delete(index);
            registry.remove(device.id);
        }
    }
    private sync(registry: DeviceRegistry, pad: GamepadLike): void {
        let device = this.devices.get(pad.index);
        if (!device) {
            device = createDevice(pad);
            this.devices.set(pad.index, device);
            registry.add(device);
        }
        if (device.layout === 'Gamepad')
            writeStandard(device, pad);
        else
            writeJoystick(device, pad);
    }
}
