export interface TextChannelListener {
    text(message: string): void;
    closed(): void;
}
export interface TextChannel {
    readonly isOpen: boolean;
    attach(listener: TextChannelListener): void;
    send(message: string): void;
    close(): void;
}
class LinkedChannel implements TextChannel {
    peer: LinkedChannel | null = null;
    private listener: TextChannelListener | null = null;
    private readonly backlog: string[] = [];
    private open = true;
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
        const { peer } = this;
        if (this.open && peer)
            queueMicrotask(() => peer.receive(message));
    }
    close(): void {
        if (!this.open)
            return;
        this.open = false;
        const { peer } = this;
        this.peer = null;
        this.listener?.closed();
        if (peer)
            queueMicrotask(() => peer.close());
    }
    private receive(message: string): void {
        if (!this.open)
            return;
        if (this.listener)
            this.listener.text(message);
        else
            this.backlog.push(message);
    }
}
export function createChannelPair(): [
    TextChannel,
    TextChannel
] {
    const near = new LinkedChannel();
    const far = new LinkedChannel();
    near.peer = far;
    far.peer = near;
    return [near, far];
}
