import { nextSequence, sequenceDistance } from '../wire/sequence';
import { WireError } from '../wire/wire-error';
const RECEIVE_WINDOW = 1024;
interface HeldFrame {
    readonly payload: Uint8Array;
    readonly continues: boolean;
}
function joinParts(parts: readonly Uint8Array[], totalBytes: number): Uint8Array {
    if (parts.length === 1)
        return parts[0];
    const joined = new Uint8Array(totalBytes);
    let offset = 0;
    for (const part of parts) {
        joined.set(part, offset);
        offset += part.length;
    }
    return joined;
}
export class ReliableInbox {
    private expected = 0;
    private readonly held = new Map<number, HeldFrame>();
    private parts: Uint8Array[] = [];
    private partBytes = 0;
    constructor(private readonly maxMessageBytes: number) { }
    accept(id: number, payload: Uint8Array, continues: boolean): Uint8Array[] {
        const distance = sequenceDistance(id, this.expected);
        if (distance < 0 || this.held.has(id))
            return [];
        if (distance >= RECEIVE_WINDOW)
            throw new WireError(`reliable frame ${id} is outside the receive window`);
        this.held.set(id, { payload, continues });
        const completed: Uint8Array[] = [];
        for (let frame = this.held.get(this.expected); frame; frame = this.held.get(this.expected)) {
            this.held.delete(this.expected);
            this.expected = nextSequence(this.expected);
            this.partBytes += frame.payload.length;
            if (this.partBytes > this.maxMessageBytes)
                throw new WireError(`reliable message exceeds the ${this.maxMessageBytes} byte limit`);
            this.parts.push(frame.payload);
            if (frame.continues)
                continue;
            completed.push(joinParts(this.parts, this.partBytes));
            this.parts = [];
            this.partBytes = 0;
        }
        return completed;
    }
}
