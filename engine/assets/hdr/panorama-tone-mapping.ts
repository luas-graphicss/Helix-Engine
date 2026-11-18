import { clamp } from '@/engine/core/math/scalar';
import { radianceScale, type RadianceImage } from './radiance-hdr';
export interface DisplayImage {
    readonly width: number;
    readonly height: number;
    readonly pixels: Uint8ClampedArray;
}
const CHANNELS = 4;
const LUMINANCE_RED = 0.2126;
const LUMINANCE_GREEN = 0.7152;
const LUMINANCE_BLUE = 0.0722;
const LUMINANCE_FLOOR = 1e-4;
const MIDDLE_GRAY = 0.18;
const MIN_EXPOSURE = 1 / 64;
const MAX_EXPOSURE = 64;
const EXPOSURE_SAMPLES = 200000;
const ENCODE_STEPS = 4096;
const OPAQUE = 255;
const SRGB_ENCODE: Uint8Array = createSrgbEncodeTable();
function createSrgbEncodeTable(): Uint8Array {
    const table = new Uint8Array(ENCODE_STEPS + 1);
    for (let step = 0; step <= ENCODE_STEPS; step++) {
        const linear = step / ENCODE_STEPS;
        const encoded = linear <= 0.0031308 ? linear * 12.92 : 1.055 * linear ** (1 / 2.4) - 0.055;
        table[step] = Math.round(encoded * OPAQUE);
    }
    return table;
}
function filmicCurve(value: number): number {
    return clamp((value * (2.51 * value + 0.03)) / (value * (2.43 * value + 0.59) + 0.14), 0, 1);
}
export function measureExposure({ width, height, rgbe }: RadianceImage): number {
    const pixelCount = width * height;
    const stride = Math.max(1, Math.floor(pixelCount / EXPOSURE_SAMPLES));
    let logSum = 0;
    let samples = 0;
    for (let pixel = 0; pixel < pixelCount; pixel += stride) {
        const offset = pixel * CHANNELS;
        const scale = radianceScale(rgbe[offset + 3]);
        const luminance = (rgbe[offset] * LUMINANCE_RED + rgbe[offset + 1] * LUMINANCE_GREEN + rgbe[offset + 2] * LUMINANCE_BLUE) * scale;
        logSum += Math.log(luminance + LUMINANCE_FLOOR);
        samples++;
    }
    return clamp(MIDDLE_GRAY / Math.exp(logSum / samples), MIN_EXPOSURE, MAX_EXPOSURE);
}
export function toneMapRadiance(image: RadianceImage, exposure = measureExposure(image)): DisplayImage {
    const { width, height, rgbe } = image;
    const pixels = new Uint8ClampedArray(rgbe.length);
    for (let offset = 0; offset < rgbe.length; offset += CHANNELS) {
        const scale = radianceScale(rgbe[offset + 3]) * exposure;
        for (let channel = 0; channel < 3; channel++)
            pixels[offset + channel] = SRGB_ENCODE[Math.round(filmicCurve(rgbe[offset + channel] * scale) * ENCODE_STEPS)];
        pixels[offset + 3] = OPAQUE;
    }
    return { width, height, pixels };
}
