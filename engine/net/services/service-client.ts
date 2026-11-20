import type { NetValue } from '../wire/net-value';
import { isNetRecord } from './service-params';
import { ServiceError, parseServerFrame, type ServiceReply } from './service-protocol';
import type { TextChannel } from './text-channel';
interface PendingRequest {
    readonly resolve: (value: NetValue) => void;
    readonly reject: (error: ServiceError) => void;
    readonly timer: ReturnType<typeof setTimeout>;
}
export type ServiceEventListener = (payload: NetValue) => void;
export const SERVICE_DISCONNECTED_EVENT = 'service.disconnected';
const DEFAULT_TIMEOUT_MS = 8000;
export class ServiceClient {
    private readonly pending = new Map<number, PendingRequest>();
    private readonly listeners = new Map<string, Set<ServiceEventListener>>();
    private channel: TextChannel | null = null;
    private greeting: Promise<void> | null = null;
    private currentMemberId = '';
    private nextId = 1;
    constructor(private readonly openChannel: () => TextChannel, private readonly name: string, private readonly timeoutMs = DEFAULT_TIMEOUT_MS) { }
    get memberId(): string {
        return this.currentMemberId;
    }
    get isConnected(): boolean {
        return this.channel?.isOpen === true && this.currentMemberId !== '';
    }
    async request(method: string, params: NetValue = {}): Promise<NetValue> {
        await this.greet();
        return this.exchange(method, params);
    }
    on(event: string, listener: ServiceEventListener): () => void {
        let listeners = this.listeners.get(event);
        if (!listeners) {
            listeners = new Set();
            this.listeners.set(event, listeners);
        }
        listeners.add(listener);
        return () => {
            this.listeners.get(event)?.delete(listener);
        };
    }
    close(): void {
        this.channel?.close();
    }
    private greet(): Promise<void> {
        this.greeting ??= this.introduce();
        return this.greeting;
    }
    private async introduce(): Promise<void> {
        const channel = this.openChannel();
        this.channel = channel;
        channel.attach({
            text: (message) => this.handleText(message),
            closed: () => this.handleClosed(channel),
        });
        try {
            const reply = await this.exchange('hello', { name: this.name });
            this.currentMemberId = isNetRecord(reply) && typeof reply.memberId === 'string' ? reply.memberId : '';
        }
        catch (error) {
            this.greeting = null;
            channel.close();
            throw error;
        }
    }
    private exchange(method: string, params: NetValue): Promise<NetValue> {
        const { channel } = this;
        if (!channel?.isOpen)
            return Promise.reject(new ServiceError('disconnected', ''));
        const id = this.nextId++;
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(id);
                reject(new ServiceError('timeout', method));
            }, this.timeoutMs);
            this.pending.set(id, { resolve, reject, timer });
            channel.send(JSON.stringify({ id, method, params }));
        });
    }
    private handleText(message: string): void {
        const frame = parseServerFrame(message);
        if (!frame)
            return;
        if ('event' in frame) {
            this.emit(frame.event, frame.payload);
            return;
        }
        this.settle(frame);
    }
    private settle(reply: ServiceReply): void {
        const request = this.pending.get(reply.id);
        if (!request)
            return;
        this.pending.delete(reply.id);
        clearTimeout(request.timer);
        if (reply.ok)
            request.resolve(reply.value);
        else
            request.reject(new ServiceError(reply.code, reply.message));
    }
    private handleClosed(channel: TextChannel): void {
        if (this.channel !== channel)
            return;
        this.channel = null;
        this.greeting = null;
        this.currentMemberId = '';
        for (const request of this.pending.values()) {
            clearTimeout(request.timer);
            request.reject(new ServiceError('disconnected', ''));
        }
        this.pending.clear();
        this.emit(SERVICE_DISCONNECTED_EVENT, null);
    }
    private emit(event: string, payload: NetValue): void {
        for (const listener of Array.from(this.listeners.get(event) ?? []))
            listener(payload);
    }
}
