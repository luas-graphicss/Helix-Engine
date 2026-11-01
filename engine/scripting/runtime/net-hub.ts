import type { Entity } from '@/engine/core/scene/entity';
import { HELIX_NET_PROTOCOL, type JsonRecord, type JsonValue, type NetMessage, type NetPlayerInfo } from '@/engine/net/protocol';
import type { NetEndpoint, NetTransportKind } from '@/engine/net/transport/endpoint';
import { LocalLink } from '@/engine/net/transport/local-link';
import { isAuthoritativeLink, NO_LINK, serverRunsHere, type NetLink } from '@/engine/net/transport/net-link';
import { DEFAULT_ROOM, normalizeRoomName, roomAddress } from '@/engine/net/transport/server-address';
import { WebSocketEndpoint } from '@/engine/net/transport/websocket-endpoint';
import type { ScriptRunContext } from '../script-document';
import { normalizeServerUrl } from '../scripting-settings';
import type { ScriptOwner, Unsubscribe } from './runtime-context';
import { HelixArgumentError, HelixError, describeThrown } from './script-errors';
import { isJsonValue, requireEntity, requireFunction, requireString } from './values';
export interface NetHubServices {
    run<T>(owner: ScriptOwner | null, fn: () => T): T;
    currentOwner(): ScriptOwner | null;
    currentContext(): ScriptRunContext | null;
    log(level: 'info' | 'warn' | 'error', message: string): void;
    report(owner: ScriptOwner | null, phase: string, cause: unknown): void;
    emitBus(name: string, payload: unknown): void;
    onBus(name: string, handler: (payload: unknown) => void, owner: ScriptOwner | null): Unsubscribe;
    localPlayerName(): string;
    entityAlive(entity: Entity): boolean;
}
export interface NetHubOptions {
    readonly link: NetLink;
    readonly tickRate: number;
    readonly maxPlayers: number;
}
interface ConnectOptions {
    readonly url?: string;
    readonly room?: string;
    readonly ticket?: JsonValue | null;
}
export interface NetPlayer {
    readonly id: number;
    readonly name: string;
    readonly local: boolean;
    readonly isHost: boolean;
    readonly joinedAt: number;
}
interface RpcEntry {
    readonly owner: ScriptOwner | null;
    readonly fn: (...args: unknown[]) => unknown;
    readonly perSecond: number;
}
interface Listener {
    readonly owner: ScriptOwner | null;
    readonly fn: (...args: unknown[]) => unknown;
}
interface ServerPlayer {
    readonly info: NetPlayerInfo;
    readonly endpoint: NetEndpoint;
    readonly calls: Map<string, number[]>;
    readonly unsubscribe: Unsubscribe[];
}
interface PendingCall {
    readonly name: string;
    readonly resolve: (value: unknown) => void;
    readonly reject: (cause: Error) => void;
}
type Realm = ScriptRunContext;
const MEMBER = (realm: Realm, name: string) => `helix.net.${name}${realm === 'shared' ? '' : ` (${realm === 'server' ? 'servidor' : 'cliente'})`}`;
function toNetPlayer(info: NetPlayerInfo, localId: number | null, host: boolean): NetPlayer {
    return { id: info.id, name: info.name, local: info.id === localId, isHost: host, joinedAt: info.joinedAt };
}
function requireJsonArgs(member: string, args: unknown[]): JsonValue[] {
    for (let index = 0; index < args.length; index++)
        if (!isJsonValue(args[index]))
            throw new HelixArgumentError(member, `o argumento ${index + 1} não é serializável em JSON (atores, funções e classes não atravessam a rede; envie ids e dados simples).`);
    return args as JsonValue[];
}
function readField(entity: Entity, path: string): JsonValue | undefined {
    let value: unknown = entity;
    for (const part of path.split('.')) {
        if (value === null || typeof value !== 'object')
            return undefined;
        value = (value as Record<string, unknown>)[part];
    }
    if (ArrayBuffer.isView(value))
        return Array.from(value as unknown as ArrayLike<number>);
    if (typeof value === 'function' || value === undefined)
        return undefined;
    return isJsonValue(value) ? (value as JsonValue) : undefined;
}
function sameJson(a: JsonValue | undefined, b: JsonValue | undefined): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
}
export class NetHub {
    private link: NetLink = NO_LINK;
    private tickRate = 20;
    private maxPlayers = 16;
    private localLink: LocalLink | null = null;
    private accumulatedMs = 0;
    private serverStartedAt = 0;
    private nextPlayerId = 1;
    private nextCallId = 1;
    private started = false;
    private remoteAddress: string | null = null;
    private readonly players = new Map<number, ServerPlayer>();
    private gate: {
        owner: ScriptOwner | null;
        fn: (ticket: unknown, request: {
            name: string;
            protocol: number;
        }) => unknown;
    } | null = null;
    private readonly serverRpcs = new Map<string, RpcEntry>();
    private readonly serverListeners = new Map<string, Set<Listener>>();
    private readonly state = new Map<string, JsonValue>();
    private readonly dirtyKeys = new Set<string>();
    private readonly removedKeys = new Set<string>();
    private readonly replicated = new Map<Entity, Set<string>>();
    private readonly lastReplicated = new Map<Entity, JsonRecord>();
    private clientEndpoint: NetEndpoint | null = null;
    private connected = false;
    private localInfo: NetPlayerInfo | null = null;
    private readonly roster = new Map<number, NetPlayerInfo>();
    private readonly clientRpcs = new Map<string, RpcEntry>();
    private readonly clientListeners = new Map<string, Set<Listener>>();
    private readonly mirror = new Map<string, JsonValue>();
    private readonly stateWatchers = new Map<string, Set<Listener>>();
    private readonly replicationWatchers = new Set<Listener>();
    private readonly pending = new Map<number, PendingCall>();
    private latencyMs = 0;
    private lastPingAt = 0;
    private readonly facades = new Map<Realm, Record<string, unknown>>();
    constructor(private readonly services: NetHubServices) { }
    get isAuthoritative(): boolean {
        return isAuthoritativeLink(this.link);
    }
    get transport(): NetTransportKind {
        return this.link.kind;
    }
    get isConnecting(): boolean {
        return this.clientEndpoint instanceof WebSocketEndpoint && this.clientEndpoint.open && !this.connected;
    }
    get isConnected(): boolean {
        return this.connected;
    }
    get latency(): number {
        return this.latencyMs;
    }
    get room(): string {
        return this.link.kind === 'websocket' ? this.link.room : DEFAULT_ROOM;
    }
    get address(): string | null {
        return this.remoteAddress;
    }
    runsHere(context: ScriptRunContext): boolean {
        return context !== 'server' || serverRunsHere(this.link);
    }
    get playerCount(): number {
        return this.players.size;
    }
    get knownPlayerCount(): number {
        return this.roster.size;
    }
    get serverTime(): number {
        return this.serverStartedAt > 0 ? performance.now() - this.serverStartedAt : 0;
    }
    start(options: NetHubOptions): void {
        this.reset();
        this.link = options.link;
        this.tickRate = Math.max(1, options.tickRate);
        this.maxPlayers = Math.max(1, options.maxPlayers);
        this.serverStartedAt = performance.now();
        this.started = true;
        switch (options.link.kind) {
            case 'local':
                this.localLink = new LocalLink(options.link.conditions);
                this.acceptConnection(this.localLink.server);
                this.connectClient(this.localLink.client, null);
                return;
            case 'websocket':
                this.openRemote(options.link.url, options.link.room, options.link.ticket);
                return;
            case 'none': {
                const info: NetPlayerInfo = { id: this.nextPlayerId++, name: this.services.localPlayerName(), joinedAt: 0 };
                this.localInfo = info;
                this.roster.set(info.id, info);
                this.connected = true;
                return;
            }
        }
    }
    tick(unscaledDeltaMs: number): void {
        if (!this.started)
            return;
        this.localLink?.tick(unscaledDeltaMs);
        if (!this.isAuthoritative)
            return;
        this.accumulatedMs += unscaledDeltaMs;
        const period = 1000 / this.tickRate;
        if (this.accumulatedMs < period)
            return;
        this.accumulatedMs = this.accumulatedMs % period;
        this.flushState();
        this.flushReplication();
        if (this.clientEndpoint?.open && this.connected && this.serverTime - this.lastPingAt > 1000) {
            this.lastPingAt = this.serverTime;
            this.clientEndpoint.send({ t: 'ping', at: performance.now() });
        }
    }
    reset(): void {
        this.started = false;
        if (this.localLink) {
            this.localLink.flush();
            this.localLink.close('o jogo parou');
        }
        this.clientEndpoint?.close('o jogo parou');
        for (const call of this.pending.values())
            call.reject(new HelixError(`helix.net.call: "${call.name}" ficou sem resposta porque o jogo parou.`));
        this.pending.clear();
        this.players.clear();
        this.gate = null;
        this.serverRpcs.clear();
        this.serverListeners.clear();
        this.state.clear();
        this.dirtyKeys.clear();
        this.removedKeys.clear();
        this.replicated.clear();
        this.lastReplicated.clear();
        this.clientEndpoint = null;
        this.connected = false;
        this.localInfo = null;
        this.roster.clear();
        this.clientRpcs.clear();
        this.clientListeners.clear();
        this.mirror.clear();
        this.stateWatchers.clear();
        this.replicationWatchers.clear();
        this.facades.clear();
        this.localLink = null;
        this.remoteAddress = null;
        this.accumulatedMs = 0;
        this.latencyMs = 0;
        this.lastPingAt = 0;
        this.nextPlayerId = 1;
        this.nextCallId = 1;
        this.link = NO_LINK;
    }
    private openRemote(url: string, room: string, ticket: JsonValue | null): void {
        const previous = this.clientEndpoint;
        if (previous) {
            this.clientEndpoint = null;
            previous.close('reconectando');
        }
        this.connected = false;
        this.localInfo = null;
        this.roster.clear();
        this.mirror.clear();
        this.link = { kind: 'websocket', url, room: normalizeRoomName(room), ticket };
        const address = roomAddress(url, room);
        this.remoteAddress = address;
        this.services.log('info', `Conectando ao servidor em ${address}…`);
        this.services.emitBus('net.connecting', { address, room: this.room });
        this.connectClient(new WebSocketEndpoint(address), ticket);
    }
    facade(realm: Realm): Record<string, unknown> {
        let facade = this.facades.get(realm);
        if (!facade) {
            facade = this.createFacade(realm);
            this.facades.set(realm, facade);
        }
        return facade;
    }
}
