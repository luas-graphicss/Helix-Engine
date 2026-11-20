import { LEFT_HAND, RIGHT_HAND, XR_CONTROLLER_CONTROLS } from '../../controls/device-layouts';
import type { DeviceRegistry } from '../device-registry';
import { InputDevice } from '../input-device';
import type { DeviceSource, SourceContext } from './device-source';
import { gamepadButtonValue, writeStick, type GamepadButtonLike } from './gamepad-source';
export interface XRGamepadLike {
    readonly axes: readonly number[];
    readonly buttons: readonly GamepadButtonLike[];
}
export interface XRInputSourceLike {
    readonly handedness: string;
    readonly gamepad?: XRGamepadLike | null;
}
export interface XRSessionLike {
    readonly inputSources: Iterable<XRInputSourceLike>;
}
interface Hand {
    readonly usage: string;
    readonly name: string;
}
const HANDS = new Map<string, Hand>([
    ['left', { usage: LEFT_HAND, name: 'Controle VR esquerdo' }],
    ['right', { usage: RIGHT_HAND, name: 'Controle VR direito' }],
]);
const XR_STANDARD_BUTTONS = ['trigger', 'grip', 'touchpadPress', 'thumbstickPress', 'primaryButton', 'secondaryButton'] as const;
const TOUCHPAD_AXIS = 0;
const THUMBSTICK_AXIS = 2;
export class XRControllerSource implements DeviceSource {
    private readonly devices = new Map<string, InputDevice>();
    private registry: DeviceRegistry | null = null;
    private session: XRSessionLike | null = null;
    attach({ registry }: SourceContext): void {
        this.registry = registry;
        for (const device of this.devices.values())
            registry.add(device);
    }
    connect(session: XRSessionLike | null): void {
        this.session = session;
    }
    poll(): void {
        const registry = this.registry;
        if (!registry)
            return;
        const tracked = new Set<string>();
        for (const source of this.session?.inputSources ?? []) {
            const hand = HANDS.get(source.handedness);
            if (!hand || !source.gamepad)
                continue;
            tracked.add(source.handedness);
            this.write(this.deviceFor(registry, source.handedness, hand), source.gamepad);
        }
        for (const [handedness, device] of this.devices) {
            if (tracked.has(handedness))
                continue;
            this.devices.delete(handedness);
            registry.remove(device.id);
        }
    }
    private deviceFor(registry: DeviceRegistry, handedness: string, hand: Hand): InputDevice {
        const existing = this.devices.get(handedness);
        if (existing)
            return existing;
        const device = new InputDevice({ id: `xr:${handedness}`, layout: 'XRController', name: hand.name, controls: XR_CONTROLLER_CONTROLS, usages: [hand.usage] });
        this.devices.set(handedness, device);
        registry.add(device);
        return device;
    }
    private write(device: InputDevice, gamepad: XRGamepadLike): void {
        for (let index = 0; index < XR_STANDARD_BUTTONS.length; index++)
            device.write(XR_STANDARD_BUTTONS[index], gamepadButtonValue(gamepad.buttons, index));
        writeStick(device, 'touchpad', gamepad.axes, TOUCHPAD_AXIS);
        writeStick(device, 'thumbstick', gamepad.axes, THUMBSTICK_AXIS);
    }
}
