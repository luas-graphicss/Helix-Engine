export const ACK_HISTORY_BITS = 32;
export function ackBit(index: number): number {
    return (1 << index) >>> 0;
}
export function hasAckBit(bits: number, index: number): boolean {
    return (bits & ackBit(index)) !== 0;
}
