export const SEQUENCE_MODULO = 0x10000;
const HALF_RANGE = SEQUENCE_MODULO / 2;
export function nextSequence(sequence: number): number {
    return (sequence + 1) % SEQUENCE_MODULO;
}
export function sequenceDistance(newer: number, older: number): number {
    const forward = (newer - older + SEQUENCE_MODULO) % SEQUENCE_MODULO;
    return forward > HALF_RANGE ? forward - SEQUENCE_MODULO : forward;
}
