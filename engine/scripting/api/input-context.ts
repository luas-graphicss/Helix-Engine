import type { InputSystem } from '@/engine/input/runtime/input-system';
import type { Unsubscribe } from '../runtime/runtime-context';
import type { RuntimeHost } from '../runtime/runtime-host';
import { requireFunction } from '../runtime/values';
import type { DeviceHandles } from './input-devices';
export interface InputApiContext {
    readonly host: RuntimeHost;
    readonly system: InputSystem;
    readonly deviceHandle: DeviceHandles;
}
export function subscribe<TPayload>(host: RuntimeHost, event: string, handler: unknown, member: string): Unsubscribe {
    const callback = requireFunction<(payload: TPayload) => void>(handler, member);
    return host.bus.on(event, (payload) => callback(payload as TPayload), host.current);
}
