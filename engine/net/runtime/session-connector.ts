import { DEFAULT_CONNECTION_OPTIONS } from '../connection/connection';
import { RELAY_ROUTE, SESSION_ROUTE } from '../server/multiplayer-server';
import { MAX_MESSAGES_PER_SECOND, MAX_VIOLATIONS, type SceneObjectSeed, type SessionRules } from '../server/server-config';
import type { SessionDelegate, SessionDelegateFactory } from '../server/session-delegate';
import { allocateRelay } from '../services/relay/relay-client';
import { RelayHostLink } from '../services/relay/relay-host-link';
import type { ServiceClient } from '../services/service-client';
import { ServiceError } from '../services/service-protocol';
import type { NetClientListener } from '../session/client-types';
import { NetClient } from '../session/net-client';
import { NetServer } from '../session/net-server';
import { DISCONNECT } from '../transport/disconnect-reason';
import { LoopbackHub } from '../transport/loopback-hub';
import type { PacketSocket } from '../transport/packet-socket';
import type { NetValue } from '../wire/net-value';
import type { SessionLink } from './session-link';
export interface PlayerIdentity {
    readonly name: string;
    readonly ticket: NetValue;
}
export interface ConnectorSetup {
    readonly link: SessionLink;
    readonly schema: string;
    readonly rules: SessionRules;
    readonly sendRate: number;
    readonly reconnectGraceMs: number;
    readonly sceneObjects: readonly SceneObjectSeed[];
    readonly createDelegate: SessionDelegateFactory;
}
export interface ConnectorEvents {
    clientOpened(client: NetClient): void;
    hostEnded(reason: string): void;
}
interface HostedSession {
    readonly server: NetServer;
    readonly delegate: SessionDelegate;
    readonly relay: RelayHostLink;
    readonly hub: LoopbackHub;
}
const HOST_ADDRESS = 'host';
const RELAY_HOST_ROLE = 'host';
const RELAY_GUEST_ROLE = 'client';
const RECONNECT_ATTEMPTS = 6;
const RECONNECT_BASE_DELAY_MS = 500;
export class SessionConnector {
    private current: NetClient | null = null;
    private hosted: HostedSession | null = null;
    private code = '';
    private generation = 0;
    constructor(private readonly setup: ConnectorSetup, private readonly listener: NetClientListener, private readonly events: ConnectorEvents) { }
    get client(): NetClient | null {
        return this.current;
    }
    get hostServer(): NetServer | null {
        return this.hosted?.server ?? null;
    }
    get joinCode(): string {
        return this.code;
    }
    joinSession(sessionId: string, identity: PlayerIdentity): void {
        this.leave();
        this.open(() => this.setup.link.openSocket(`${SESSION_ROUTE}/${sessionId}`), identity);
    }
    joinRelay(joinCode: string, identity: PlayerIdentity): void {
        this.leave();
        this.code = joinCode;
        this.open(() => this.setup.link.openSocket(`${RELAY_ROUTE}/${joinCode}/${RELAY_GUEST_ROLE}`), identity);
    }
    async host(service: ServiceClient, identity: PlayerIdentity, maxPlayers: number): Promise<string> {
        this.leave();
        const generation = this.generation;
        const joinCode = await allocateRelay(service, Math.max(1, maxPlayers - 1));
        if (generation !== this.generation)
            throw new ServiceError('conflict', 'a sessão foi trocada antes de o relay responder');
        const { link, schema, rules, sendRate, reconnectGraceMs, sceneObjects } = this.setup;
        const delegate = this.setup.createDelegate(joinCode);
        const server = new NetServer({
            sessionId: joinCode,
            schema,
            tickRate: rules.tickRate,
            sendRate,
            maxPlayers,
            reconnectGraceMs,
            maxMessagesPerSecond: MAX_MESSAGES_PER_SECOND,
            maxViolations: MAX_VIOLATIONS,
            clock: () => link.now(),
            connection: DEFAULT_CONNECTION_OPTIONS,
        }, delegate);
        for (const seed of sceneObjects)
            server.objects.spawn(seed);
        delegate.opened(server);
        const hub = new LoopbackHub();
        hub.listen(HOST_ADDRESS, (socket) => server.accept(socket));
        const relay: RelayHostLink = new RelayHostLink(link.openSocket(`${RELAY_ROUTE}/${joinCode}/${RELAY_HOST_ROLE}`), (socket) => server.accept(socket), (reason) => this.endHosting(relay, reason));
        this.hosted = { server, delegate, relay, hub };
        this.code = joinCode;
        this.open(() => hub.connect(HOST_ADDRESS), identity);
        return joinCode;
    }
    leave(): void {
        this.generation++;
        const { current, hosted } = this;
        this.current = null;
        this.hosted = null;
        this.code = '';
        current?.leave();
        if (!hosted)
            return;
        hosted.relay.close();
        hosted.server.close(DISCONNECT.hostLeft);
        hosted.delegate.closed();
    }
    update(elapsedMs: number): void {
        const { hosted } = this;
        if (hosted) {
            hosted.hub.advance(elapsedMs);
            hosted.server.update();
        }
        this.current?.update();
    }
    private endHosting(relay: RelayHostLink, reason: string): void {
        if (this.hosted?.relay !== relay)
            return;
        this.leave();
        this.events.hostEnded(reason);
    }
    private open(openSocket: () => PacketSocket, identity: PlayerIdentity): void {
        const { link, schema } = this.setup;
        const client = new NetClient({
            name: identity.name,
            ticket: identity.ticket,
            schema,
            clock: () => link.now(),
            openSocket,
            reconnectAttempts: RECONNECT_ATTEMPTS,
            reconnectBaseDelayMs: RECONNECT_BASE_DELAY_MS,
            connection: DEFAULT_CONNECTION_OPTIONS,
        }, this.listener);
        this.current = client;
        this.events.clientOpened(client);
        client.start();
    }
}
