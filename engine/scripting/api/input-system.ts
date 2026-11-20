import type { RuntimeHost } from '../runtime/runtime-host';
import { createActionSetApi } from './input-actions';
import type { InputApiContext } from './input-context';
import { createDeviceHandles, createDevicesApi } from './input-devices';
import { createPlayersApi } from './input-players';
import { createSchemesApi } from './input-schemes';
export function createInputSystemApi(host: RuntimeHost) {
    const live = host.inputSystem;
    const { system } = live;
    const deviceHandle = createDeviceHandles(system);
    const context: InputApiContext = { host, system, deviceHandle };
    return {
        ...createActionSetApi(context, system.actions, 'helix.input', () => system.currentScheme?.id ?? null),
        devices: createDevicesApi(host, live, deviceHandle),
        schemes: createSchemesApi(context),
        players: createPlayersApi(context),
    };
}
