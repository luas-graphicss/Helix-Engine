import { DISCONNECT } from '../transport/disconnect-reason';
import type { PacketSocket, SocketState } from '../transport/packet-socket';
import { ByteWriter } from '../wire/byte-writer';
import { nextSequence } from '../wire/sequence';
import { WireError } from '../wire/wire-error';
import type { Delivery } from './delivery';
import { MAX_FRAME_OVERHEAD_BYTES, PACKET_HEADER_BYTES, frameBytes, readPacket, writeFrame, writePacketHeader, type PacketFrame, type ParsedPacket } from './packet-format';
import { ReceivedPackets } from './received-packets';
import { ReliableInbox } from './reliable-inbox';
import { ReliableOutbox, type OutboundFrame } from './reliable-outbox';
import { RoundTripEstimator } from './round-trip-estimator';
import { SentPackets } from './sent-packets';
import { TrafficMeter } from './traffic-meter';
export interface ConnectionOptions {
    readonly timeoutMs: number;
    readonly keepAliveMs: number;
    readonly maxMessageBytes: number;
    readonly maxBacklogBytes: number;
}
export const DEFAULT_CONNECTION_OPTIONS: ConnectionOptions = {
    timeoutMs: 10000,
    keepAliveMs: 500,
    maxMessageBytes: 1024 * 1024,
    maxBacklogBytes: 8 * 1024 * 1024,
};
export interface ConnectionListener {
    opened(): void;
    message(payload: Uint8Array, delivery: Delivery, receivedAt: number): void;
    closed(reason: string): void;
}
export interface ConnectionStats {
    readonly roundTripMs: number;
    readonly jitterMs: number;
    readonly lossRate: number;
    readonly bytesSentPerSecond: number;
    readonly bytesReceivedPerSecond: number;
    readonly packetsSentPerSecond: number;
    readonly packetsReceivedPerSecond: number;
    readonly totalBytesSent: number;
    readonly totalBytesReceived: number;
    readonly backlogBytes: number;
    readonly resentFrames: number;
}
interface Arrival {
    readonly packet: Uint8Array;
    readonly at: number;
}
const MAX_PENDING_ARRIVALS = 4096;
const MAX_QUEUED_UNRELIABLE = 2048;
const MAX_MALFORMED_PACKETS = 8;
const MAX_PACKETS_PER_UPDATE = 64;
export class Connection {
    private readonly arrivals: Arrival[] = [];
    private readonly unreliable: Uint8Array[] = [];
    private readonly outbox = new ReliableOutbox();
    private readonly inbox: ReliableInbox;
    private readonly received = new ReceivedPackets();
    private readonly sent = new SentPackets();
    private readonly roundTrip = new RoundTripEstimator();
    private readonly outgoing = new TrafficMeter();
    private readonly incoming = new TrafficMeter();
    private readonly writer = new ByteWriter(1500);
    private readonly createdAt: number;
    private sequence = 0;
    private malformed = 0;
    private socketOpen = false;
    private announced = false;
    private ended = false;
    private remoteEnd: string | null = null;
    private ackPending = false;
    private lastReceivedAt: number;
    private lastSentAt = Number.NEGATIVE_INFINITY;
    private latestArrivalAt = 0;
    constructor(private readonly socket: PacketSocket, private readonly clock: () => number, private readonly listener: ConnectionListener, private readonly options: ConnectionOptions = DEFAULT_CONNECTION_OPTIONS) {
        this.inbox = new ReliableInbox(options.maxMessageBytes);
        this.createdAt = clock();
        this.lastReceivedAt = this.createdAt;
        socket.attach({
            opened: () => this.handleSocketOpened(),
            received: (packet) => this.handleSocketPacket(packet),
            closed: (reason) => {
                this.remoteEnd ??= reason;
            },
        });
    }
    get state(): SocketState {
        if (this.ended)
            return 'closed';
        return this.announced ? 'open' : 'connecting';
    }
    get maxUnreliableBytes(): number {
        return this.socket.maxPacketBytes - PACKET_HEADER_BYTES - MAX_FRAME_OVERHEAD_BYTES;
    }
    get stats(): ConnectionStats {
        return {
            roundTripMs: this.roundTrip.roundTripMs,
            jitterMs: this.roundTrip.jitterMs,
            lossRate: this.sent.lossRate,
            bytesSentPerSecond: this.outgoing.bytesPerSecond,
            bytesReceivedPerSecond: this.incoming.bytesPerSecond,
            packetsSentPerSecond: this.outgoing.packetsPerSecond,
            packetsReceivedPerSecond: this.incoming.packetsPerSecond,
            totalBytesSent: this.outgoing.totalBytes,
            totalBytesReceived: this.incoming.totalBytes,
            backlogBytes: this.outbox.backlogBytes,
            resentFrames: this.outbox.resentFrames,
        };
    }
    send(payload: Uint8Array, delivery: Delivery): void {
        if (this.ended)
            return;
        if (delivery === 'reliable') {
            if (payload.length > this.options.maxMessageBytes)
                throw new RangeError(`reliable message of ${payload.length} bytes exceeds the ${this.options.maxMessageBytes} byte limit`);
            this.outbox.enqueue(payload, this.maxUnreliableBytes);
            return;
        }
        if (payload.length > this.maxUnreliableBytes)
            throw new RangeError(`unreliable message of ${payload.length} bytes exceeds the ${this.maxUnreliableBytes} byte limit`);
        if (this.unreliable.length >= MAX_QUEUED_UNRELIABLE)
            this.unreliable.shift();
        this.unreliable.push(payload);
    }
    update(): void {
        this.receive();
        this.transmit();
    }
    receive(): void {
        if (this.ended)
            return;
        const now = this.clock();
        if (this.socketOpen && !this.announced) {
            this.announced = true;
            this.listener.opened();
        }
        this.drainArrivals();
        if (this.ended)
            return;
        if (this.remoteEnd !== null) {
            this.end(this.remoteEnd);
            return;
        }
        if (now - this.lastReceivedAt > this.options.timeoutMs)
            this.fail(DISCONNECT.timeout);
    }
    transmit(): void {
        if (this.ended || !this.socketOpen)
            return;
        const now = this.clock();
        if (this.outbox.backlogBytes > this.options.maxBacklogBytes) {
            this.fail(DISCONNECT.overflow);
            return;
        }
        this.flush(now);
        this.outgoing.roll(now);
        this.incoming.roll(now);
    }
    close(reason: string): void {
        if (this.ended)
            return;
        this.ended = true;
        this.socket.close(reason);
    }
    private handleSocketOpened(): void {
        this.socketOpen = true;
        this.lastReceivedAt = this.clock();
    }
    private handleSocketPacket(packet: Uint8Array): void {
        if (this.arrivals.length < MAX_PENDING_ARRIVALS)
            this.arrivals.push({ packet, at: this.clock() });
    }
    private end(reason: string): void {
        this.ended = true;
        this.listener.closed(reason);
    }
    private fail(reason: string): void {
        this.socket.close(reason);
        this.end(reason);
    }
    private drainArrivals(): void {
        for (const arrival of this.arrivals.splice(0)) {
            if (this.ended)
                return;
            this.incoming.record(arrival.packet.length);
            const parsed = this.parse(arrival.packet);
            if (parsed)
                this.acceptPacket(parsed, arrival.at);
        }
    }
    private parse(packet: Uint8Array): ParsedPacket | null {
        try {
            return readPacket(packet);
        }
        catch (error) {
            if (!(error instanceof WireError))
                throw error;
            this.malformed++;
            if (this.malformed > MAX_MALFORMED_PACKETS)
                this.fail(DISCONNECT.protocol);
            return null;
        }
    }
    private acceptPacket({ header, frames }: ParsedPacket, arrivedAt: number): void {
        this.lastReceivedAt = Math.max(this.lastReceivedAt, arrivedAt);
        if (header.ack !== null) {
            const { reliableIds, latestSentAt } = this.sent.acknowledge(header.ack, header.ackBits);
            this.outbox.acknowledge(reliableIds);
            if (latestSentAt !== null)
                this.roundTrip.sample(Math.max(0, arrivedAt - latestSentAt - header.ackDelayMs));
        }
        if (!this.received.record(header.sequence))
            return;
        if (this.received.ack === header.sequence)
            this.latestArrivalAt = arrivedAt;
        if (frames.length > 0)
            this.ackPending = true;
        for (const frame of frames) {
            if (this.ended)
                return;
            this.deliverFrame(frame, arrivedAt);
        }
    }
    private deliverFrame(frame: PacketFrame, arrivedAt: number): void {
        if (frame.reliableId === null) {
            this.listener.message(frame.payload, 'unreliable', arrivedAt);
            return;
        }
        for (const message of this.reassemble(frame.reliableId, frame)) {
            if (this.ended)
                return;
            this.listener.message(message, 'reliable', arrivedAt);
        }
    }
    private reassemble(reliableId: number, frame: PacketFrame): Uint8Array[] {
        try {
            return this.inbox.accept(reliableId, frame.payload, frame.continues);
        }
        catch (error) {
            if (!(error instanceof WireError))
                throw error;
            this.fail(DISCONNECT.protocol);
            return [];
        }
    }
    private flush(now: number): void {
        const packetBudget = this.socket.maxPacketBytes - PACKET_HEADER_BYTES;
        for (let count = 0; count < MAX_PACKETS_PER_UPDATE; count++) {
            const reliable = this.outbox.collect(now, this.roundTrip.retransmitMs, packetBudget);
            const loose = this.takeUnreliable(packetBudget - reliable.bytes);
            const idle = reliable.frames.length === 0 && loose.length === 0;
            if (idle && !this.ackPending && now - this.lastSentAt < this.options.keepAliveMs)
                return;
            this.sendPacket(now, reliable.frames, loose);
            if (idle)
                return;
        }
    }
    private takeUnreliable(budgetBytes: number): Uint8Array[] {
        const taken: Uint8Array[] = [];
        let left = budgetBytes;
        for (let next = this.unreliable[0]; next; next = this.unreliable[0]) {
            const cost = frameBytes(next.length, false);
            if (cost > left)
                break;
            left -= cost;
            taken.push(next);
            this.unreliable.shift();
        }
        return taken;
    }
    private sendPacket(now: number, reliable: readonly OutboundFrame[], loose: readonly Uint8Array[]): void {
        const sequence = this.sequence;
        this.sequence = nextSequence(sequence);
        const writer = this.writer.reset();
        const ack = this.received.ack;
        writePacketHeader(writer, { sequence, ack, ackBits: this.received.ackBits, ackDelayMs: ack === null ? 0 : now - this.latestArrivalAt });
        for (const frame of reliable)
            writeFrame(writer, { reliableId: frame.id, continues: frame.continues, payload: frame.payload });
        for (const payload of loose)
            writeFrame(writer, { reliableId: null, continues: false, payload });
        const packet = writer.toBytes();
        this.sent.record(sequence, now, reliable.map((frame) => frame.id));
        this.socket.send(packet);
        this.outgoing.record(packet.length);
        this.lastSentAt = now;
        this.ackPending = false;
    }
}
