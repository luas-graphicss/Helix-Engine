import { customLayoutControls, type CustomDeviceLayout } from '../controls/custom-layout';
import { InputDevice } from './input-device';
const CUSTOM_DEVICE_PREFIX = 'custom:';
export function customDeviceId(layoutName: string): string {
    return `${CUSTOM_DEVICE_PREFIX}${layoutName}`;
}
export function isCustomDeviceId(id: string): boolean {
    return id.startsWith(CUSTOM_DEVICE_PREFIX);
}
export function createCustomDevice(layout: CustomDeviceLayout): InputDevice {
    return new InputDevice({ id: customDeviceId(layout.name), layout: layout.name, name: layout.name, controls: customLayoutControls(layout) });
}
