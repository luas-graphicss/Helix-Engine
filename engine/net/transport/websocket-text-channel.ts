import type { TextChannel, TextChannelListener } from '../services/text-channel';
const NORMAL_CLOSURE = 1000;
const MAX_PENDING_MESSAGES = 256;
export class WebSocketTextChannel implements TextChannel {
    private readonly socket: WebSocket;
    private readonly outbox: string[] = [];
    private readonly inbox: string[] = [];
    private listener: TextChannelListener | null = null;
    private open = true;
    constructor(url: string) {
        this.socket = new WebSocket(url);
        this.socket.addEventListener('open', () => this.flush());
        this.socket.addEventListener('message', (event: MessageEvent<unknown>) => this.receive(event.data));
        this.socket.addEventListener('close', () => this.finish());
    }
    get isOpen(): boolean {
        return this.open;
    }
    attach(listener: TextChannelListener): void {
        this.listener = listener;
        for (const message of this.inbox.splice(0))
            listener.text(message);
        if (!this.open)
            listener.closed();
    }
    send(message: string): void {
        if (!this.open)
            return;
        if (this.socket.readyState === WebSocket.OPEN)
            this.socket.send(message);
        else if (this.outbox.length < MAX_PENDING_MESSAGES)
            this.outbox.push(message);
    }
    close(): void {
        if (!this.open)
            return;
        this.finish();
        this.socket.close(NORMAL_CLOSURE);
    }
    private flush(): void {
        for (const message of this.outbox.splice(0))
            this.socket.send(message);
    }
    private receive(payload: unknown): void {
        if (!this.open || typeof payload !== 'string')
            return;
        if (this.listener)
            this.listener.text(payload);
        else if (this.inbox.length < MAX_PENDING_MESSAGES)
            this.inbox.push(payload);
    }
    private finish(): void {
        if (!this.open)
            return;
        this.open = false;
        this.outbox.length = 0;
        this.listener?.closed();
    }
}
