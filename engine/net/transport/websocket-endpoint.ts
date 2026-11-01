import { decodeMessage, encodeMessage, MAX_MESSAGE_BYTES, type NetMessage } from '../protocol';
import type { NetEndpoint } from './endpoint';
export const CONNECT_TIMEOUT_MS = 10000;
const CLOSE_REASONS: Record<number, string> = {
    1000: 'fechado pelo servidor',
    1001: 'o servidor foi embora',
    1003: 'o servidor recusou o formato das mensagens',
    1006: 'conexão perdida',
    1008: 'o servidor recusou a conexão',
    1009: 'mensagem grande demais',
    1011: 'erro interno do servidor',
    1012: 'o servidor está reiniciando',
    1013: 'servidor lotado',
};
function describeClose(event: CloseEvent, everOpened: boolean, address: string): string {
    if (event.reason)
        return event.reason;
    if (!everOpened)
        return `não foi possível conectar a ${address}`;
    return CLOSE_REASONS[event.code] ?? `conexão encerrada (código ${event.code})`;
}
export class WebSocketEndpoint implements NetEndpoint {
    private socket: WebSocket | null = null;
    private closed = false;
    private everOpened = false;
    private readonly outbox: string[] = [];
    private readonly messageHandlers = new Set<(message: NetMessage) => void>();
    private readonly closeHandlers = new Set<(reason: string) => void>();
    private timeout: ReturnType<typeof setTimeout> | null = null;
    constructor(readonly address: string) {
        try {
            this.socket = new WebSocket(address);
        }
        catch (cause) {
            queueMicrotask(() => this.finish(cause instanceof Error ? cause.message : `endereço inválido: ${address}`));
            return;
        }
        const socket = this.socket;
        socket.addEventListener('open', () => {
            this.everOpened = true;
            this.clearTimeout();
            for (const text of this.outbox.splice(0))
                socket.send(text);
        });
        socket.addEventListener('message', (event) => this.receive(event.data));
        socket.addEventListener('close', (event) => this.finish(describeClose(event, this.everOpened, address)));
        this.timeout = setTimeout(() => {
            if (this.everOpened || this.closed)
                return;
            this.close(`o servidor em ${address} não respondeu em ${Math.round(CONNECT_TIMEOUT_MS / 1000)} s`);
        }, CONNECT_TIMEOUT_MS);
    }
    get open(): boolean {
        return !this.closed;
    }
    get connecting(): boolean {
        return !this.closed && !this.everOpened;
    }
    send(message: NetMessage): void {
        if (this.closed)
            return;
        const text = encodeMessage(message);
        if (text.length > MAX_MESSAGE_BYTES) {
            this.close(`a mensagem "${message.t}" passou de ${Math.round(MAX_MESSAGE_BYTES / 1024)} KB`);
            return;
        }
        if (this.socket?.readyState === WebSocket.OPEN)
            this.socket.send(text);
        else
            this.outbox.push(text);
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
        if (this.closed)
            return;
        const socket = this.socket;
        if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
            try {
                socket.close(1000, reason.slice(0, 120));
            }
            catch {
                socket.close();
            }
        }
        this.finish(reason);
    }
    private receive(data: unknown): void {
        if (this.closed)
            return;
        if (typeof data !== 'string') {
            this.close('o servidor enviou dados binários; o protocolo é texto JSON');
            return;
        }
        if (data.length > MAX_MESSAGE_BYTES) {
            this.close(`o servidor enviou uma mensagem acima de ${Math.round(MAX_MESSAGE_BYTES / 1024)} KB`);
            return;
        }
        const message = decodeMessage(data);
        if (!message)
            return;
        for (const handler of Array.from(this.messageHandlers))
            handler(message);
    }
    private finish(reason: string): void {
        if (this.closed)
            return;
        this.closed = true;
        this.clearTimeout();
        this.outbox.length = 0;
        for (const handler of Array.from(this.closeHandlers))
            handler(reason);
        this.closeHandlers.clear();
        this.messageHandlers.clear();
        this.socket = null;
    }
    private clearTimeout(): void {
        if (this.timeout === null)
            return;
        clearTimeout(this.timeout);
        this.timeout = null;
    }
}
