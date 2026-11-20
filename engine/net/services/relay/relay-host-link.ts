import { DISCONNECT } from '../../transport/disconnect-reason';
import { BufferedSocket, type PacketSocket, type SocketAcceptor } from '../../transport/packet-socket';
import { WireError } from '../../wire/wire-error';
import { RELAY_FRAME_OVERHEAD_BYTES, decodeRelayFrame, encodeRelayClosed, encodeRelayData } from './relay-protocol';
class RelayedSocket extends BufferedSocket {
    readonly maxPacketBytes: number;
    constructor(private readonly relay: PacketSocket, private readonly connectionId: number) {
        super();
        this.maxPacketBytes = relay.maxPacketBytes - RELAY_FRAME_OVERHEAD_BYTES;
        this.markOpen();
    }
    send(packet: Uint8Array): void {
        if (this.state === 'open')
            this.relay.send(encodeRelayData(this.connectionId, packet));
    }
    close(reason: string): void {
        if (this.state === 'closed')
            return;
        this.relay.send(encodeRelayClosed(this.connectionId, reason));
        this.markClosed(reason);
    }
    accept(packet: Uint8Array): void {
        this.deliver(packet);
    }
    end(reason: string): void {
        this.markClosed(reason);
    }
}
export class RelayHostLink {
    private readonly guests = new Map<number, RelayedSocket>();
    private endReason: string | null = null;
    constructor(private readonly relay: PacketSocket, private readonly accept: SocketAcceptor, private readonly ended: (reason: string) => void) {
        relay.attach({
            opened: () => undefined,
            received: (packet) => this.route(packet),
            closed: (reason) => this.finish(reason),
        });
    }
    get isOpen(): boolean {
        return this.endReason === null && this.relay.state === 'open';
    }
    get guestCount(): number {
        return this.guests.size;
    }
    close(reason: string = DISCONNECT.shutdown): void {
        this.relay.close(reason);
        this.finish(reason);
    }
    private route(packet: Uint8Array): void {
        try {
            const frame = decodeRelayFrame(packet);
            if (frame.kind === 'opened') {
                const guest = new RelayedSocket(this.relay, frame.connectionId);
                this.guests.set(frame.connectionId, guest);
                this.accept(guest, '');
                return;
            }
            const guest = this.guests.get(frame.connectionId);
            if (!guest)
                return;
            if (frame.kind === 'data') {
                guest.accept(frame.payload);
                return;
            }
            this.guests.delete(frame.connectionId);
            guest.end(frame.reason);
        }
        catch (error) {
            if (!(error instanceof WireError))
                throw error;
            this.close(DISCONNECT.protocol);
        }
    }
    private finish(reason: string): void {
        if (this.endReason !== null)
            return;
        this.endReason = reason;
        for (const guest of this.guests.values())
            guest.end(DISCONNECT.timeout);
        this.guests.clear();
        this.ended(reason);
    }
}
