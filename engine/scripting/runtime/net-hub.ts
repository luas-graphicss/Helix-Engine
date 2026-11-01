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
    private acceptConnection(endpoint: NetEndpoint): void {
        let player: ServerPlayer | null = null;
        let greeted = false;
        const offMessage = endpoint.onMessage((message) => {
            if (!player) {
                if (message.t !== 'hello' || greeted)
                    return;
                greeted = true;
                this.handleHello(endpoint, message, (admitted) => {
                    player = admitted;
                });
                return;
            }
            this.handleServerMessage(player, message);
        });
        const offClose = endpoint.onClose((reason) => {
            offMessage();
            offClose();
            if (player)
                this.removePlayer(player, reason);
        });
    }
    private handleHello(endpoint: NetEndpoint, hello: Extract<NetMessage, {
        t: 'hello';
    }>, admit: (player: ServerPlayer) => void): void {
        const reject = (reason: string) => {
            endpoint.send({ t: 'reject', reason });
            endpoint.close(reason);
        };
        if (hello.protocol !== HELIX_NET_PROTOCOL)
            return reject(`protocolo ${hello.protocol} não é o ${HELIX_NET_PROTOCOL} deste servidor`);
        if (this.players.size >= this.maxPlayers)
            return reject('sala cheia');
        const requested = hello.name.trim().slice(0, 32) || `Jogador ${this.nextPlayerId}`;
        const gate = this.gate;
        if (!gate)
            return admit(this.admitPlayer(endpoint, requested));
        const settle = (verdict: unknown) => {
            if (!endpoint.open)
                return;
            const reason = verdict === false ? 'entrada recusada' : typeof verdict === 'string' ? verdict : null;
            if (reason) {
                this.services.log('info', `Conexão de "${requested}" recusada: ${reason}.`);
                return reject(reason);
            }
            if (this.players.size >= this.maxPlayers)
                return reject('sala cheia');
            const renamed = typeof verdict === 'object' && verdict !== null && typeof (verdict as {
                name?: unknown;
            }).name === 'string' ? (verdict as {
                name: string;
            }).name.trim().slice(0, 32) : '';
            admit(this.admitPlayer(endpoint, renamed || requested));
        };
        let verdict: unknown;
        try {
            verdict = this.services.run(gate.owner, () => gate.fn(hello.ticket, { name: requested, protocol: hello.protocol }));
        }
        catch (cause) {
            this.services.report(gate.owner, 'helix.net.authenticate', cause);
            verdict = false;
        }
        if (verdict instanceof Promise) {
            verdict.then(settle, (cause: unknown) => {
                this.services.report(gate.owner, 'helix.net.authenticate', cause);
                settle(false);
            });
            return;
        }
        settle(verdict);
    }
    private admitPlayer(endpoint: NetEndpoint, name: string): ServerPlayer {
        const info: NetPlayerInfo = { id: this.nextPlayerId++, name, joinedAt: Math.round(this.serverTime) };
        const player: ServerPlayer = { info, endpoint, calls: new Map(), unsubscribe: [] };
        this.players.set(info.id, player);
        endpoint.send({ t: 'welcome', player: info, players: Array.from(this.players.values(), (entry) => entry.info), state: this.stateSnapshot(), tickRate: this.tickRate, serverTime: Math.round(this.serverTime) });
        for (const other of this.players.values())
            if (other !== player)
                other.endpoint.send({ t: 'playerJoined', player: info });
        const seen = toNetPlayer(info, null, false);
        this.services.emitBus('net.playerJoined', seen);
        this.services.log('info', `${info.name} entrou no servidor (${this.players.size} de ${this.maxPlayers}).`);
        return player;
    }
    private removePlayer(player: ServerPlayer, reason: string): void {
        if (!this.players.delete(player.info.id))
            return;
        for (const other of this.players.values())
            other.endpoint.send({ t: 'playerLeft', player: player.info, reason });
        this.services.emitBus('net.playerLeft', { ...toNetPlayer(player.info, null, false), reason });
        this.services.log('info', `${player.info.name} saiu do servidor (${reason}).`);
    }
    private handleServerMessage(player: ServerPlayer, message: NetMessage): void {
        switch (message.t) {
            case 'call':
                void this.serveCall(player, message);
                return;
            case 'event':
                this.dispatchListeners(this.serverListeners, message.name, [this.playerFor(player.info.id, 'server'), ...message.args], `net.on:${message.name}`);
                return;
            case 'result':
                this.settle(message);
                return;
            case 'ping':
                player.endpoint.send({ t: 'pong', at: message.at, serverTime: Math.round(this.serverTime) });
                return;
            default:
                return;
        }
    }
    private async serveCall(player: ServerPlayer, message: Extract<NetMessage, {
        t: 'call';
    }>): Promise<void> {
        const entry = this.serverRpcs.get(message.name);
        const reply = (result: Extract<NetMessage, {
            t: 'result';
        }>) => {
            if (player.endpoint.open)
                player.endpoint.send(result);
        };
        if (!entry) {
            reply({ t: 'result', id: message.id, ok: false, error: `nenhum rpc chamado "${message.name}" está registrado no servidor` });
            return;
        }
        if (!this.allowCall(player, message.name, entry.perSecond)) {
            reply({ t: 'result', id: message.id, ok: false, error: `"${message.name}" passou do limite de ${entry.perSecond} chamadas por segundo` });
            return;
        }
        try {
            const value = await this.services.run(entry.owner, () => entry.fn(this.playerFor(player.info.id, 'server'), ...message.args));
            if (value !== undefined && !isJsonValue(value))
                throw new HelixError(`o rpc "${message.name}" devolveu algo que não é JSON; devolva ids e dados simples.`);
            reply({ t: 'result', id: message.id, ok: true, value: (value ?? null) as JsonValue });
        }
        catch (cause) {
            this.services.report(entry.owner, `net.rpc:${message.name}`, cause);
            reply({ t: 'result', id: message.id, ok: false, error: describeThrown(cause) });
        }
    }
    private allowCall(player: ServerPlayer, name: string, perSecond: number): boolean {
        if (!Number.isFinite(perSecond) || perSecond <= 0)
            return true;
        const now = this.serverTime;
        const recent = (player.calls.get(name) ?? []).filter((at) => now - at < 1000);
        if (recent.length >= perSecond) {
            player.calls.set(name, recent);
            return false;
        }
        recent.push(now);
        player.calls.set(name, recent);
        return true;
    }
    private stateSnapshot(): JsonRecord {
        const snapshot: JsonRecord = {};
        for (const [key, value] of this.state)
            snapshot[key] = value;
        return snapshot;
    }
    private setState(key: string, value: JsonValue): void {
        if (sameJson(this.state.get(key), value))
            return;
        this.state.set(key, structuredClone(value));
        this.dirtyKeys.add(key);
        this.removedKeys.delete(key);
        if (!this.isAuthoritative)
            this.applyStateDelta({ [key]: value }, []);
    }
    private removeState(key: string): boolean {
        if (!this.state.delete(key))
            return false;
        this.dirtyKeys.delete(key);
        this.removedKeys.add(key);
        if (!this.isAuthoritative)
            this.applyStateDelta({}, [key]);
        return true;
    }
    private flushState(): void {
        if (this.dirtyKeys.size === 0 && this.removedKeys.size === 0)
            return;
        const set: JsonRecord = {};
        for (const key of this.dirtyKeys) {
            const value = this.state.get(key);
            if (value !== undefined)
                set[key] = value;
        }
        const removed = Array.from(this.removedKeys);
        this.dirtyKeys.clear();
        this.removedKeys.clear();
        for (const player of this.players.values())
            player.endpoint.send({ t: 'state', set, removed });
    }
    private flushReplication(): void {
        if (this.replicated.size === 0 || this.players.size === 0)
            return;
        const entities: Array<{
            id: number;
            name: string;
            fields: JsonRecord;
        }> = [];
        for (const [entity, fields] of this.replicated) {
            if (!this.services.entityAlive(entity)) {
                this.replicated.delete(entity);
                this.lastReplicated.delete(entity);
                continue;
            }
            const previous = this.lastReplicated.get(entity) ?? {};
            const changed: JsonRecord = {};
            let any = false;
            for (const field of fields) {
                const value = readField(entity, field);
                if (value === undefined || sameJson(previous[field], value))
                    continue;
                changed[field] = value;
                previous[field] = value;
                any = true;
            }
            this.lastReplicated.set(entity, previous);
            if (any)
                entities.push({ id: entity.id, name: entity.name, fields: changed });
        }
        if (entities.length === 0)
            return;
        for (const player of this.players.values())
            player.endpoint.send({ t: 'replicate', entities });
    }
    private connectClient(endpoint: NetEndpoint, ticket: JsonValue | null): void {
        this.clientEndpoint = endpoint;
        endpoint.onMessage((message) => {
            if (this.clientEndpoint === endpoint)
                this.handleClientMessage(message);
        });
        endpoint.onClose((reason) => {
            if (this.clientEndpoint !== endpoint || !this.started)
                return;
            const wasConnected = this.connected;
            this.connected = false;
            this.clientEndpoint = null;
            for (const call of this.pending.values())
                call.reject(new HelixError(`helix.net.call: "${call.name}" perdeu a conexão (${reason}).`));
            this.pending.clear();
            if (wasConnected)
                this.services.log('warn', `Conexão com o servidor perdida: ${reason}.`);
            else
                this.services.log('error', `Não foi possível entrar no servidor: ${reason}.`);
            this.services.emitBus('net.disconnected', { reason, wasConnected });
        });
        endpoint.send({ t: 'hello', protocol: HELIX_NET_PROTOCOL, name: this.services.localPlayerName(), ticket });
    }
}
