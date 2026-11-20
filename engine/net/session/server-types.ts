import type { ConnectionOptions } from '../connection/connection';
import type { Delivery } from '../connection/delivery';
import type { NetworkObject } from '../objects/network-object';
import type { NetValue } from '../wire/net-value';
import type { SessionPlayer } from './session-protocol';
export interface JoinRequest {
    readonly name: string;
    readonly ticket: NetValue;
}
export type JoinVerdict = {
    readonly accepted: true;
    readonly name?: string;
} | {
    readonly accepted: false;
    readonly reason: string;
};
export type JoinApprover = (request: JoinRequest) => JoinVerdict | Promise<JoinVerdict>;
export interface NetServerOptions {
    readonly sessionId: string;
    readonly schema: string;
    readonly tickRate: number;
    readonly sendRate: number;
    readonly maxPlayers: number;
    readonly reconnectGraceMs: number;
    readonly maxMessagesPerSecond: number;
    readonly maxViolations: number;
    readonly clock: () => number;
    readonly connection: ConnectionOptions;
}
export interface NetServerListener {
    playerJoined(player: SessionPlayer): void;
    playerLeft(player: SessionPlayer, reason: string): void;
    playerSuspended(player: SessionPlayer): void;
    playerResumed(player: SessionPlayer): void;
    inputReceived(player: SessionPlayer, object: NetworkObject, tick: number, input: NetValue): void;
    ownershipRequested(player: SessionPlayer, object: NetworkObject): boolean;
    approvalFailed(cause: unknown): void;
    ticked(tick: number, deltaSeconds: number): void;
}
export interface RpcAudience {
    readonly delivery?: Delivery;
    readonly only?: readonly number[];
    readonly except?: number;
}
