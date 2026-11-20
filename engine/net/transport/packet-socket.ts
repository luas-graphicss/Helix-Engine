export type SocketState = 'connecting' | 'open' | 'closed';
export interface SocketListener {
    opened(): void;
    received(packet: Uint8Array): void;
    closed(reason: string): void;
}
export interface PacketSocket {
    readonly state: SocketState;
    readonly maxPacketBytes: number;
    attach(listener: SocketListener): void;
    send(packet: Uint8Array): void;
    close(reason: string): void;
}
export type SocketAcceptor = (socket: PacketSocket, path: string) => void;
const MAX_BACKLOG_PACKETS = 256;
export abstract class BufferedSocket implements PacketSocket {
    abstract readonly maxPacketBytes: number;
    private current: SocketState = 'connecting';
    private everOpened = false;
    private listener: SocketListener | null = null;
    private closeReason = '';
    private readonly backlog: Uint8Array[] = [];
    get state(): SocketState {
        return this.current;
    }
    abstract send(packet: Uint8Array): void;
    abstract close(reason: string): void;
    attach(listener: SocketListener): void {
        this.listener = listener;
        if (this.everOpened)
            listener.opened();
        for (const packet of this.backlog.splice(0))
            listener.received(packet);
        if (this.current === 'closed')
            listener.closed(this.closeReason);
    }
    protected markOpen(): void {
        if (this.current !== 'connecting')
            return;
        this.current = 'open';
        this.everOpened = true;
        this.listener?.opened();
    }
    protected deliver(packet: Uint8Array): void {
        if (this.current !== 'open')
            return;
        if (this.listener)
            this.listener.received(packet);
        else if (this.backlog.length < MAX_BACKLOG_PACKETS)
            this.backlog.push(packet);
    }
    protected markClosed(reason: string): void {
        if (this.current === 'closed')
            return;
        this.current = 'closed';
        this.closeReason = reason;
        this.listener?.closed(reason);
    }
}
