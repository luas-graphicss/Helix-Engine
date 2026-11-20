import type { ControlScheme } from '@/engine/input/actions/input-asset';
import { subscribe, type InputApiContext } from './input-context';
const SCHEME_CHANGED = 'input.scheme.changed';
function describeScheme({ id, name, devices }: ControlScheme) {
    return { id, name, devices: devices.map(({ layout, optional }) => ({ layout, optional })) };
}
export function createSchemesApi({ host, system, deviceHandle }: InputApiContext) {
    host.disposers.add(system.onSchemeChanged((scheme) => void host.bus.emit(SCHEME_CHANGED, describeScheme(scheme))));
    return {
        list: () => system.asset.schemes.map(describeScheme),
        get current() {
            const scheme = system.currentScheme;
            return scheme ? describeScheme(scheme) : null;
        },
        get lastDevice() {
            const device = system.lastUsedDevice;
            return device ? deviceHandle(device) : null;
        },
        onChanged: (handler: unknown) => subscribe(host, SCHEME_CHANGED, handler, 'helix.input.schemes.onChanged'),
    };
}
