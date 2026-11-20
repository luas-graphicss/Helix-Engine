import { LocalBackend } from '../server/local-backend';
import type { MultiplayerServerConfig } from '../server/server-config';
import type { SessionDelegateFactory } from '../server/session-delegate';
import type { TextChannel } from '../services/text-channel';
import type { NetworkConditions } from '../transport/network-conditions';
import type { PacketSocket } from '../transport/packet-socket';
import type { SessionLink } from './session-link';
export class LocalSessionLink implements SessionLink {
    readonly kind = 'local';
    readonly backend: LocalBackend;
    constructor(config: MultiplayerServerConfig, conditions: NetworkConditions, createDelegate: SessionDelegateFactory) {
        this.backend = new LocalBackend(config, conditions, createDelegate);
    }
    now(): number {
        return this.backend.timeMs;
    }
    openSocket(path: string): PacketSocket {
        return this.backend.openSocket(path);
    }
    openServices(): TextChannel {
        return this.backend.openServices();
    }
    advance(elapsedMs: number): void {
        this.backend.advance(elapsedMs);
    }
    close(): void {
        this.backend.close();
    }
}
