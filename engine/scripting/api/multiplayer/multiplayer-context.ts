import type { MultiplayerRuntime } from '@/engine/net/runtime/multiplayer-runtime';
import { isNetRecord, type NetRecord } from '@/engine/net/services/service-params';
import { ServiceError, describeServiceError } from '@/engine/net/services/service-protocol';
import { isNetValue, type NetValue } from '@/engine/net/wire/net-value';
import type { Unsubscribe } from '../../runtime/runtime-context';
import type { RuntimeHost } from '../../runtime/runtime-host';
import { HelixArgumentError, HelixError } from '../../runtime/script-errors';
import { describeType, requireFunction } from '../../runtime/values';
export interface MultiplayerApiContext {
    readonly host: RuntimeHost;
    readonly runtime: MultiplayerRuntime;
}
export function listen<TPayload>(host: RuntimeHost, event: string, handler: unknown, member: string, deliver: (payload: TPayload) => unknown[] | null): Unsubscribe {
    const callback = requireFunction<(...args: unknown[]) => unknown>(handler, member);
    return host.bus.on(event, (payload) => {
        const args = deliver(payload as TPayload);
        if (args)
            callback(...args);
    }, host.current);
}
export function requireNetValue(value: unknown, member: string, what: string): NetValue {
    if (!isNetValue(value))
        throw new HelixArgumentError(member, `${what} não atravessa a rede: use números, textos, booleanos, null, listas e objetos simples; recebido ${describeType(value)}.`);
    return value;
}
export function requireNetArgs(args: readonly unknown[], member: string): NetValue[] {
    return args.map((value, index) => requireNetValue(value, member, `o argumento ${index + 1}`));
}
export function optionalRecord(value: unknown, member: string, what: string): NetRecord | undefined {
    if (value === undefined)
        return undefined;
    const record = requireNetValue(value, member, what);
    if (!isNetRecord(record))
        throw new HelixArgumentError(member, `${what} precisa ser um objeto simples; recebido ${describeType(value)}.`);
    return record;
}
export function optionalText(value: unknown, member: string, what: string): string | undefined {
    if (value === undefined || typeof value === 'string')
        return value;
    throw new HelixArgumentError(member, `${what} precisa ser um texto; recebido ${describeType(value)}.`);
}
export function optionalCount(value: unknown, member: string, what: string): number | undefined {
    if (value === undefined || (typeof value === 'number' && Number.isFinite(value)))
        return value;
    throw new HelixArgumentError(member, `${what} precisa ser um número; recebido ${describeType(value)}.`);
}
export function optionalFlag(value: unknown, member: string, what: string): boolean | undefined {
    if (value === undefined || typeof value === 'boolean')
        return value;
    throw new HelixArgumentError(member, `${what} precisa ser verdadeiro ou falso; recebido ${describeType(value)}.`);
}
export function requireActive<TValue>(value: TValue | null, member: string): TValue {
    if (value === null)
        throw new HelixError(`${member}: o multiplayer não está ligado nesta cena; ligue-o no painel Multiplayer.`);
    return value;
}
export async function settled<TValue>(member: string, action: () => Promise<TValue>): Promise<TValue> {
    try {
        return await action();
    }
    catch (error) {
        if (error instanceof ServiceError)
            throw new HelixError(`${member}: ${describeServiceError(error)}.`);
        throw error;
    }
}
