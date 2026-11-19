import { BLOCK_PIXELS } from './block-format';
const CHANNELS = 4;
const ALPHA_CHANNEL = 3;
const BLOCK_BYTES = BLOCK_PIXELS * CHANNELS;
const INTERPOLATION_STEPS = 7;
const PIXELS_PER_HALF = BLOCK_PIXELS / 2;
const INDEX_BITS = 3;
const HALF_BYTES = 3;
function paletteIndex(step: number): number {
    if (step === 0)
        return 0;
    return step === INTERPOLATION_STEPS ? 1 : step + 1;
}
export function encodeAlphaBlock(block: Uint8Array, out: Uint8Array, offset: number): void {
    let lowest = 255;
    let highest = 0;
    for (let pixel = ALPHA_CHANNEL; pixel < BLOCK_BYTES; pixel += CHANNELS) {
        const alpha = block[pixel];
        if (alpha < lowest)
            lowest = alpha;
        if (alpha > highest)
            highest = alpha;
    }
    out[offset] = highest;
    out[offset + 1] = lowest;
    if (highest === lowest) {
        out.fill(0, offset + 2, offset + 2 + 2 * HALF_BYTES);
        return;
    }
    const range = highest - lowest;
    for (let half = 0; half < 2; half++) {
        let bits = 0;
        for (let pixel = 0; pixel < PIXELS_PER_HALF; pixel++) {
            const alpha = block[(half * PIXELS_PER_HALF + pixel) * CHANNELS + ALPHA_CHANNEL];
            const step = Math.floor(((highest - alpha) * INTERPOLATION_STEPS + (range >> 1)) / range);
            bits |= paletteIndex(step) << (pixel * INDEX_BITS);
        }
        const target = offset + 2 + half * HALF_BYTES;
        out[target] = bits & 0xff;
        out[target + 1] = (bits >> 8) & 0xff;
        out[target + 2] = (bits >> 16) & 0xff;
    }
}
