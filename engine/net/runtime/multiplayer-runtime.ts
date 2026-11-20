import type { ConnectionStats } from '../connection/connection';
import type { ServerStatus } from '../server/multiplayer-server';
import { SceneSessionDelegate, type SessionObserver } from '../server/scene-session-delegate';
import { normalizeJoinCode } from '../services/join-code';
import { LobbyClient } from '../services/lobby/lobby-client';
import { MatchmakingClient } from '../services/matchmaking/matchmaking-client';
import { ServiceClient } from '../services/service-client';
import { ServiceError } from '../services/service-protocol';
import type { SessionTicket } from '../services/session-ticket';
import type { NetClientListener } from '../session/client-types';
import type { NetClient } from '../session/net-client';
import type { NetServer } from '../session/net-server';
import type { SessionPlayer } from '../session/session-protocol';
import { normalizeSessionName } from '../settings/multiplayer-settings';
import { describeDisconnect } from '../transport/disconnect-reason';
import type { NetworkConditions } from '../transport/network-conditions';
import { HostedSessionLink } from './hosted-session-link';
import { LocalSessionLink } from './local-session-link';
import { ObjectCommands } from './object-commands';
import { RpcRouter } from './rpc-router';
import type { RuntimeListener, SessionPhase } from './runtime-events';
import { SceneBinding, type BindingHost } from './scene-binding';
import { createLocalLink, gameplayOf, type SessionBlueprint } from './session-blueprint';
import { SessionConnector, type PlayerIdentity } from './session-connector';
import type { SessionLink } from './session-link';
export type RuntimeLogLevel = 'info' | 'warn' | 'error';
export interface MultiplayerEnvironment extends BindingHost {
    log(level: RuntimeLogLevel, message: string): void;
}
export interface StartPlan {
    readonly blueprint: SessionBlueprint;
    readonly serverUrl: string | null;
    readonly conditions: NetworkConditions;
    readonly identity: PlayerIdentity;
    readonly link?: SessionLink;
}
interface ActiveRuntime {
    readonly blueprint: SessionBlueprint;
    readonly link: SessionLink;
    readonly connector: SessionConnector;
    readonly binding: SceneBinding;
    readonly router: RpcRouter;
    readonly objects: ObjectCommands;
    readonly services: ServiceClient;
    readonly lobby: LobbyClient;
    readonly matchmaking: MatchmakingClient;
    identity: PlayerIdentity;
}
const INACTIVE_MESSAGE = 'o multiplayer não está ligado nesta cena';
function describeCause(cause: unknown): string {
    return cause instanceof Error ? cause.message : String(cause);
}
export class MultiplayerRuntime {
    private readonly serverObserver: SessionObserver;
    private readonly clientListener: NetClientListener;
    private active: ActiveRuntime | null = null;
    constructor(private readonly environment: MultiplayerEnvironment, private readonly listener: RuntimeListener) {
        this.serverObserver = {
            opened: (server) => this.active?.router.attachServer(server),
            closed: (server) => this.active?.router.detachServer(server),
            playerJoined: () => undefined,
            playerLeft: () => undefined,
            inputReceived: () => undefined,
            approvalFailed: (cause) => environment.log('error', `A aprovação de entrada na sessão falhou: ${describeCause(cause)}`),
        };
        this.clientListener = {
            connected: (resumed) => listener.phaseChanged('connected', resumed ? 'resumed' : ''),
            reconnecting: (attempt) => listener.phaseChanged('reconnecting', String(attempt)),
            disconnected: (reason) => this.handleDisconnected(reason),
            playerJoined: (player) => listener.playerJoined(player),
            playerLeft: (player, reason) => listener.playerLeft(player, reason),
            corrected: (object) => {
                const binding = this.active?.binding.snap(object);
                if (binding)
                    listener.objectCorrected(binding);
            },
        };
    }
    get isActive(): boolean {
        return this.active !== null;
    }
    get blueprint(): SessionBlueprint | null {
        return this.active?.blueprint ?? null;
    }
    get link(): SessionLink | null {
        return this.active?.link ?? null;
    }
    get phase(): SessionPhase {
        const phase = this.active?.connector.client?.phase;
        return phase === 'connecting' || phase === 'connected' || phase === 'reconnecting' ? phase : 'offline';
    }
    get client(): NetClient | null {
        return this.active?.connector.client ?? null;
    }
    get authority(): NetServer | null {
        const { active } = this;
        if (!active)
            return null;
        const { hostServer, client } = active.connector;
        if (hostServer)
            return hostServer;
        return active.link instanceof LocalSessionLink && client?.phase === 'connected' ? (active.link.backend.server.sessionOf(client.sessionId) ?? null) : null;
    }
    get isHost(): boolean {
        return this.authority !== null;
    }
    get localPlayerId(): number {
        return this.client?.localId ?? 0;
    }
    get players(): SessionPlayer[] {
        return this.client?.players ?? [];
    }
    get sessionId(): string {
        return this.client?.sessionId ?? '';
    }
    get joinCode(): string {
        return this.active?.connector.joinCode ?? '';
    }
    get stats(): ConnectionStats | null {
        return this.client?.stats ?? null;
    }
    get serverStatus(): ServerStatus | null {
        const link = this.active?.link;
        return link instanceof LocalSessionLink ? link.backend.server.status() : null;
    }
    get binding(): SceneBinding | null {
        return this.active?.binding ?? null;
    }
    get rpc(): RpcRouter | null {
        return this.active?.router ?? null;
    }
    get objects(): ObjectCommands | null {
        return this.active?.objects ?? null;
    }
    get lobby(): LobbyClient | null {
        return this.active?.lobby ?? null;
    }
    get matchmaking(): MatchmakingClient | null {
        return this.active?.matchmaking ?? null;
    }
    get playerName(): string {
        return this.active?.identity.name ?? '';
    }
    set playerName(name: string) {
        if (this.active)
            this.active.identity = { ...this.active.identity, name };
    }
    start(plan: StartPlan): void {
        this.stop();
        const { blueprint } = plan;
        const { settings, rules } = blueprint;
        const link = plan.link ?? (plan.serverUrl === null ? createLocalLink(blueprint, plan.conditions, this.serverObserver) : new HostedSessionLink(plan.serverUrl));
        const gameplay = gameplayOf(blueprint);
        const connector = new SessionConnector({
            link,
            schema: blueprint.plan.schema,
            rules,
            sendRate: Math.min(settings.sendRate, rules.tickRate),
            reconnectGraceMs: settings.reconnectGraceSeconds * 1000,
            sceneObjects: blueprint.plan.sceneObjects,
            createDelegate: () => new SceneSessionDelegate(gameplay, this.serverObserver),
        }, this.clientListener, {
            clientOpened: (client) => this.adopt(client),
            hostEnded: (reason) => this.environment.log('warn', `A sessão que este jogo hospedava foi encerrada: ${describeDisconnect(reason)}.`),
        });
        const binding = new SceneBinding(this.environment, this.listener);
        const services = new ServiceClient(() => link.openServices(), plan.identity.name);
        const lobby = new LobbyClient(services);
        const matchmaking = new MatchmakingClient(services);
        lobby.onStarted((ticket) => this.joinTicket(ticket));
        matchmaking.onMatched((match) => this.joinTicket(match.session));
        this.active = {
            blueprint,
            link,
            connector,
            binding,
            router: new RpcRouter(settings.rpcs, () => this.authority),
            objects: new ObjectCommands({ plan: blueprint.plan, binding, authority: () => this.authority, client: () => this.client }),
            services,
            lobby,
            matchmaking,
            identity: plan.identity,
        };
        binding.hideTemplates();
        if (!settings.autoJoin)
            return;
        if (settings.topology === 'dedicated')
            this.joinSession(settings.defaultSession);
        else
            void this.hostSession().catch((cause: unknown) => this.environment.log('warn', `Não foi possível abrir a sessão por relay: ${describeCause(cause)}.`));
    }
    stop(): void {
        const { active } = this;
        if (!active)
            return;
        active.connector.leave();
        active.services.close();
        active.binding.clear();
        active.link.close();
        this.active = null;
    }
    update(elapsedMs: number): void {
        const { active } = this;
        if (!active)
            return;
        active.link.advance(elapsedMs);
        active.connector.update(elapsedMs);
        const { client } = active.connector;
        if (client?.phase !== 'connected')
            return;
        const { authority } = this;
        active.binding.reconcile(client.objects, client.localId, authority !== null);
        active.binding.sync(client, authority);
    }
    setConditions(conditions: NetworkConditions): boolean {
        const link = this.active?.link;
        if (!(link instanceof LocalSessionLink))
            return false;
        link.backend.setConditions(conditions);
        return true;
    }
    joinSession(sessionId: string): boolean {
        const { active } = this;
        if (!active)
            return false;
        this.listener.phaseChanged('connecting', '');
        active.connector.joinSession(normalizeSessionName(sessionId), active.identity);
        return true;
    }
    joinByCode(code: string): boolean {
        const { active } = this;
        const joinCode = normalizeJoinCode(code);
        if (!active || !joinCode)
            return false;
        this.listener.phaseChanged('connecting', '');
        active.connector.joinRelay(joinCode, active.identity);
        return true;
    }
    joinTicket(ticket: SessionTicket): boolean {
        if (ticket.mode === 'dedicated')
            return this.joinSession(ticket.sessionId);
        const connector = this.active?.connector;
        if (connector?.hostServer && connector.joinCode === ticket.joinCode)
            return true;
        return this.joinByCode(ticket.joinCode);
    }
    async hostSession(maxPlayers?: number): Promise<string> {
        const active = this.requireActive();
        const { settings, rules } = active.blueprint;
        if (!settings.relay.enabled)
            throw new ServiceError('forbidden', 'o relay está desligado no painel Multiplayer');
        this.listener.phaseChanged('connecting', '');
        const limit = Math.max(1, Math.min(maxPlayers ?? rules.maxPlayers, rules.maxPlayers));
        const joinCode = await active.connector.host(active.services, active.identity, limit);
        this.environment.log('info', `Sessão aberta por relay · código ${joinCode}.`);
        return joinCode;
    }
    async startLobby(): Promise<SessionTicket> {
        const active = this.requireActive();
        if (active.blueprint.settings.topology !== 'relay')
            return active.lobby.start();
        const joinCode = await this.hostSession(active.lobby.current?.maxMembers);
        return active.lobby.start({ mode: 'relay', joinCode });
    }
    leave(): void {
        this.active?.connector.leave();
    }
    private requireActive(): ActiveRuntime {
        if (!this.active)
            throw new ServiceError('conflict', INACTIVE_MESSAGE);
        return this.active;
    }
    private adopt(client: NetClient): void {
        const { active } = this;
        if (!active)
            return;
        active.router.attachClient(client);
        client.objects.observer = {
            spawned: () => undefined,
            despawned: () => undefined,
            ownerChanged: (object, previousOwnerId) => {
                const binding = active.binding.ofObject(object.id);
                if (binding)
                    this.listener.ownerChanged(binding, previousOwnerId);
            },
        };
    }
    private handleDisconnected(reason: string): void {
        this.active?.binding.release();
        this.listener.phaseChanged('offline', reason);
    }
}
