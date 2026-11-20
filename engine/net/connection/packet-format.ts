import { ByteReader } from '../wire/byte-reader';
import type { ByteWriter } from '../wire/byte-writer';
import { WireError } from '../wire/wire-error';
export const PACKET_HEADER_BYTES = 12;
export const MAX_FRAME_OVERHEAD_BYTES = 6;
const PACKET_MAGIC = 0xc7;
const HEADER_HAS_ACK = 1;
const FRAME_RELIABLE = 1;
const FRAME_CONTINUES = 2;
const MAX_ACK_DELAY_MS = 0xffff;
const VARUINT_RADIX = 0x80;
export interface PacketHeader {
    readonly sequence: number;
    readonly ack: number | null;
    readonly ackBits: number;
    readonly ackDelayMs: number;
}
export interface PacketFrame {
    readonly reliableId: number | null;
    readonly continues: boolean;
    readonly payload: Uint8Array;
}
export interface ParsedPacket {
    readonly header: PacketHeader;
    readonly frames: PacketFrame[];
}
function varuintBytes(value: number): number {
    let bytes = 1;
    for (let rest = value; rest >= VARUINT_RADIX; rest = Math.floor(rest / VARUINT_RADIX))
        bytes++;
    return bytes;
}
export function frameBytes(payloadBytes: number, reliable: boolean): number {
    return 1 + (reliable ? 2 : 0) + varuintBytes(payloadBytes) + payloadBytes;
}
export function writePacketHeader(writer: ByteWriter, header: PacketHeader): void {
    writer
        .u8(PACKET_MAGIC)
        .u8(header.ack === null ? 0 : HEADER_HAS_ACK)
        .u16(header.sequence)
        .u16(header.ack ?? 0)
        .u32(header.ackBits)
        .u16(Math.min(MAX_ACK_DELAY_MS, Math.max(0, Math.round(header.ackDelayMs))));
}
export function writeFrame(writer: ByteWriter, frame: PacketFrame): void {
    const flags = (frame.reliableId === null ? 0 : FRAME_RELIABLE) | (frame.continues ? FRAME_CONTINUES : 0);
    writer.u8(flags);
    if (frame.reliableId !== null)
        writer.u16(frame.reliableId);
    writer.block(frame.payload);
}
function readFrame(reader: ByteReader): PacketFrame {
    const flags = reader.u8();
    const reliableId = (flags & FRAME_RELIABLE) !== 0 ? reader.u16() : null;
    return { reliableId, continues: (flags & FRAME_CONTINUES) !== 0, payload: reader.block(reader.remaining) };
}
export function readPacket(packet: Uint8Array): ParsedPacket {
    const reader = new ByteReader(packet);
    if (reader.u8() !== PACKET_MAGIC)
        throw new WireError('packet does not start with the protocol marker');
    const hasAck = (reader.u8() & HEADER_HAS_ACK) !== 0;
    const sequence = reader.u16();
    const ack = reader.u16();
    const ackBits = reader.u32();
    const ackDelayMs = reader.u16();
    const frames: PacketFrame[] = [];
    while (reader.remaining > 0)
        frames.push(readFrame(reader));
    return { header: { sequence, ack: hasAck ? ack : null, ackBits, ackDelayMs }, frames };
}
