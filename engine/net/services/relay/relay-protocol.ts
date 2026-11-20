import { ByteReader } from '../../wire/byte-reader';
import { ByteWriter } from '../../wire/byte-writer';
import { WireError } from '../../wire/wire-error';
export const RELAY_FRAME_OVERHEAD_BYTES = 3;
const FRAME_OPENED = 1;
const FRAME_CLOSED = 2;
const FRAME_DATA = 3;
const MAX_REASON_BYTES = 256;
export type RelayFrame = {
    readonly kind: 'opened';
    readonly connectionId: number;
} | {
    readonly kind: 'closed';
    readonly connectionId: number;
    readonly reason: string;
} | {
    readonly kind: 'data';
    readonly connectionId: number;
    readonly payload: Uint8Array;
};
export function encodeRelayOpened(connectionId: number): Uint8Array {
    return new ByteWriter(RELAY_FRAME_OVERHEAD_BYTES).u8(FRAME_OPENED).u16(connectionId).toBytes();
}
export function encodeRelayClosed(connectionId: number, reason: string): Uint8Array {
    return new ByteWriter().u8(FRAME_CLOSED).u16(connectionId).string(reason.slice(0, MAX_REASON_BYTES / 4)).toBytes();
}
export function encodeRelayData(connectionId: number, payload: Uint8Array): Uint8Array {
    return new ByteWriter(payload.length + RELAY_FRAME_OVERHEAD_BYTES).u8(FRAME_DATA).u16(connectionId).raw(payload).toBytes();
}
export function decodeRelayFrame(packet: Uint8Array): RelayFrame {
    const reader = new ByteReader(packet);
    const kind = reader.u8();
    const connectionId = reader.u16();
    switch (kind) {
        case FRAME_OPENED:
            return { kind: 'opened', connectionId };
        case FRAME_CLOSED:
            return { kind: 'closed', connectionId, reason: reader.string(MAX_REASON_BYTES) };
        case FRAME_DATA:
            return { kind: 'data', connectionId, payload: reader.raw(reader.remaining) };
        default:
            throw new WireError(`unknown relay frame ${kind}`);
    }
}
