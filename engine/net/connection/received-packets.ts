import { sequenceDistance } from '../wire/sequence';
import { ACK_HISTORY_BITS, ackBit, hasAckBit } from './ack-bits';
export class ReceivedPackets {
    private latest: number | null = null;
    private history = 0;
    get ack(): number | null {
        return this.latest;
    }
    get ackBits(): number {
        return this.history;
    }
    record(sequence: number): boolean {
        if (this.latest === null) {
            this.latest = sequence;
            return true;
        }
        const distance = sequenceDistance(sequence, this.latest);
        if (distance === 0)
            return false;
        if (distance > 0) {
            const shifted = distance >= ACK_HISTORY_BITS ? 0 : (this.history << distance) >>> 0;
            const previous = distance <= ACK_HISTORY_BITS ? ackBit(distance - 1) : 0;
            this.history = (shifted | previous) >>> 0;
            this.latest = sequence;
            return true;
        }
        const index = -distance - 1;
        if (index >= ACK_HISTORY_BITS || hasAckBit(this.history, index))
            return false;
        this.history = (this.history | ackBit(index)) >>> 0;
        return true;
    }
}
