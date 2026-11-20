import { rpcRulesFor } from '../rpc/relayed-rpcs';
import type { NetClient } from '../session/net-client';
import type { NetServer } from '../session/net-server';
import type { RpcAudience } from '../session/server-types';
import type { RpcDeclaration } from '../settings/rpc-declarations';
import type { NetValue } from '../wire/net-value';
export type RpcListener = (senderId: number, objectId: number, args: NetValue[]) => void;
const SERVER_SENDER_ID = 0;
export class RpcRouter {
    private readonly clientListeners = new Map<string, RpcListener>();
    private readonly serverListeners = new Map<string, RpcListener>();
    private readonly servers = new Set<NetServer>();
    private client: NetClient | null = null;
    constructor(private readonly declarations: readonly RpcDeclaration[], private readonly authority: () => NetServer | null) { }
    attachClient(client: NetClient): void {
        this.client = client;
        for (const name of this.clientListeners.keys())
            this.bindClient(client, name);
    }
    attachServer(server: NetServer): void {
        this.servers.add(server);
        for (const name of this.serverListeners.keys())
            this.bindServer(server, name);
    }
    detachServer(server: NetServer): void {
        this.servers.delete(server);
    }
    callServer(name: string, objectId: number, args: readonly NetValue[], reliable: boolean): boolean {
        return this.client?.callServer(name, objectId, args, reliable ? 'reliable' : 'unreliable') ?? false;
    }
    callClients(name: string, objectId: number, args: readonly NetValue[], audience: RpcAudience): boolean {
        const server = this.authority();
        if (!server)
            return false;
        server.callClients(name, objectId, [SERVER_SENDER_ID, ...args], audience);
        return true;
    }
    onClient(name: string, listener: RpcListener): () => void {
        this.clientListeners.set(name, listener);
        if (this.client)
            this.bindClient(this.client, name);
        return () => {
            if (this.clientListeners.get(name) === listener)
                this.clientListeners.delete(name);
        };
    }
    onServer(name: string, listener: RpcListener): () => void {
        this.serverListeners.set(name, listener);
        for (const server of this.servers)
            this.bindServer(server, name);
        return () => {
            if (this.serverListeners.get(name) === listener)
                this.serverListeners.delete(name);
        };
    }
    private bindClient(client: NetClient, name: string): void {
        client.rpc.register(name, ({ objectId }, args) => {
            const [sender, ...rest] = args;
            this.clientListeners.get(name)?.(typeof sender === 'number' ? sender : SERVER_SENDER_ID, objectId, rest);
        });
    }
    private bindServer(server: NetServer, name: string): void {
        server.rpc.register(name, ({ senderId, objectId }, args) => this.serverListeners.get(name)?.(senderId, objectId, args), rpcRulesFor(this.declarations, name));
    }
}
