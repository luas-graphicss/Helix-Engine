import type { Delivery } from '../connection/delivery';
import type { NetServer } from '../session/net-server';
import { DEFAULT_RPC_RATE, type RpcDeclaration } from '../settings/rpc-declarations';
import type { RpcRules } from './rpc-table';
export function rpcRulesFor(declarations: readonly RpcDeclaration[], name: string): RpcRules {
    const declaration = declarations.find((candidate) => candidate.name === name);
    return { requireOwnership: declaration?.requireOwnership ?? false, perSecond: declaration?.perSecond ?? DEFAULT_RPC_RATE };
}
export function registerRelayedRpcs(server: NetServer, declarations: readonly RpcDeclaration[]): void {
    for (const declaration of declarations) {
        if (declaration.audience === 'server')
            continue;
        const delivery: Delivery = declaration.reliable ? 'reliable' : 'unreliable';
        const skipSender = declaration.audience === 'others';
        server.rpc.register(declaration.name, ({ senderId, objectId }, args) => server.callClients(declaration.name, objectId, [senderId, ...args], skipSender ? { delivery, except: senderId } : { delivery }), rpcRulesFor(declarations, declaration.name));
    }
}
