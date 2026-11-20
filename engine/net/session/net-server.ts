import { Connection, type ConnectionStats } from '../connection/connection';
import type { Delivery } from '../connection/delivery';
import { SERVER_OWNER_ID } from '../objects/network-object';
import { ObjectRegistry } from '../objects/object-registry';
import { decodeNameDefinition, decodeRpc } from '../rpc/rpc-codec';
import { sendRpc } from '../rpc/rpc-sender';
import { RpcTable } from '../rpc/rpc-table';
import { ServerReplication } from '../sync/server-replication';
import type { TransformHistory } from '../sync/transform-history';
import type { TransformState } from '../sync/transform-state';
import { FixedTicker } from '../time/fixed-ticker';
import { DISCONNECT, disconnectReason, isRecoverableDisconnect } from '../transport/disconnect-reason';
import type { PacketSocket } from '../transport/packet-socket';
import { ByteReader } from '../wire/byte-reader';
import type { NetValue } from '../wire/net-value';
import { WireError } from '../wire/wire-error';
import { decodeHello, encodePlayerJoined, encodePlayerLeft, encodePong, encodeWelcome, type HelloMessage } from './handshake-codec';
import { PlayerRoster } from './player-roster';
import { ServerGameplay } from './server-gameplay';
import { ServerPeer } from './server-peer';
import type { JoinApprover, JoinVerdict, NetServerListener, NetServerOptions, RpcAudience } from './server-types';
import { MAX_PLAYER_NAME_LENGTH, MESSAGE, REJECTION, SESSION_PROTOCOL_VERSION, type SessionPlayer } from './session-protocol';
import { createSessionToken } from './session-token';
const HELLO_TIMEOUT_MS = 5000;
const APPROVAL_TIMEOUT_MS = 8000;
const MALFORMED_WEIGHT = 8;
const FLOOD_WEIGHT = 1;
const ACCEPTED: JoinVerdict = { accepted: true };
const DENIED: JoinVerdict = { accepted: false, reason: REJECTION.denied };
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/g;
export function sanitizePlayerName(name: string): string {
    return name.replace(CONTROL_CHARACTERS, '').trim().slice(0, MAX_PLAYER_NAME_LENGTH);
}
export class NetServer {
    readonly objects = new ObjectRegistry();
    readonly rpc = new RpcTable();
    approver: JoinApprover | null = null;
    private readonly peers = new Set<ServerPeer>();
    private readonly roster = new PlayerRoster();
    private readonly ticker: FixedTicker;
    private readonly replication: ServerReplication;
    private readonly gameplay: ServerGameplay;
    private lastUpdateAt: number;
    private closed = false;
    constructor(private readonly options: NetServerOptions, private readonly listener: NetServerListener) {
        this.ticker = new FixedTicker(options.tickRate);
        this.replication = new ServerReplication(this.objects, () => this.roster.activePeers(), Math.max(1, Math.round(options.tickRate / options.sendRate)));
        this.gameplay = new ServerGameplay(this.objects, this.rpc, listener, (peer, weight, now) => this.violate(peer, weight, now));
        this.objects.observer = {
            spawned: (object) => this.replication.objectSpawned(object),
            despawned: (object) => this.replication.objectDespawned(object),
            ownerChanged: (object) => this.replication.ownerChanged(object),
        };
        this.lastUpdateAt = options.clock();
    }
    get sessionId(): string {
        return this.options.sessionId;
    }
    get tick(): number {
        return this.ticker.tick;
    }
    get tickRate(): number {
        return this.options.tickRate;
    }
    get maxPlayers(): number {
        return this.options.maxPlayers;
    }
    get timeMs(): number {
        return this.toServerTime(this.options.clock());
    }
    get players(): SessionPlayer[] {
        return this.roster.all;
    }
    get history(): TransformHistory {
        return this.replication.history;
    }
    get isClosed(): boolean {
        return this.closed;
    }
    isConnected(playerId: number): boolean {
        return this.roster.peerOf(playerId) !== undefined;
    }
    statsOf(playerId: number): ConnectionStats | null {
        return this.roster.peerOf(playerId)?.connection.stats ?? null;
    }
    accept(socket: PacketSocket): void {
        if (this.closed) {
            socket.close(DISCONNECT.shutdown);
            return;
        }
        const peer: ServerPeer = new ServerPeer(new Connection(socket, this.options.clock, {
            opened: () => undefined,
            message: (payload, delivery, receivedAt) => this.handleMessage(peer, payload, delivery, receivedAt),
            closed: (reason) => this.handleClosed(peer, reason),
        }, this.options.connection), this.options.clock(), this.options.maxMessagesPerSecond);
        this.peers.add(peer);
    }
    update(): void {
        if (this.closed)
            return;
        const now = this.options.clock();
        for (const peer of Array.from(this.peers))
            peer.connection.receive();
        this.expire(now);
        this.ticker.advance(now - this.lastUpdateAt, (tick) => {
            this.listener.ticked(tick, 1 / this.options.tickRate);
            this.replication.afterTick(tick, tick * this.ticker.intervalMs);
        });
        this.lastUpdateAt = now;
        for (const peer of this.peers)
            peer.connection.transmit();
    }
    callClients(name: string, objectId: number, args: readonly NetValue[], audience: RpcAudience = {}): void {
        for (const peer of this.roster.activePeers()) {
            if (audience.except === peer.playerId || (audience.only && !audience.only.includes(peer.playerId)))
                continue;
            if (objectId !== 0 && !peer.visible.has(objectId))
                continue;
            sendRpc(peer.outboundNames, (payload, delivery) => peer.send(payload, delivery), { name, objectId, args, delivery: audience.delivery ?? 'reliable' });
        }
    }
    teleport(objectId: number, transform: TransformState): boolean {
        const object = this.objects.get(objectId);
        if (!object)
            return false;
        this.replication.teleport(object, transform);
        return true;
    }
    acknowledgeInput(objectId: number, inputTick: number): void {
        this.replication.acknowledgeInput(objectId, inputTick);
    }
    kick(playerId: number, detail: string): boolean {
        const reason = disconnectReason(DISCONNECT.kicked, detail);
        const peer = this.roster.peerOf(playerId);
        if (peer) {
            this.dropPeer(peer, reason);
            return true;
        }
        const suspended = this.roster.takeSuspendedPlayer(playerId);
        if (suspended)
            this.removePlayer(suspended, reason);
        return suspended !== null;
    }
    close(reason: string = DISCONNECT.shutdown): void {
        if (this.closed)
            return;
        this.closed = true;
        for (const peer of this.peers) {
            peer.phase = 'closed';
            peer.connection.close(reason);
        }
        this.peers.clear();
        this.roster.clear();
    }
    private toServerTime(clockTime: number): number {
        return this.ticker.timeMs + (clockTime - this.lastUpdateAt);
    }
    private expire(now: number): void {
        for (const player of this.roster.takeExpired(now))
            this.removePlayer(player, DISCONNECT.timeout);
        for (const peer of Array.from(this.peers)) {
            const waited = now - peer.connectedAt;
            if ((peer.phase === 'greeting' && waited > HELLO_TIMEOUT_MS) || (peer.phase === 'approving' && waited > HELLO_TIMEOUT_MS + APPROVAL_TIMEOUT_MS))
                this.reject(peer, REJECTION.handshake);
        }
    }
    private handleMessage(peer: ServerPeer, payload: Uint8Array, delivery: Delivery, receivedAt: number): void {
        if (!peer.messageBucket.tryTake(receivedAt)) {
            this.violate(peer, FLOOD_WEIGHT, receivedAt);
            return;
        }
        try {
            this.dispatch(peer, new ByteReader(payload), delivery, receivedAt);
        }
        catch (error) {
            if (!(error instanceof WireError))
                throw error;
            this.violate(peer, MALFORMED_WEIGHT, receivedAt);
        }
    }
    private dispatch(peer: ServerPeer, reader: ByteReader, delivery: Delivery, receivedAt: number): void {
        const type = reader.u8();
        const { player } = peer;
        if (peer.phase !== 'active' || !player) {
            if (type !== MESSAGE.hello || peer.phase !== 'greeting' || delivery !== 'reliable')
                throw new WireError('only a hello is accepted before admission');
            this.greet(peer, decodeHello(reader));
            return;
        }
        switch (type) {
            case MESSAGE.ping:
                peer.send(encodePong({ clientSentAt: reader.f64(), serverReceivedAt: this.toServerTime(receivedAt), serverSentAt: this.timeMs }), 'unreliable');
                return;
            case MESSAGE.defineName: {
                const definition = decodeNameDefinition(reader);
                peer.inboundNames.define(definition.id, definition.name);
                return;
            }
            case MESSAGE.rpc:
                this.gameplay.handleRpc(peer, player, decodeRpc(reader), receivedAt);
                return;
            case MESSAGE.ownerState:
                this.replication.acceptOwnerState(peer, reader, receivedAt);
                return;
            case MESSAGE.variableSet:
                this.gameplay.handleVariable(player, reader);
                return;
            case MESSAGE.input:
                this.gameplay.handleInputs(peer, player, reader);
                return;
            case MESSAGE.ownershipRequest:
                this.gameplay.handleOwnershipRequest(peer, player, reader.varuint());
                return;
            default:
                throw new WireError(`unexpected message ${type}`);
        }
    }
    private greet(peer: ServerPeer, hello: HelloMessage): void {
        if (hello.protocol !== SESSION_PROTOCOL_VERSION) {
            this.reject(peer, REJECTION.protocol);
            return;
        }
        if (hello.schema !== this.options.schema) {
            this.reject(peer, REJECTION.schema);
            return;
        }
        const returning = this.reclaim(hello.resumeToken);
        if (returning) {
            this.admit(peer, returning, hello.resumeToken, true);
            return;
        }
        if (this.roster.size >= this.options.maxPlayers) {
            this.reject(peer, REJECTION.full);
            return;
        }
        this.requestApproval(peer, hello);
    }
    private requestApproval(peer: ServerPeer, hello: HelloMessage): void {
        let verdict: JoinVerdict | Promise<JoinVerdict>;
        try {
            verdict = this.approver ? this.approver({ name: sanitizePlayerName(hello.name), ticket: hello.ticket }) : ACCEPTED;
        }
        catch (error) {
            this.listener.approvalFailed(error);
            verdict = DENIED;
        }
        if (!(verdict instanceof Promise)) {
            this.settleApproval(peer, hello, verdict);
            return;
        }
        peer.phase = 'approving';
        void this.awaitApproval(peer, hello, verdict);
    }
    private async awaitApproval(peer: ServerPeer, hello: HelloMessage, pending: Promise<JoinVerdict>): Promise<void> {
        let verdict: JoinVerdict;
        try {
            verdict = await pending;
        }
        catch (error) {
            this.listener.approvalFailed(error);
            verdict = DENIED;
        }
        this.settleApproval(peer, hello, verdict);
    }
    private settleApproval(peer: ServerPeer, hello: HelloMessage, verdict: JoinVerdict): void {
        if (peer.phase === 'closed' || this.closed)
            return;
        if (!verdict.accepted) {
            this.reject(peer, verdict.reason || REJECTION.denied);
            return;
        }
        if (this.roster.size >= this.options.maxPlayers) {
            this.reject(peer, REJECTION.full);
            return;
        }
        const id = this.roster.allocateId();
        const name = sanitizePlayerName(verdict.name ?? hello.name) || `Jogador ${id}`;
        this.admit(peer, { id, name }, createSessionToken(), false);
    }
    private reclaim(token: string): SessionPlayer | null {
        if (!token)
            return null;
        const suspended = this.roster.takeSuspended(token);
        if (suspended)
            return suspended;
        const stale = this.roster.activePeerWithToken(token);
        const player = stale ? this.roster.deactivate(stale) : null;
        if (!stale || !player)
            return null;
        stale.phase = 'closed';
        this.peers.delete(stale);
        stale.connection.close(DISCONNECT.replaced);
        return player;
    }
    private admit(peer: ServerPeer, player: SessionPlayer, token: string, resumed: boolean): void {
        peer.phase = 'active';
        peer.player = player;
        peer.resumeToken = token;
        this.roster.activate(peer, player);
        peer.send(encodeWelcome({
            clientId: player.id,
            tickRate: this.options.tickRate,
            sendRate: this.options.sendRate,
            tick: this.ticker.tick,
            resumed,
            resumeToken: token,
            sessionId: this.options.sessionId,
            players: this.roster.all,
        }), 'reliable');
        this.replication.syncTarget(peer);
        if (resumed) {
            this.listener.playerResumed(player);
            return;
        }
        this.broadcast(encodePlayerJoined(player), player.id);
        this.listener.playerJoined(player);
    }
    private broadcast(payload: Uint8Array, exceptPlayerId = SERVER_OWNER_ID): void {
        for (const peer of this.roster.activePeers())
            if (peer.playerId !== exceptPlayerId)
                peer.send(payload, 'reliable');
    }
    private violate(peer: ServerPeer, weight: number, now: number): void {
        if (peer.addViolation(weight, now) > this.options.maxViolations)
            this.dropPeer(peer, DISCONNECT.flood);
    }
    private reject(peer: ServerPeer, detail: string): void {
        this.dropPeer(peer, disconnectReason(DISCONNECT.rejected, detail));
    }
    private dropPeer(peer: ServerPeer, reason: string): void {
        peer.connection.close(reason);
        this.handleClosed(peer, reason);
    }
    private handleClosed(peer: ServerPeer, reason: string): void {
        this.peers.delete(peer);
        const wasActive = peer.phase === 'active';
        peer.phase = 'closed';
        const player = wasActive ? this.roster.deactivate(peer) : null;
        if (!player)
            return;
        if (isRecoverableDisconnect(reason) && this.options.reconnectGraceMs > 0) {
            this.roster.suspend(peer.resumeToken, player, this.options.clock() + this.options.reconnectGraceMs);
            this.listener.playerSuspended(player);
            return;
        }
        this.removePlayer(player, reason);
    }
    private removePlayer(player: SessionPlayer, reason: string): void {
        if (!this.roster.remove(player.id))
            return;
        for (const object of this.objects.ownedBy(player.id)) {
            if (object.ownerLeftPolicy === 'despawn')
                this.objects.despawn(object.id);
            else
                this.objects.setOwner(object.id, SERVER_OWNER_ID);
        }
        this.broadcast(encodePlayerLeft(player.id, reason));
        this.listener.playerLeft(player, reason);
    }
}
