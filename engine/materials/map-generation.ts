import type { TextureImage } from '@/engine/core/scene/texture';
import { clamp } from '@/engine/core/math/scalar';
import { readImagePixelsFit, type PixelBuffer } from './map-packing';
export type PipelineResolution = 256 | 512 | 1024 | 2048;
export interface PipelineSettings {
    resolution: PipelineResolution;
    height: {
        enabled: boolean;
        invert: boolean;
        blur: number;
        contrast: number;
    };
    normal: {
        enabled: boolean;
        strength: number;
        flipY: boolean;
    };
    roughness: {
        enabled: boolean;
        invert: boolean;
        min: number;
        max: number;
        contrast: number;
    };
    occlusion: {
        enabled: boolean;
        strength: number;
        radius: number;
    };
}
export interface GeneratedMaps {
    height: ImageData | null;
    normal: ImageData | null;
    roughness: ImageData | null;
    occlusion: ImageData | null;
}
export function createPipelineSettings(overrides: Partial<PipelineSettings> = {}): PipelineSettings {
    return {
        resolution: 1024,
        height: { enabled: true, invert: false, blur: 1, contrast: 1.2 },
        normal: { enabled: true, strength: 1.5, flipY: false },
        roughness: { enabled: true, invert: false, min: 0.35, max: 0.95, contrast: 1 },
        occlusion: { enabled: true, strength: 0.6, radius: 6 },
        ...overrides,
    };
}
export function clonePipelineSettings(settings: PipelineSettings): PipelineSettings {
    return {
        resolution: settings.resolution,
        height: { ...settings.height },
        normal: { ...settings.normal },
        roughness: { ...settings.roughness },
        occlusion: { ...settings.occlusion },
    };
}
export function emptyGeneratedMaps(): GeneratedMaps {
    return { height: null, normal: null, roughness: null, occlusion: null };
}
function yieldToMain(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
}
function throwIfAborted(signal?: AbortSignal): void {
    if (signal?.aborted)
        throw new DOMException('Geração cancelada.', 'AbortError');
}
function luminance(pixels: PixelBuffer): Float32Array {
    const { data, width, height } = pixels;
    const out = new Float32Array(width * height);
    for (let i = 0, p = 0; i < out.length; i++, p += 4) {
        out[i] = (0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]) / 255;
    }
    return out;
}
function blurWrapped(values: Float32Array, width: number, height: number, radius: number): Float32Array {
    const r = Math.max(0, Math.round(radius));
    if (r === 0)
        return values;
    let source: Float32Array = values;
    let target: Float32Array = new Float32Array(values.length);
    const window = 2 * r + 1;
    for (let pass = 0; pass < 2; pass++) {
        for (let y = 0; y < height; y++) {
            const row = y * width;
            let sum = 0;
            for (let k = -r; k <= r; k++)
                sum += source[row + ((k + width) % width)];
            for (let x = 0; x < width; x++) {
                target[row + x] = sum / window;
                const leaving = source[row + ((x - r + width) % width)];
                const entering = source[row + ((x + r + 1) % width)];
                sum += entering - leaving;
            }
        }
        ;
        [source, target] = [target, source];
        for (let x = 0; x < width; x++) {
            let sum = 0;
            for (let k = -r; k <= r; k++)
                sum += source[((k + height) % height) * width + x];
            for (let y = 0; y < height; y++) {
                target[y * width + x] = sum / window;
                const leaving = source[((y - r + height) % height) * width + x];
                const entering = source[((y + r + 1) % height) * width + x];
                sum += entering - leaving;
            }
        }
        ;
        [source, target] = [target, source];
    }
    return source;
}
function normalizeContrast(values: Float32Array, contrast: number): Float32Array {
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (const v of values) {
        if (v < min)
            min = v;
        if (v > max)
            max = v;
    }
    const range = max - min;
    const out = new Float32Array(values.length);
    for (let i = 0; i < values.length; i++) {
        const normalized = range > 1e-6 ? (values[i] - min) / range : 0.5;
        out[i] = clamp((normalized - 0.5) * contrast + 0.5, 0, 1);
    }
    return out;
}
function grayToImageData(values: Float32Array, width: number, height: number): ImageData {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0, p = 0; i < values.length; i++, p += 4) {
        const byte = Math.round(clamp(values[i], 0, 1) * 255);
        data[p] = byte;
        data[p + 1] = byte;
        data[p + 2] = byte;
        data[p + 3] = 255;
    }
    return new ImageData(data, width, height);
}
function computeHeight(luma: Float32Array, width: number, height: number, settings: PipelineSettings['height']): Float32Array {
    let values = luma;
    if (settings.invert) {
        values = new Float32Array(luma.length);
        for (let i = 0; i < luma.length; i++)
            values[i] = 1 - luma[i];
    }
    values = blurWrapped(values, width, height, settings.blur);
    return normalizeContrast(values, settings.contrast);
}
function computeNormal(heightMap: Float32Array, width: number, height: number, settings: PipelineSettings['normal']): ImageData {
    const data = new Uint8ClampedArray(width * height * 4);
    const strength = settings.strength * (width / 256);
    const ySign = settings.flipY ? -1 : 1;
    for (let y = 0; y < height; y++) {
        const up = ((y - 1 + height) % height) * width;
        const row = y * width;
        const down = ((y + 1) % height) * width;
        for (let x = 0; x < width; x++) {
            const left = (x - 1 + width) % width;
            const right = (x + 1) % width;
            const dx = heightMap[up + right] + 2 * heightMap[row + right] + heightMap[down + right] - (heightMap[up + left] + 2 * heightMap[row + left] + heightMap[down + left]);
            const dy = heightMap[down + left] + 2 * heightMap[down + x] + heightMap[down + right] - (heightMap[up + left] + 2 * heightMap[up + x] + heightMap[up + right]);
            const nx = -dx * strength * 0.25;
            const ny = dy * strength * 0.25 * ySign;
            const inverseLength = 1 / Math.sqrt(nx * nx + ny * ny + 1);
            const p = (row + x) * 4;
            data[p] = Math.round((nx * inverseLength * 0.5 + 0.5) * 255);
            data[p + 1] = Math.round((ny * inverseLength * 0.5 + 0.5) * 255);
            data[p + 2] = Math.round((inverseLength * 0.5 + 0.5) * 255);
            data[p + 3] = 255;
        }
    }
    return new ImageData(data, width, height);
}
function computeRoughness(luma: Float32Array, settings: PipelineSettings['roughness']): Float32Array {
    const out = new Float32Array(luma.length);
    const low = Math.min(settings.min, settings.max);
    const high = Math.max(settings.min, settings.max);
    for (let i = 0; i < luma.length; i++) {
        const base = settings.invert ? 1 - luma[i] : luma[i];
        const contrasted = clamp((base - 0.5) * settings.contrast + 0.5, 0, 1);
        out[i] = low + (high - low) * contrasted;
    }
    return out;
}
function computeOcclusion(heightMap: Float32Array, width: number, height: number, settings: PipelineSettings['occlusion']): Float32Array {
    const out = new Float32Array(heightMap.length);
    const radius = Math.max(1, Math.round(settings.radius));
    const rings = [Math.max(1, Math.round(radius * 0.5)), radius];
    const directions = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [-1, -1],
        [1, -1],
        [-1, 1],
    ];
    const samples = rings.length * directions.length;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const center = heightMap[y * width + x];
            let shadow = 0;
            for (const ring of rings) {
                for (const [dx, dy] of directions) {
                    const sx = (x + dx * ring + width) % width;
                    const sy = (y + dy * ring + height) % height;
                    shadow += Math.max(0, heightMap[sy * width + sx] - center);
                }
            }
            out[y * width + x] = 1 - clamp((shadow / samples) * 4 * settings.strength, 0, 1);
        }
    }
    return out;
}
export async function generateMapsFromAlbedo(albedo: TextureImage, settings: PipelineSettings, signal?: AbortSignal): Promise<GeneratedMaps> {
    const pixels = readImagePixelsFit(albedo, settings.resolution);
    const { width, height } = pixels;
    const luma = luminance(pixels);
    const result = emptyGeneratedMaps();
    const needsHeight = settings.height.enabled || settings.normal.enabled || settings.occlusion.enabled;
    let heightMap: Float32Array | null = null;
    if (needsHeight) {
        await yieldToMain();
        throwIfAborted(signal);
        heightMap = computeHeight(luma, width, height, settings.height);
        if (settings.height.enabled)
            result.height = grayToImageData(heightMap, width, height);
    }
    if (settings.normal.enabled && heightMap) {
        await yieldToMain();
        throwIfAborted(signal);
        result.normal = computeNormal(heightMap, width, height, settings.normal);
    }
    if (settings.roughness.enabled) {
        await yieldToMain();
        throwIfAborted(signal);
        result.roughness = grayToImageData(computeRoughness(luma, settings.roughness), width, height);
    }
    if (settings.occlusion.enabled && heightMap) {
        await yieldToMain();
        throwIfAborted(signal);
        result.occlusion = grayToImageData(computeOcclusion(heightMap, width, height, settings.occlusion), width, height);
    }
    return result;
}
