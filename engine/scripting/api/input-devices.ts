import { isCustomDeviceId } from '@/engine/input/devices/custom-device';
import type { InputDevice } from '@/engine/input/devices/input-device';
import type { XRSessionLike } from '@/engine/input/devices/sources/xr-controller-source';
import type { InputSystem } from '@/engine/input/runtime/input-system';
import type { LiveInputSystem } from '@/engine/input/runtime/live-input-system';
import type { RuntimeHost } from '../runtime/runtime-host';
import { HelixArgumentError } from '../runtime/script-errors';
import { describeType, requireNumber, requireString } from '../runtime/values';
import { subscribe } from './input-context';
const DEVICES_CHANGED = 'input.devices.changed';
export type DeviceHandle = ReturnType<typeof buildDeviceHandle>;
export type DeviceHandles = (device: InputDevice) => DeviceHandle;
function buildDeviceHandle(system: InputSystem, device: InputDevice) {
    const custom = isCustomDeviceId(device.id);
    return {
        id: device.id,
        layout: device.layout,
        name: device.name,
        usages: [...device.usages],
        custom,
        get connected() {
            return system.devices.find(device.id) === device;
        },
        read: (control: unknown) => device.read(requireString(control, 'helix.input.devices.read', 'o controle')),
        controls: () => device.controls.map(({ id, label, kind }) => ({ id, label, kind })),
        set: (control: unknown, value: unknown) => {
            const member = 'helix.input.devices.set';
            if (!custom)
                throw new HelixArgumentError(member, `${device.name} é um dispositivo físico; só dispositivos customizados recebem valores do script.`);
            const id = requireString(control, member, 'o controle');
            if (!device.controls.some((candidate) => candidate.id === id))
                throw new HelixArgumentError(member, `"${id}" não é um controle de ${device.name}. Controles: ${device.controls.map((candidate) => candidate.id).join(', ')}.`);
            device.write(id, requireNumber(value, member, 'o valor'));
        },
    };
}
function isXRSession(value: unknown): value is XRSessionLike {
    return typeof value === 'object' && value !== null && 'inputSources' in value && typeof value.inputSources === 'object' && value.inputSources !== null;
}
export function createDeviceHandles(system: InputSystem): DeviceHandles {
    const handles = new WeakMap<InputDevice, DeviceHandle>();
    return (device) => {
        const cached = handles.get(device);
        if (cached)
            return cached;
        const handle = buildDeviceHandle(system, device);
        handles.set(device, handle);
        return handle;
    };
}
export function createDevicesApi(host: RuntimeHost, live: LiveInputSystem, deviceHandle: DeviceHandles) {
    const { system } = live;
    host.disposers.add(system.devices.onChange((change, device) => void host.bus.emit(DEVICES_CHANGED, { change, device: deviceHandle(device) })));
    return {
        list: () => system.devices.all.map(deviceHandle),
        find: (id: unknown) => {
            const device = system.devices.find(requireString(id, 'helix.input.devices.find', 'o id do dispositivo'));
            return device ? deviceHandle(device) : null;
        },
        custom: (name: unknown) => {
            const member = 'helix.input.devices.custom';
            const layout = requireString(name, member, 'o nome do dispositivo');
            const device = system.customDevice(layout);
            if (!device)
                throw new HelixArgumentError(member, `não existe dispositivo customizado "${layout}"; crie-o no painel Entrada, em Dispositivos.`);
            return deviceHandle(device);
        },
        connectXR: (session: unknown) => {
            if (session !== null && !isXRSession(session))
                throw new HelixArgumentError('helix.input.devices.connectXR', `esperava uma XRSession ou null; recebido ${describeType(session)}.`);
            live.connectXR(session);
        },
        onChange: (handler: unknown) => subscribe(host, DEVICES_CHANGED, handler, 'helix.input.devices.onChange'),
    };
}
