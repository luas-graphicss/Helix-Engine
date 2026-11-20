import type { TextChannel } from '../services/text-channel';
import type { PacketSocket } from '../transport/packet-socket';
export type SessionLinkKind = 'local' | 'hosted';
export interface SessionLink {
    readonly kind: SessionLinkKind;
    now(): number;
    openSocket(path: string): PacketSocket;
    openServices(): TextChannel;
    advance(elapsedMs: number): void;
    close(): void;
}
