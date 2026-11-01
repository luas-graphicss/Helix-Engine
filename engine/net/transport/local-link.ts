import { decodeMessage, encodeMessage, type NetMessage } from '../protocol';
import type { NetEndpoint } from './endpoint';
export interface LinkConditions {
    latencyMs: number;
    jitterMs: number;
    loss: number;
}
export const PERFECT_LINK: LinkConditions = { latencyMs: 0, jitterMs: 0, loss: 0 };
interface Queued {
    readonly dueAt: number;
    readonly text: string;
}
class LocalEndpoint implements NetEndpoint {
    open = true;
    peer: LocalEndpoint | null = null;
    private readonly queue: Queued[] = [];
    private readonly messageHandlers = new Set<(message: NetMessage) => void>();
    private readonly closeHandlers = new Set<(reason: string) => void>();
    constructor(private readonly link: LocalLink, readonly label: string) { }
    send(message: NetMessage): void {
        if (!this.open || !this.peer?.open)
            return;
        const text = encodeMessage(message);
        const { conditions, random } = this.link;
        if (conditions.loss > 0 && random() < conditions.loss && message.t !== 'hello' && message.t !== 'welcome') {
            this.link.dropped++;
            return;
        }
        const jitter = conditions.jitterMs > 0 ? (random() * 2 - 1) * conditions.jitterMs : 0;
        const delay = Math.max(0, conditions.latencyMs + jitter);
        this.peer.enqueue({ dueAt: this.link.now + delay, text });
    }
    onMessage(handler: (message: NetMessage) => void): () => void {
        this.messageHandlers.add(handler);
        return () => this.messageHandlers.delete(handler);
    }
    onClose(handler: (reason: string) => void): () => void {
        this.closeHandlers.add(handler);
        return () => this.closeHandlers.delete(handler);
    }
    close(reason = 'fechado'): void {
        if (!this.open)
            return;
        this.open = false;
        this.queue.length = 0;
        for (const handler of Array.from(this.closeHandlers))
            handler(reason);
        this.closeHandlers.clear();
        this.messageHandlers.clear();
        const peer = this.peer;
        this.peer = null;
        peer?.close(reason);
    }
    enqueue(item: Queued): void {
        const last = this.queue[this.queue.length - 1];
        this.queue.push(last && last.dueAt > item.dueAt ? { ...item, dueAt: last.dueAt } : item);
    }
    deliver(now: number): number {
        let delivered = 0;
        while (this.open && this.queue.length > 0 && this.queue[0].dueAt <= now) {
            const next = this.queue.shift()!;
            const message = decodeMessage(next.text);
            delivered++;
            if (!message)
                continue;
            for (const handler of Array.from(this.messageHandlers))
                handler(message);
        }
        return delivered;
    }
    get pending(): number {
        return this.queue.length;
    }
}
export class LocalLink {
    readonly client: LocalEndpoint;
    readonly server: LocalEndpoint;
    now = 0;
    dropped = 0;
    conditions: LinkConditions;
    constructor(conditions: LinkConditions = PERFECT_LINK, readonly random: () => number = Math.random) {
        this.conditions = { ...conditions };
        this.client = new LocalEndpoint(this, 'cliente');
        this.server = new LocalEndpoint(this, 'servidor');
        this.client.peer = this.server;
        this.server.peer = this.client;
    }
    tick(elapsedMs: number): void {
        this.now += Math.max(0, elapsedMs);
        this.server.deliver(this.now);
        this.client.deliver(this.now);
    }
    flush(): void {
        this.now = Number.MAX_SAFE_INTEGER;
        this.server.deliver(this.now);
        this.client.deliver(this.now);
    }
    get pending(): number {
        return this.client.pending + this.server.pending;
    }
    close(reason?: string): void {
        this.client.close(reason);
        this.server.close(reason);
    }
}
