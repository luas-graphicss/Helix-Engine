import type { PixelLevel } from './pixel-level';
const CHANNELS = 4;
const ALPHA_CHANNEL = 3;
const LINEAR_STEPS = 4095;
const SRGB_TO_LINEAR = new Float32Array(256);
const LINEAR_TO_SRGB = new Uint8Array(LINEAR_STEPS + 1);
for (let value = 0; value < SRGB_TO_LINEAR.length; value++) {
    const encoded = value / 255;
    SRGB_TO_LINEAR[value] = encoded <= 0.04045 ? encoded / 12.92 : Math.pow((encoded + 0.055) / 1.055, 2.4);
}
for (let step = 0; step <= LINEAR_STEPS; step++) {
    const linear = step / LINEAR_STEPS;
    const encoded = linear <= 0.0031308 ? linear * 12.92 : 1.055 * Math.pow(linear, 1 / 2.4) - 0.055;
    LINEAR_TO_SRGB[step] = Math.round(encoded * 255);
}
function averageEncoded(pixels: Uint8Array, a: number, b: number, c: number, d: number): number {
    return (pixels[a] + pixels[b] + pixels[c] + pixels[d] + 2) >> 2;
}
function averageLinearLight(pixels: Uint8Array, a: number, b: number, c: number, d: number): number {
    const linear = (SRGB_TO_LINEAR[pixels[a]] + SRGB_TO_LINEAR[pixels[b]] + SRGB_TO_LINEAR[pixels[c]] + SRGB_TO_LINEAR[pixels[d]]) * 0.25;
    return LINEAR_TO_SRGB[Math.round(linear * LINEAR_STEPS)];
}
export function downsampleLevel(source: PixelLevel, srgb: boolean): PixelLevel {
    const width = Math.max(1, source.width >> 1);
    const height = Math.max(1, source.height >> 1);
    const pixels = new Uint8Array(width * height * CHANNELS);
    const averageColor = srgb ? averageLinearLight : averageEncoded;
    const lastColumn = source.width - 1;
    const lastRow = source.height - 1;
    for (let y = 0; y < height; y++) {
        const upperRow = Math.min(y * 2, lastRow) * source.width;
        const lowerRow = Math.min(y * 2 + 1, lastRow) * source.width;
        for (let x = 0; x < width; x++) {
            const leftColumn = Math.min(x * 2, lastColumn);
            const rightColumn = Math.min(x * 2 + 1, lastColumn);
            const a = (upperRow + leftColumn) * CHANNELS;
            const b = (upperRow + rightColumn) * CHANNELS;
            const c = (lowerRow + leftColumn) * CHANNELS;
            const d = (lowerRow + rightColumn) * CHANNELS;
            const target = (y * width + x) * CHANNELS;
            for (let channel = 0; channel < ALPHA_CHANNEL; channel++)
                pixels[target + channel] = averageColor(source.pixels, a + channel, b + channel, c + channel, d + channel);
            pixels[target + ALPHA_CHANNEL] = averageEncoded(source.pixels, a + ALPHA_CHANNEL, b + ALPHA_CHANNEL, c + ALPHA_CHANNEL, d + ALPHA_CHANNEL);
        }
    }
    return { pixels, width, height };
}
