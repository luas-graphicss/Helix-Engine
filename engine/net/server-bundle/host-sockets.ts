import type { TextChannel, TextChannelListener } from '../services/text-channel';
import { DISCONNECT } from '../transport/disconnect-reason';
import { BufferedSocket } from '../transport/packet-socket';
import { WEBSOCKET_MAX_PACKET_BYTES } from '../transport/websocket-socket';
export interface HostSocket {
    send(data: Uint8Array | string): void;
    close(reason: string): void;
}
export interface HostConnection {
    binary(data: Uint8Array): void;
    text(message: string): void;
    closed(reason: string): void;
}
const MAX_PENDING_MESSAGES = 64;
export class HostPacketSocket extends BufferedSocket implements HostConnection {
    readonly maxPacketBytes = WEBSOCKET_MAX_PACKET_BYTES;
    constructor(private readonly socket: HostSocket) {
        super();
        this.markOpen();
    }
    send(packet: Uint8Array): void {
        if (this.state === 'open')
            this.socket.send(packet);
    }
    close(reason: string): void {
        if (this.state === 'closed')
            return;
        this.markClosed(reason);
        this.socket.close(reason);
    }
    binary(data: Uint8Array): void {
        this.deliver(data);
    }
    text(): void {
        this.close(DISCONNECT.protocol);
    }
    closed(reason: string): void {
        this.markClosed(reason || DISCONNECT.timeout);
    }
}
export class HostTextChannel implements TextChannel, HostConnection {
    private readonly backlog: string[] = [];
    private listener: TextChannelListener | null = null;
    private open = true;
    constructor(private readonly socket: HostSocket) { }
    get isOpen(): boolean {
        return this.open;
    }
    attach(listener: TextChannelListener): void {
        this.listener = listener;
        for (const message of this.backlog.splice(0))
            listener.text(message);
        if (!this.open)
            listener.closed();
    }
    send(message: string): void {
        if (this.open)
            this.socket.send(message);
    }
    close(): void {
        if (!this.open)
            return;
        this.finish();
        this.socket.close(DISCONNECT.shutdown);
    }
    binary(): void {
        this.close();
    }
    text(message: string): void {
        if (!this.open)
            return;
        if (this.listener)
            this.listener.text(message);
        else if (this.backlog.length < MAX_PENDING_MESSAGES)
            this.backlog.push(message);
    }
    closed(): void {
        this.finish();
    }
    private finish(): void {
        if (!this.open)
            return;
        this.open = false;
        this.listener?.closed();
    }
}
