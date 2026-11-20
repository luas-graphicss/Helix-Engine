import { sequenceDistance } from '../wire/sequence';
import { ACK_HISTORY_BITS, hasAckBit } from './ack-bits';
interface SentPacket {
    readonly sentAt: number;
    readonly reliableIds: readonly number[];
}
export interface Acknowledgement {
    readonly reliableIds: number[];
    readonly latestSentAt: number | null;
}
const OUTCOME_WINDOW = 128;
const MAX_IN_FLIGHT = 1024;
export class SentPackets {
    private readonly inFlight = new Map<number, SentPacket>();
    private readonly outcomes: boolean[] = [];
    private cursor = 0;
    private lost = 0;
    get lossRate(): number {
        return this.outcomes.length === 0 ? 0 : this.lost / this.outcomes.length;
    }
    record(sequence: number, sentAt: number, reliableIds: readonly number[]): void {
        if (this.inFlight.size >= MAX_IN_FLIGHT)
            this.dropOldest();
        this.inFlight.set(sequence, { sentAt, reliableIds });
    }
    acknowledge(ack: number, ackBits: number): Acknowledgement {
        const reliableIds: number[] = [];
        let latestSentAt: number | null = null;
        for (const [sequence, packet] of this.inFlight) {
            const behind = sequenceDistance(ack, sequence);
            if (behind < 0)
                continue;
            if (behind === 0 || (behind <= ACK_HISTORY_BITS && hasAckBit(ackBits, behind - 1))) {
                reliableIds.push(...packet.reliableIds);
                if (behind === 0)
                    latestSentAt = packet.sentAt;
                this.settle(sequence, false);
            }
            else if (behind > ACK_HISTORY_BITS)
                this.settle(sequence, true);
        }
        return { reliableIds, latestSentAt };
    }
    private dropOldest(): void {
        for (const sequence of this.inFlight.keys()) {
            this.settle(sequence, true);
            return;
        }
    }
    private settle(sequence: number, wasLost: boolean): void {
        this.inFlight.delete(sequence);
        if (this.outcomes.length < OUTCOME_WINDOW) {
            this.outcomes.push(wasLost);
        }
        else {
            if (this.outcomes[this.cursor])
                this.lost--;
            this.outcomes[this.cursor] = wasLost;
            this.cursor = (this.cursor + 1) % OUTCOME_WINDOW;
        }
        if (wasLost)
            this.lost++;
    }
}
