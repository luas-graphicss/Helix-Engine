import { createChannelPair, type TextChannel } from '../services/text-channel';
import { LoopbackHub, type LoopbackSocket } from '../transport/loopback-hub';
import type { NetworkConditions } from '../transport/network-conditions';
import { MultiplayerServer, RELAY_ROUTE, SESSION_ROUTE } from './multiplayer-server';
import type { MultiplayerServerConfig } from './server-config';
import type { SessionDelegateFactory } from './session-delegate';
export class LocalBackend {
    readonly hub: LoopbackHub;
    readonly server: MultiplayerServer;
    private readonly sockets = new Set<LoopbackSocket>();
    private conditions: NetworkConditions;
    constructor(config: MultiplayerServerConfig, conditions: NetworkConditions, createDelegate: SessionDelegateFactory, random: () => number = Math.random) {
        this.hub = new LoopbackHub(random);
        this.conditions = conditions;
        this.server = new MultiplayerServer(config, () => this.hub.timeMs, createDelegate);
        this.hub.listen(SESSION_ROUTE, (socket, path) => this.server.route(`${SESSION_ROUTE}/${path}`, socket));
        this.hub.listen(RELAY_ROUTE, (socket, path) => this.server.route(`${RELAY_ROUTE}/${path}`, socket));
    }
    get timeMs(): number {
        return this.hub.timeMs;
    }
    openSocket(path: string): LoopbackSocket {
        const socket = this.hub.connect(path, this.conditions);
        this.sockets.add(socket);
        return socket;
    }
    openServices(): TextChannel {
        const [near, far] = createChannelPair();
        this.server.connectServices(far);
        return near;
    }
    setConditions(conditions: NetworkConditions): void {
        this.conditions = conditions;
        for (const socket of this.sockets) {
            if (socket.state === 'closed')
                this.sockets.delete(socket);
            else
                socket.setConditions(conditions);
        }
    }
    advance(elapsedMs: number): void {
        this.hub.advance(elapsedMs);
        this.server.update();
    }
    close(): void {
        this.server.close();
        this.sockets.clear();
    }
}
