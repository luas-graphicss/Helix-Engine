import type { NetMessage } from '../protocol';
export interface NetEndpoint {
    readonly open: boolean;
    send(message: NetMessage): void;
    onMessage(handler: (message: NetMessage) => void): () => void;
    onClose(handler: (reason: string) => void): () => void;
    close(reason?: string): void;
}
export type NetTransportKind = 'none' | 'local' | 'websocket';
