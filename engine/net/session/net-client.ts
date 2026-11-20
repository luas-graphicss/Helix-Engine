import { Connection, type ConnectionStats } from '../connection/connection';
import type { Delivery } from '../connection/delivery';
import { decodeCorrection, decodeOwnerChange, decodeSpawn, decodeVariableUpdate, encodeInputBatch, encodeOwnershipRequest, encodeVariableSet, type InputEntry } from '../objects/object-codec';
import { ObjectRegistry } from '../objects/object-registry';
import { NameDirectory, NameTable } from '../rpc/name-table';
import { decodeNameDefinition, decodeRpc } from '../rpc/rpc-codec';
import { sendRpc } from '../rpc/rpc-sender';
import { RpcTable } from '../rpc/rpc-table';
import { ClientReplication } from '../sync/client-replication';
import { InterpolationDelay } from '../sync/interpolation-delay';
import type { TransformState } from '../sync/transform-state';
import { NetClock } from '../time/net-clock';
import { DISCONNECT, isRecoverableDisconnect } from '../transport/disconnect-reason';
import { ByteReader } from '../wire/byte-reader';
import type { NetValue } from '../wire/net-value';
import { WireError } from '../wire/wire-error';
import type { ClientPhase, NetClientListener, NetClientOptions } from './client-types';
import { decodePlayerJoined, decodePlayerLeft, decodePong, decodeWelcome, encodeHello, encodePing, type WelcomeMessage } from './handshake-codec';
import { MESSAGE, SESSION_PROTOCOL_VERSION, type SessionPlayer } from './session-protocol';
const PING_INTERVAL_MS = 500;
const MAX_RECONNECT_DELAY_MS = 8000;
const DEFAULT_SEND_INTERVAL_MS = 50;
const SERVER_SENDER_ID = 0;
export class NetClient {
    readonly objects = new ObjectRegistry();
    readonly rpc = new RpcTable();
    private readonly netClock = new NetClock();
    private readonly replication = new ClientReplication();
    private readonly roster = new Map<number, SessionPlayer>();
    private connection: Connection | null = null;
    private outboundNames = new NameTable();
    private inboundNames = new NameDirectory();
    private interpolation = new InterpolationDelay(DEFAULT_SEND_INTERVAL_MS);
    private welcome: WelcomeMessage | null = null;
    private currentPhase: ClientPhase = 'idle';
    private attempt = 0;
    private retryAt = 0;
    private lastPingAt = Number.NEGATIVE_INFINITY;
    constructor(private readonly options: NetClientOptions, private readonly listener: NetClientListener) { }
    get phase(): ClientPhase {
        return this.currentPhase;
    }
    get localId(): number {
        return this.welcome?.clientId ?? SERVER_SENDER_ID;
    }
    get sessionId(): string {
        return this.welcome?.sessionId ?? '';
    }
    get tickRate(): number {
        return this.welcome?.tickRate ?? 0;
    }
    get players(): SessionPlayer[] {
        return Array.from(this.roster.values());
    }
    get stats(): ConnectionStats | null {
        return this.connection?.stats ?? null;
    }
    get serverTimeMs(): number {
        return this.netClock.serverTime(this.options.clock());
    }
    get renderTimeMs(): number {
        return this.serverTimeMs - this.interpolation.delayMs;
    }
    get interpolationDelayMs(): number {
        return this.interpolation.delayMs;
    }
    start(): void {
        if (this.currentPhase !== 'idle' && this.currentPhase !== 'closed')
            return;
        this.attempt = 0;
        this.welcome = null;
        this.open('connecting');
    }
    leave(): void {
        if (this.currentPhase === 'idle' || this.currentPhase === 'closed')
            return;
        this.connection?.close(DISCONNECT.left);
        this.connection = null;
        this.finish(DISCONNECT.left);
    }
    update(): void {
        const now = this.options.clock();
        if (this.currentPhase === 'reconnecting' && !this.connection && now >= this.retryAt)
            this.open('reconnecting');
        const { connection } = this;
        if (!connection)
            return;
        connection.receive();
        if (this.connection !== connection)
            return;
        if (this.currentPhase === 'connected') {
            this.ping(connection, now);
            this.replication.upload(now, this.localId, this.objects, connection);
            this.interpolation.adapt(connection.stats.jitterMs);
        }
        connection.transmit();
    }
    callServer(name: string, objectId: number, args: readonly NetValue[], delivery: Delivery = 'reliable'): boolean {
        const connection = this.liveConnection();
        if (!connection)
            return false;
        sendRpc(this.outboundNames, (payload, mode) => connection.send(payload, mode), { name, objectId, args, delivery });
        return true;
    }
    setVariable(objectId: number, name: string, value: NetValue): boolean {
        const connection = this.liveConnection();
        const object = this.objects.get(objectId);
        const index = object?.variables.indexOf(name);
        if (!connection || !object || index === undefined || object.ownerId !== this.localId || object.variables.writerOf(index) !== 'owner')
            return false;
        object.variables.apply(index, value);
        connection.send(encodeVariableSet(objectId, { index, value }), 'reliable');
        return true;
    }
    sendInputs(objectId: number, entries: InputEntry[]): boolean {
        const connection = this.liveConnection();
        if (!connection)
            return false;
        connection.send(encodeInputBatch({ objectId, entries }), 'unreliable');
        return true;
    }
    requestOwnership(objectId: number): boolean {
        const connection = this.liveConnection();
        if (!connection)
            return false;
        connection.send(encodeOwnershipRequest(objectId), 'reliable');
        return true;
    }
    publishTransform(objectId: number, transform: TransformState): boolean {
        const object = this.objects.get(objectId);
        if (!object || !object.isSimulatedBy(this.localId))
            return false;
        this.replication.publish(object, transform, this.options.clock());
        return true;
    }
    sampleTransform(objectId: number, target: TransformState): boolean {
        return this.replication.sample(objectId, this.renderTimeMs, target);
    }
    inputTickOf(objectId: number): number | null {
        return this.replication.inputTickOf(objectId);
    }
    private liveConnection(): Connection | null {
        return this.currentPhase === 'connected' ? this.connection : null;
    }
    private open(phase: ClientPhase): void {
        this.currentPhase = phase;
        this.outboundNames = new NameTable();
        this.inboundNames = new NameDirectory();
        const { name, ticket, schema } = this.options;
        const connection: Connection = new Connection(this.options.openSocket(), this.options.clock, {
            opened: () => connection.send(encodeHello({ protocol: SESSION_PROTOCOL_VERSION, schema, name, ticket, resumeToken: this.welcome?.resumeToken ?? '' }), 'reliable'),
            message: (payload, _delivery, receivedAt) => this.handleMessage(connection, payload, receivedAt),
            closed: (reason) => {
                if (this.connection === connection)
                    this.handleClosed(reason);
            },
        }, this.options.connection);
        this.connection = connection;
    }
    private ping(connection: Connection, now: number): void {
        if (now - this.lastPingAt < PING_INTERVAL_MS)
            return;
        this.lastPingAt = now;
        connection.send(encodePing(now), 'unreliable');
    }
    private handleClosed(reason: string): void {
        this.connection = null;
        if (!this.welcome || !isRecoverableDisconnect(reason) || this.attempt >= this.options.reconnectAttempts) {
            this.finish(reason);
            return;
        }
        this.attempt++;
        this.currentPhase = 'reconnecting';
        this.retryAt = this.options.clock() + Math.min(MAX_RECONNECT_DELAY_MS, this.options.reconnectBaseDelayMs * 2 ** (this.attempt - 1));
        this.listener.reconnecting(this.attempt);
    }
    private finish(reason: string): void {
        this.currentPhase = 'closed';
        this.welcome = null;
        this.roster.clear();
        this.objects.clear();
        this.replication.reset();
        this.listener.disconnected(reason);
    }
    private handleMessage(connection: Connection, payload: Uint8Array, receivedAt: number): void {
        try {
            this.dispatch(new ByteReader(payload), receivedAt);
        }
        catch (error) {
            if (!(error instanceof WireError))
                throw error;
            connection.close(DISCONNECT.protocol);
            this.connection = null;
            this.finish(DISCONNECT.protocol);
        }
    }
    private dispatch(reader: ByteReader, receivedAt: number): void {
        const type = reader.u8();
        switch (type) {
            case MESSAGE.welcome:
                this.handleWelcome(decodeWelcome(reader));
                return;
            case MESSAGE.pong: {
                const pong = decodePong(reader);
                this.netClock.addSample(pong.clientSentAt, pong.serverReceivedAt, pong.serverSentAt, receivedAt);
                return;
            }
            case MESSAGE.playerJoined: {
                const player = decodePlayerJoined(reader);
                this.roster.set(player.id, player);
                this.listener.playerJoined(player);
                return;
            }
            case MESSAGE.playerLeft: {
                const { playerId, reason } = decodePlayerLeft(reader);
                const player = this.roster.get(playerId);
                if (player && this.roster.delete(playerId))
                    this.listener.playerLeft(player, reason);
                return;
            }
            case MESSAGE.defineName: {
                const definition = decodeNameDefinition(reader);
                this.inboundNames.define(definition.id, definition.name);
                return;
            }
            case MESSAGE.rpc: {
                const message = decodeRpc(reader);
                const name = this.inboundNames.nameOf(message.nameId);
                if (name !== undefined)
                    this.rpc.get(name)?.handler({ senderId: SERVER_SENDER_ID, objectId: message.objectId }, message.args);
                return;
            }
            case MESSAGE.spawn: {
                const init = decodeSpawn(reader);
                this.removeObject(init.id);
                this.objects.insert(init);
                return;
            }
            case MESSAGE.despawn:
                this.removeObject(reader.varuint());
                return;
            case MESSAGE.ownerChanged: {
                const change = decodeOwnerChange(reader);
                this.objects.setOwner(change.objectId, change.ownerId);
                return;
            }
            case MESSAGE.variables: {
                const update = decodeVariableUpdate(reader);
                const object = this.objects.get(update.objectId);
                for (const change of update.changes)
                    object?.variables.apply(change.index, change.value);
                return;
            }
            case MESSAGE.state:
                this.replication.applyState(reader, this.objects);
                return;
            case MESSAGE.correction: {
                const correction = decodeCorrection(reader);
                const object = this.objects.get(correction.objectId);
                if (!object)
                    return;
                this.replication.snapTo(object, correction.transform, this.options.clock());
                this.listener.corrected(object);
                return;
            }
            default:
                throw new WireError(`unexpected message ${type}`);
        }
    }
    private removeObject(objectId: number): void {
        this.replication.forget(objectId);
        this.objects.despawn(objectId);
    }
    private handleWelcome(welcome: WelcomeMessage): void {
        this.welcome = welcome;
        this.attempt = 0;
        this.currentPhase = 'connected';
        this.roster.clear();
        for (const player of welcome.players)
            this.roster.set(player.id, player);
        this.objects.clear();
        this.replication.reset();
        this.replication.configure(welcome.tickRate, welcome.sendRate);
        this.netClock.reset();
        this.interpolation = new InterpolationDelay(1000 / welcome.sendRate);
        this.lastPingAt = Number.NEGATIVE_INFINITY;
        this.listener.connected(welcome.resumed);
    }
}
