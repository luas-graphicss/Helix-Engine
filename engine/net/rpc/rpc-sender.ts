import type { Delivery } from '../connection/delivery';
import type { NetValue } from '../wire/net-value';
import type { NameTable } from './name-table';
import { encodeNameDefinition, encodeRpc } from './rpc-codec';
export interface RpcCall {
    readonly name: string;
    readonly objectId: number;
    readonly args: readonly NetValue[];
    readonly delivery: Delivery;
}
export function sendRpc(names: NameTable, send: (payload: Uint8Array, delivery: Delivery) => void, call: RpcCall): void {
    const { id, isNew } = names.resolve(call.name);
    if (isNew)
        send(encodeNameDefinition({ id, name: call.name }), 'reliable');
    send(encodeRpc({ nameId: id, objectId: call.objectId, args: [...call.args] }), call.delivery);
}
