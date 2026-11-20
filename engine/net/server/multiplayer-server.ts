import { NetServer } from '../session/net-server';
import { createSessionToken } from '../session/session-token';
import { DEFAULT_LOBBY_LIMITS } from '../services/lobby/lobby-types';
import { LobbyService } from '../services/lobby/lobby-service';
import { Matchmaker } from '../services/matchmaking/matchmaker';
import { RelayDirectory } from '../services/relay/relay-directory';
import { RelayHub } from '../services/relay/relay-hub';
import { ServiceBackend, type ServiceModule } from '../services/service-backend';
import type { TextChannel } from '../services/text-channel';
import { normalizeSessionName } from '../settings/multiplayer-settings';
import { DISCONNECT, disconnectReason } from '../transport/disconnect-reason';
import type { PacketSocket } from '../transport/packet-socket';
import { MAX_MESSAGES_PER_SECOND, MAX_VIOLATIONS, type MultiplayerServerConfig } from './server-config';
import type { SessionDelegate, SessionDelegateFactory } from './session-delegate';
interface GameSession {
    readonly id: string;
    readonly server: NetServer;
    readonly delegate: SessionDelegate;
    readonly maxPlayers: number;
    emptySince: number;
}
export interface SessionStatus {
    readonly id: string;
    readonly players: number;
    readonly maxPlayers: number;
    readonly objects: number;
    readonly tick: number;
}
export interface ServerStatus {
    readonly uptimeMs: number;
    readonly players: number;
    readonly sessions: SessionStatus[];
    readonly lobbies: number;
    readonly searching: number;
    readonly relayRooms: number;
    readonly relayConnections: number;
    readonly serviceMembers: number;
}
export const SESSION_ROUTE = 'session';
export const RELAY_ROUTE = 'relay';
const RELAY_HOST_ROLE = 'host';
const MATCHMAKING_INTERVAL_MS = 500;
const MAX_RELAY_ALLOCATIONS = 512;
const REJECTED_SESSION = disconnectReason(DISCONNECT.rejected, 'full');
const REJECTED_ROUTE = disconnectReason(DISCONNECT.rejected, 'relay');
export class MultiplayerServer {
    private readonly sessions = new Map<string, GameSession>();
    private readonly services: ServiceBackend;
    private readonly lobbies: LobbyService | null;
    private readonly matchmaker: Matchmaker | null;
    private readonly relayDirectory: RelayDirectory | null;
    private readonly relayHub: RelayHub | null;
    private readonly startedAt: number;
    private lastMatchmakingAt = Number.NEGATIVE_INFINITY;
    private closed = false;
    constructor(private readonly config: MultiplayerServerConfig, private readonly clock: () => number, private readonly createDelegate: SessionDelegateFactory) {
        const allocate = (maxPlayers: number): string => this.allocateSession(maxPlayers);
        this.lobbies = config.lobbyEnabled ? new LobbyService({ ...DEFAULT_LOBBY_LIMITS, maxMembers: config.maxLobbyMembers }, allocate) : null;
        const lobbies = this.lobbies;
        this.matchmaker = config.queues.length > 0 ? new Matchmaker(config.queues, clock, (member) => lobbies?.partyOf(member) ?? [member], allocate) : null;
        this.relayDirectory = config.relayEnabled ? new RelayDirectory(clock, MAX_RELAY_ALLOCATIONS) : null;
        this.relayHub = this.relayDirectory ? new RelayHub(this.relayDirectory) : null;
        const modules: (ServiceModule | null)[] = [this.lobbies, this.matchmaker, this.relayDirectory];
        this.services = new ServiceBackend(modules.filter((module) => module !== null), clock);
        this.startedAt = clock();
    }
    connectServices(channel: TextChannel): void {
        if (this.closed)
            channel.close();
        else
            this.services.connect(channel);
    }
    route(path: string, socket: PacketSocket): void {
        const [route, target = '', role = ''] = path.split('/');
        if (this.closed) {
            socket.close(DISCONNECT.shutdown);
            return;
        }
        if (route === SESSION_ROUTE)
            this.connectSession(target, socket);
        else if (route === RELAY_ROUTE && this.relayHub && role === RELAY_HOST_ROLE)
            this.relayHub.connectHost(target, socket);
        else if (route === RELAY_ROUTE && this.relayHub)
            this.relayHub.connectClient(target, socket);
        else
            socket.close(REJECTED_ROUTE);
    }
    update(): void {
        if (this.closed)
            return;
        const now = this.clock();
        for (const session of Array.from(this.sessions.values()))
            this.updateSession(session, now);
        if (now - this.lastMatchmakingAt < MATCHMAKING_INTERVAL_MS)
            return;
        this.lastMatchmakingAt = now;
        this.matchmaker?.update();
        this.relayDirectory?.expire();
    }
    status(): ServerStatus {
        const sessions = Array.from(this.sessions.values(), (session) => ({ id: session.id, players: session.server.players.length, maxPlayers: session.maxPlayers, objects: session.server.objects.size, tick: session.server.tick }));
        return {
            uptimeMs: this.clock() - this.startedAt,
            players: sessions.reduce((total, session) => total + session.players, 0),
            sessions,
            lobbies: this.lobbies?.count ?? 0,
            searching: this.matchmaker?.waitingCount ?? 0,
            relayRooms: this.relayHub?.roomCount ?? 0,
            relayConnections: this.relayHub?.connectionCount ?? 0,
            serviceMembers: this.services.memberCount,
        };
    }
    sessionOf(sessionId: string): NetServer | undefined {
        return this.sessions.get(sessionId)?.server;
    }
    close(): void {
        if (this.closed)
            return;
        this.closed = true;
        for (const session of Array.from(this.sessions.values()))
            this.closeSession(session);
        this.relayHub?.close();
        this.services.close();
    }
    private connectSession(requestedId: string, socket: PacketSocket): void {
        const id = normalizeSessionName(requestedId);
        const session = this.sessions.get(id) ?? (this.config.openSessions ? this.openSession(id, this.config.maxPlayers) : null);
        if (session)
            session.server.accept(socket);
        else
            socket.close(REJECTED_SESSION);
    }
    private allocateSession(maxPlayers: number): string {
        const id = createSessionToken();
        this.openSession(id, Math.min(maxPlayers, this.config.maxPlayers));
        return id;
    }
    private openSession(id: string, maxPlayers: number): GameSession | null {
        if (this.sessions.size >= this.config.maxSessions)
            return null;
        const delegate = this.createDelegate(id);
        const server = new NetServer({
            sessionId: id,
            schema: this.config.schema,
            tickRate: this.config.tickRate,
            sendRate: this.config.sendRate,
            maxPlayers,
            reconnectGraceMs: this.config.reconnectGraceMs,
            maxMessagesPerSecond: MAX_MESSAGES_PER_SECOND,
            maxViolations: MAX_VIOLATIONS,
            clock: this.clock,
            connection: this.config.connection,
        }, delegate);
        for (const seed of this.config.sceneObjects)
            server.objects.spawn(seed);
        const session: GameSession = { id, server, delegate, maxPlayers, emptySince: this.clock() };
        this.sessions.set(id, session);
        delegate.opened(server);
        return session;
    }
    private updateSession(session: GameSession, now: number): void {
        session.server.update();
        if (session.server.players.length > 0)
            session.emptySince = now;
        else if (now - session.emptySince > this.config.emptySessionMs)
            this.closeSession(session);
    }
    private closeSession(session: GameSession): void {
        this.sessions.delete(session.id);
        session.server.close(DISCONNECT.shutdown);
        session.delegate.closed();
    }
}
