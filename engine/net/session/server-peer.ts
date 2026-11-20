import type { Connection } from '../connection/connection';
import type { Delivery } from '../connection/delivery';
import { NameDirectory, NameTable } from '../rpc/name-table';
import { TokenBucket } from '../rpc/token-bucket';
import type { ReplicationTarget } from '../sync/server-replication';
import type { SessionPlayer } from './session-protocol';
export type PeerPhase = 'greeting' | 'approving' | 'active' | 'closed';
const UNASSIGNED_PLAYER_ID = -1;
const VIOLATION_DECAY_PER_SECOND = 1;
const BURST_SECONDS = 2;
export class ServerPeer implements ReplicationTarget {
    phase: PeerPhase = 'greeting';
    player: SessionPlayer | null = null;
    resumeToken = '';
    readonly outboundNames = new NameTable();
    readonly inboundNames = new NameDirectory();
    readonly visible = new Set<number>();
    readonly inputTicks = new Map<number, number>();
    readonly messageBucket: TokenBucket;
    private readonly rpcBuckets = new Map<string, TokenBucket>();
    private violations = 0;
    private violationsAt: number;
    constructor(readonly connection: Connection, readonly connectedAt: number, messagesPerSecond: number) {
        this.messageBucket = new TokenBucket(messagesPerSecond, messagesPerSecond * BURST_SECONDS);
        this.violationsAt = connectedAt;
    }
    get playerId(): number {
        return this.player?.id ?? UNASSIGNED_PLAYER_ID;
    }
    get maxUnreliableBytes(): number {
        return this.connection.maxUnreliableBytes;
    }
    send(payload: Uint8Array, delivery: Delivery): void {
        this.connection.send(payload, delivery);
    }
    rpcBucket(name: string, perSecond: number): TokenBucket {
        let bucket = this.rpcBuckets.get(name);
        if (!bucket) {
            bucket = new TokenBucket(perSecond);
            this.rpcBuckets.set(name, bucket);
        }
        return bucket;
    }
    addViolation(weight: number, nowMs: number): number {
        const decayed = (Math.max(0, nowMs - this.violationsAt) / 1000) * VIOLATION_DECAY_PER_SECOND;
        this.violations = Math.max(0, this.violations - decayed) + weight;
        this.violationsAt = nowMs;
        return this.violations;
    }
}
