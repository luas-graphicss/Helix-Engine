import { BLOCK_PIXELS, BLOCK_SIZE } from './block-format';
const CHANNELS = 4;
const COLOR_CHANNELS = 3;
const BLOCK_BYTES = BLOCK_PIXELS * CHANNELS;
const PALETTE_COLORS = 4;
const FIRST_ENDPOINT_WEIGHTS = [1, 0, 2 / 3, 1 / 3];
const SINGULAR_FIT = 1e-6;
const first = new Float32Array(COLOR_CHANNELS);
const second = new Float32Array(COLOR_CHANNELS);
const palette = new Uint8Array(PALETTE_COLORS * COLOR_CHANNELS);
const indices = new Uint8Array(BLOCK_PIXELS);
function toRgb565(color: Float32Array): number {
    return (Math.round((color[0] * 31) / 255) << 11) | (Math.round((color[1] * 63) / 255) << 5) | Math.round((color[2] * 31) / 255);
}
function expandRgb565(color: number, offset: number): void {
    const red = color >> 11;
    const green = (color >> 5) & 63;
    const blue = color & 31;
    palette[offset] = (red << 3) | (red >> 2);
    palette[offset + 1] = (green << 2) | (green >> 4);
    palette[offset + 2] = (blue << 3) | (blue >> 2);
}
function measureRange(block: Uint8Array): number {
    first.fill(0);
    second.fill(255);
    for (let pixel = 0; pixel < BLOCK_BYTES; pixel += CHANNELS) {
        for (let channel = 0; channel < COLOR_CHANNELS; channel++) {
            const value = block[pixel + channel];
            if (value > first[channel])
                first[channel] = value;
            if (value < second[channel])
                second[channel] = value;
        }
    }
    let widest = 0;
    for (let channel = 1; channel < COLOR_CHANNELS; channel++) {
        if (first[channel] - second[channel] > first[widest] - second[widest])
            widest = channel;
    }
    return widest;
}
function alignDiagonal(block: Uint8Array, widest: number): void {
    const widestCenter = (first[widest] + second[widest]) / 2;
    for (let channel = 0; channel < COLOR_CHANNELS; channel++) {
        if (channel === widest)
            continue;
        const center = (first[channel] + second[channel]) / 2;
        let covariance = 0;
        for (let pixel = 0; pixel < BLOCK_BYTES; pixel += CHANNELS)
            covariance += (block[pixel + widest] - widestCenter) * (block[pixel + channel] - center);
        if (covariance >= 0)
            continue;
        const swapped = first[channel];
        first[channel] = second[channel];
        second[channel] = swapped;
    }
}
function buildPalette(high: number, low: number): void {
    expandRgb565(high, 0);
    expandRgb565(low, COLOR_CHANNELS);
    for (let channel = 0; channel < COLOR_CHANNELS; channel++) {
        const a = palette[channel];
        const b = palette[COLOR_CHANNELS + channel];
        palette[2 * COLOR_CHANNELS + channel] = Math.round((2 * a + b) / 3);
        palette[3 * COLOR_CHANNELS + channel] = Math.round((a + 2 * b) / 3);
    }
}
function assignIndices(block: Uint8Array): void {
    for (let pixel = 0; pixel < BLOCK_PIXELS; pixel++) {
        const source = pixel * CHANNELS;
        let nearest = 0;
        let nearestDistance = Infinity;
        for (let index = 0; index < PALETTE_COLORS; index++) {
            const entry = index * COLOR_CHANNELS;
            const red = block[source] - palette[entry];
            const green = block[source + 1] - palette[entry + 1];
            const blue = block[source + 2] - palette[entry + 2];
            const distance = red * red + green * green + blue * blue;
            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearest = index;
            }
        }
        indices[pixel] = nearest;
    }
}
function fitEndpointsToIndices(block: Uint8Array): boolean {
    let firstSquared = 0;
    let secondSquared = 0;
    let mixed = 0;
    for (let pixel = 0; pixel < BLOCK_PIXELS; pixel++) {
        const weight = FIRST_ENDPOINT_WEIGHTS[indices[pixel]];
        firstSquared += weight * weight;
        secondSquared += (1 - weight) * (1 - weight);
        mixed += weight * (1 - weight);
    }
    const determinant = firstSquared * secondSquared - mixed * mixed;
    if (Math.abs(determinant) < SINGULAR_FIT)
        return false;
    for (let channel = 0; channel < COLOR_CHANNELS; channel++) {
        let towardFirst = 0;
        let towardSecond = 0;
        for (let pixel = 0; pixel < BLOCK_PIXELS; pixel++) {
            const weight = FIRST_ENDPOINT_WEIGHTS[indices[pixel]];
            const value = block[pixel * CHANNELS + channel];
            towardFirst += weight * value;
            towardSecond += (1 - weight) * value;
        }
        first[channel] = Math.min(255, Math.max(0, (secondSquared * towardFirst - mixed * towardSecond) / determinant));
        second[channel] = Math.min(255, Math.max(0, (firstSquared * towardSecond - mixed * towardFirst) / determinant));
    }
    return true;
}
function writeEndpoints(out: Uint8Array, offset: number, high: number, low: number): void {
    out[offset] = high & 0xff;
    out[offset + 1] = high >> 8;
    out[offset + 2] = low & 0xff;
    out[offset + 3] = low >> 8;
}
function writeIndices(out: Uint8Array, offset: number): void {
    for (let row = 0; row < BLOCK_SIZE; row++) {
        let bits = 0;
        for (let column = 0; column < BLOCK_SIZE; column++)
            bits |= indices[row * BLOCK_SIZE + column] << (column * 2);
        out[offset + row] = bits;
    }
}
export function encodeColorBlock(block: Uint8Array, out: Uint8Array, offset: number): void {
    alignDiagonal(block, measureRange(block));
    let high = Math.max(toRgb565(first), toRgb565(second));
    let low = Math.min(toRgb565(first), toRgb565(second));
    if (high === low) {
        writeEndpoints(out, offset, high, low);
        out.fill(0, offset + 4, offset + 8);
        return;
    }
    buildPalette(high, low);
    assignIndices(block);
    if (fitEndpointsToIndices(block)) {
        const fittedHigh = Math.max(toRgb565(first), toRgb565(second));
        const fittedLow = Math.min(toRgb565(first), toRgb565(second));
        if (fittedHigh !== fittedLow) {
            high = fittedHigh;
            low = fittedLow;
            buildPalette(high, low);
            assignIndices(block);
        }
    }
    writeEndpoints(out, offset, high, low);
    writeIndices(out, offset + 4);
}
