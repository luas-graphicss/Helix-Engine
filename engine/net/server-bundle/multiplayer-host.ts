import { MultiplayerServer, type ServerStatus } from '../server/multiplayer-server';
import { SceneSessionDelegate, type SessionGameplay, type SessionObserver } from '../server/scene-session-delegate';
import { createServerConfig } from '../server/server-config';
import { SERVICES_ROUTE } from '../transport/multiplayer-address';
import { HostPacketSocket, HostTextChannel, type HostConnection, type HostSocket } from './host-sockets';
import { readMultiplayerManifest } from './multiplayer-manifest';
export { multiplayerPathOf } from '../transport/multiplayer-address';
export type HostLog = (message: string) => void;
export const HOST_UPDATE_INTERVAL_MS = 16;
function describeCause(cause: unknown): string {
    return cause instanceof Error ? cause.message : String(cause);
}
export class MultiplayerHost {
    private readonly server: MultiplayerServer;
    constructor(manifest: unknown, log: HostLog = () => undefined, now: () => number = Date.now) {
        const { settings, rules, plan } = readMultiplayerManifest(manifest);
        const startedAt = now();
        const gameplay: SessionGameplay = { playerTemplates: plan.playerTemplates, transferableKinds: plan.transferableKinds, rpcs: settings.rpcs };
        const observer: SessionObserver = {
            opened: (server) => log(`sessão ${server.sessionId} aberta`),
            closed: (server) => log(`sessão ${server.sessionId} encerrada`),
            playerJoined: (server, player) => log(`${player.name} entrou em ${server.sessionId} (${server.players.length} de ${server.maxPlayers})`),
            playerLeft: (server, player, reason) => log(`${player.name} saiu de ${server.sessionId}: ${reason}`),
            inputReceived: () => undefined,
            approvalFailed: (cause) => log(`aprovação de entrada falhou: ${describeCause(cause)}`),
        };
        this.server = new MultiplayerServer(createServerConfig(settings, rules, plan.schema, plan.sceneObjects), () => now() - startedAt, () => new SceneSessionDelegate(gameplay, observer));
    }
    connect(route: string, socket: HostSocket): HostConnection {
        if (route === SERVICES_ROUTE) {
            const channel = new HostTextChannel(socket);
            this.server.connectServices(channel);
            return channel;
        }
        const packets = new HostPacketSocket(socket);
        this.server.route(route, packets);
        return packets;
    }
    tick(): void {
        this.server.update();
    }
    status(): ServerStatus {
        return this.server.status();
    }
    close(): void {
        this.server.close();
    }
}
