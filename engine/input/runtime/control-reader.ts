import { parseControlPath } from '../controls/control-path';
import type { InputDevice } from '../devices/input-device';
export interface ControlReader {
    readonly device: InputDevice;
    readonly x: string;
    readonly y: string | null;
}
export function resolveReaders(path: string, devices: readonly InputDevice[]): ControlReader[] {
    const parsed = parseControlPath(path);
    if (!parsed)
        return [];
    const readers: ControlReader[] = [];
    for (const device of devices) {
        if (device.layout !== parsed.layout || (parsed.usage !== null && !device.usages.includes(parsed.usage)))
            continue;
        const isVector = device.controls.some((control) => control.id === parsed.control && control.kind === 'vector2');
        readers.push(isVector ? { device, x: `${parsed.control}/x`, y: `${parsed.control}/y` } : { device, x: parsed.control, y: null });
    }
    return readers;
}
