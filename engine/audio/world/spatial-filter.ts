export const OPEN_FILTER_HZ = 20000;
const MIN_CUTOFF_HZ = 300;
const AIR_REFERENCE_DISTANCE = 40;
const AIR_CURVE = 1.2;
const LOG_OPEN = Math.log(OPEN_FILTER_HZ);
export function airAbsorptionCutoff(distance: number, amount: number): number {
    if (amount <= 0 || distance <= 0)
        return OPEN_FILTER_HZ;
    const ratio = AIR_REFERENCE_DISTANCE / (AIR_REFERENCE_DISTANCE + amount * distance);
    return Math.max(MIN_CUTOFF_HZ, OPEN_FILTER_HZ * Math.pow(ratio, AIR_CURVE));
}
export function blendCutoff(cutoff: number, amount: number): number {
    if (amount <= 0)
        return OPEN_FILTER_HZ;
    const target = Math.log(Math.max(MIN_CUTOFF_HZ, cutoff));
    return Math.exp(LOG_OPEN + (target - LOG_OPEN) * Math.min(1, amount));
}
export function clampCutoff(cutoff: number): number {
    return Math.min(OPEN_FILTER_HZ, Math.max(MIN_CUTOFF_HZ, cutoff));
}
