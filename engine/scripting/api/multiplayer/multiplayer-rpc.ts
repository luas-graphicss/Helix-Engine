import type { NetValue } from '@/engine/net/wire/net-value';
import type { Unsubscribe } from '../../runtime/runtime-context';
import { requireNumber, requireString } from '../../runtime/values';
import { listen, requireNetArgs, type MultiplayerApiContext } from './multiplayer-context';
interface RoutedCall {
    readonly senderId: number;
    readonly objectId: number;
    readonly args: NetValue[];
}
const GLOBAL_TARGET = 0;
const CLIENT_EVENT_PREFIX = 'multiplayer.rpc.client.';
const SERVER_EVENT_PREFIX = 'multiplayer.rpc.server.';
export interface RpcBridge {
    listenClient(name: unknown, handler: unknown, member: string, objectId: number): Unsubscribe;
    send(name: unknown, args: readonly unknown[], member: string, objectId: number, reliable: boolean): boolean;
}
export function createRpcBridge({ host, runtime }: MultiplayerApiContext) {
    const routedClient = new Set<string>();
    const routedServer = new Set<string>();
    const deliverTo = (objectId: number) => (call: RoutedCall): unknown[] | null => (call.objectId === objectId ? [call.senderId, ...call.args] : null);
    function listenClient(name: unknown, handler: unknown, member: string, objectId: number): Unsubscribe {
        const rpcName = requireString(name, member, 'o nome do RPC');
        const event = `${CLIENT_EVENT_PREFIX}${rpcName}`;
        if (!routedClient.has(rpcName)) {
            routedClient.add(rpcName);
            runtime.rpc?.onClient(rpcName, (senderId, target, args) => void host.bus.emit(event, { senderId, objectId: target, args }));
        }
        return listen<RoutedCall>(host, event, handler, member, deliverTo(objectId));
    }
    function listenServer(name: unknown, handler: unknown, member: string): Unsubscribe {
        const rpcName = requireString(name, member, 'o nome do RPC');
        const event = `${SERVER_EVENT_PREFIX}${rpcName}`;
        if (!routedServer.has(rpcName)) {
            routedServer.add(rpcName);
            runtime.rpc?.onServer(rpcName, (senderId, target, args) => void host.bus.emit(event, { senderId, objectId: target, args }));
        }
        return listen<RoutedCall>(host, event, handler, member, (call) => [call.senderId, call.objectId, ...call.args]);
    }
    function send(name: unknown, args: readonly unknown[], member: string, objectId: number, reliable: boolean): boolean {
        return runtime.rpc?.callServer(requireString(name, member, 'o nome do RPC'), objectId, requireNetArgs(args, member), reliable) ?? false;
    }
    const bridge: RpcBridge = { listenClient, send };
    const api = {
        send: (name: unknown, ...args: unknown[]) => send(name, args, 'helix.multiplayer.rpc.send', GLOBAL_TARGET, true),
        sendUnreliable: (name: unknown, ...args: unknown[]) => send(name, args, 'helix.multiplayer.rpc.sendUnreliable', GLOBAL_TARGET, false),
        on: (name: unknown, handler: unknown) => listenClient(name, handler, 'helix.multiplayer.rpc.on', GLOBAL_TARGET),
        onServer: (name: unknown, handler: unknown) => listenServer(name, handler, 'helix.multiplayer.rpc.onServer'),
        toClients: (name: unknown, ...args: unknown[]) => runtime.rpc?.callClients(requireString(name, 'helix.multiplayer.rpc.toClients', 'o nome do RPC'), GLOBAL_TARGET, requireNetArgs(args, 'helix.multiplayer.rpc.toClients'), {}) ?? false,
        toPlayer: (playerId: unknown, name: unknown, ...args: unknown[]) => runtime.rpc?.callClients(requireString(name, 'helix.multiplayer.rpc.toPlayer', 'o nome do RPC'), GLOBAL_TARGET, requireNetArgs(args, 'helix.multiplayer.rpc.toPlayer'), { only: [requireNumber(playerId, 'helix.multiplayer.rpc.toPlayer', 'o id do jogador')] }) ?? false,
    };
    return { bridge, api };
}
