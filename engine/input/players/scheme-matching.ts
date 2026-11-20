import { bindingPaths } from '../actions/asset-queries';
import type { ControlScheme, InputActionMap } from '../actions/input-asset';
import { parseControlPath } from '../controls/control-path';
import type { InputDevice } from '../devices/input-device';
export type DeviceClaim = (device: InputDevice, schemeId: string) => boolean;
export function collectSchemeDevices(scheme: ControlScheme, pool: readonly InputDevice[], isTaken: DeviceClaim, preferred: InputDevice | null): InputDevice[] | null {
    const chosen: InputDevice[] = [];
    for (const requirement of scheme.devices) {
        const fits = (device: InputDevice) => device.layout === requirement.layout && !chosen.includes(device) && !isTaken(device, scheme.id);
        const device = preferred && fits(preferred) ? preferred : pool.find(fits);
        if (device)
            chosen.push(device);
        else if (!requirement.optional)
            return null;
    }
    return chosen;
}
function pathTargets(path: string, device: InputDevice, control: string): boolean {
    const parsed = parseControlPath(path);
    if (!parsed || parsed.layout !== device.layout || (parsed.usage !== null && !device.usages.includes(parsed.usage)))
        return false;
    return parsed.control === control || control.startsWith(`${parsed.control}/`);
}
export function schemeBindsControl(maps: readonly InputActionMap[], schemeId: string, device: InputDevice, control: string): boolean {
    for (const map of maps)
        for (const action of map.actions)
            for (const binding of action.bindings) {
                if (binding.schemes.length > 0 && !binding.schemes.includes(schemeId))
                    continue;
                if (bindingPaths(binding).some((path) => pathTargets(path, device, control)))
                    return true;
            }
    return false;
}
