import { nextSequence, sequenceDistance } from '../wire/sequence';
import { frameBytes } from './packet-format';
const SEND_WINDOW = 512;
const MAX_BACKOFF_FACTOR = 8;
export interface OutboundFrame {
    readonly id: number;
    readonly continues: boolean;
    readonly payload: Uint8Array;
}
interface PendingFrame extends OutboundFrame {
    lastSentAt: number;
    sends: number;
}
export interface CollectedFrames {
    readonly frames: OutboundFrame[];
    readonly bytes: number;
}
export class ReliableOutbox {
    private nextId = 0;
    private pending: PendingFrame[] = [];
    private queuedBytes = 0;
    private resends = 0;
    get backlogBytes(): number {
        return this.queuedBytes;
    }
    get resentFrames(): number {
        return this.resends;
    }
    enqueue(payload: Uint8Array, fragmentBytes: number): void {
        let offset = 0;
        do {
            const end = Math.min(payload.length, offset + fragmentBytes);
            this.pending.push({ id: this.nextId, continues: end < payload.length, payload: payload.subarray(offset, end), lastSentAt: 0, sends: 0 });
            this.nextId = nextSequence(this.nextId);
            offset = end;
        } while (offset < payload.length);
        this.queuedBytes += payload.length;
    }
    collect(now: number, retransmitMs: number, budgetBytes: number): CollectedFrames {
        const frames: OutboundFrame[] = [];
        let bytes = 0;
        const oldest = this.pending[0];
        if (!oldest)
            return { frames, bytes };
        for (const frame of this.pending) {
            if (sequenceDistance(frame.id, oldest.id) >= SEND_WINDOW)
                break;
            if (frame.sends > 0 && now - frame.lastSentAt < retransmitMs * Math.min(MAX_BACKOFF_FACTOR, 2 ** (frame.sends - 1)))
                continue;
            const cost = frameBytes(frame.payload.length, true);
            if (bytes + cost > budgetBytes)
                break;
            bytes += cost;
            if (frame.sends > 0)
                this.resends++;
            frame.lastSentAt = now;
            frame.sends++;
            frames.push(frame);
        }
        return { frames, bytes };
    }
    acknowledge(ids: readonly number[]): void {
        if (ids.length === 0)
            return;
        const acknowledged = new Set(ids);
        this.pending = this.pending.filter((frame) => {
            if (!acknowledged.has(frame.id))
                return true;
            this.queuedBytes -= frame.payload.length;
            return false;
        });
    }
}
