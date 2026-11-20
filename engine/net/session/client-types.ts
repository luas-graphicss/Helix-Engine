import type { ConnectionOptions } from '../connection/connection';
import type { NetworkObject } from '../objects/network-object';
import type { PacketSocket } from '../transport/packet-socket';
import type { NetValue } from '../wire/net-value';
import type { SessionPlayer } from './session-protocol';
export type ClientPhase = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'closed';
export interface NetClientOptions {
    readonly name: string;
    readonly ticket: NetValue;
    readonly schema: string;
    readonly clock: () => number;
    readonly openSocket: () => PacketSocket;
    readonly reconnectAttempts: number;
    readonly reconnectBaseDelayMs: number;
    readonly connection: ConnectionOptions;
}
export interface NetClientListener {
    connected(resumed: boolean): void;
    reconnecting(attempt: number): void;
    disconnected(reason: string): void;
    playerJoined(player: SessionPlayer): void;
    playerLeft(player: SessionPlayer, reason: string): void;
    corrected(object: NetworkObject): void;
}
