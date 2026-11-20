import type { NetworkObject } from '../objects/network-object';
import { registerRelayedRpcs } from '../rpc/relayed-rpcs';
import type { NetworkTemplate } from '../scene/scene-network-plan';
import type { NetServer } from '../session/net-server';
import type { SessionPlayer } from '../session/session-protocol';
import type { RpcDeclaration } from '../settings/rpc-declarations';
import type { NetValue } from '../wire/net-value';
import type { SessionDelegate } from './session-delegate';
export interface SessionGameplay {
    readonly playerTemplates: readonly NetworkTemplate[];
    readonly transferableKinds: readonly string[];
    readonly rpcs: readonly RpcDeclaration[];
}
export interface SessionObserver {
    opened(server: NetServer): void;
    closed(server: NetServer): void;
    playerJoined(server: NetServer, player: SessionPlayer): void;
    playerLeft(server: NetServer, player: SessionPlayer, reason: string): void;
    inputReceived(server: NetServer, player: SessionPlayer, object: NetworkObject, tick: number, input: NetValue): void;
    approvalFailed(cause: unknown): void;
}
export class SceneSessionDelegate implements SessionDelegate {
    private readonly transferable: ReadonlySet<string>;
    private server: NetServer | null = null;
    constructor(private readonly gameplay: SessionGameplay, private readonly observer: SessionObserver) {
        this.transferable = new Set(gameplay.transferableKinds);
    }
    opened(server: NetServer): void {
        this.server = server;
        registerRelayedRpcs(server, this.gameplay.rpcs);
        this.observer.opened(server);
    }
    closed(): void {
        const { server } = this;
        this.server = null;
        if (server)
            this.observer.closed(server);
    }
    playerJoined(player: SessionPlayer): void {
        const { server } = this;
        if (!server)
            return;
        for (const template of this.gameplay.playerTemplates)
            server.objects.spawn({ ...template, ownerId: player.id });
        this.observer.playerJoined(server, player);
    }
    playerLeft(player: SessionPlayer, reason: string): void {
        if (this.server)
            this.observer.playerLeft(this.server, player, reason);
    }
    playerSuspended(): void { }
    playerResumed(): void { }
    inputReceived(player: SessionPlayer, object: NetworkObject, tick: number, input: NetValue): void {
        if (this.server)
            this.observer.inputReceived(this.server, player, object, tick, input);
    }
    ownershipRequested(_player: SessionPlayer, object: NetworkObject): boolean {
        return this.transferable.has(object.kind);
    }
    approvalFailed(cause: unknown): void {
        this.observer.approvalFailed(cause);
    }
    ticked(): void { }
}
