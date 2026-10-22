import type { TextureImage } from '@/engine/core/scene/texture';
export interface PixelBuffer {
    data: Uint8ClampedArray;
    width: number;
    height: number;
}
export const MAX_PACKED_SIZE = 2048;
let scratchCanvas: HTMLCanvasElement | OffscreenCanvas | null = null;
function getScratchContext(width: number, height: number): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D {
    if (!scratchCanvas) {
        scratchCanvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(width, height) : document.createElement('canvas');
    }
    if (scratchCanvas.width !== width || scratchCanvas.height !== height) {
        scratchCanvas.width = width;
        scratchCanvas.height = height;
    }
    const context = scratchCanvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    if (!context)
        throw new Error('Canvas 2D indisponível para ler pixels.');
    return context;
}
export function fitSize(width: number, height: number, maxSize: number): {
    width: number;
    height: number;
} {
    const largest = Math.max(width, height, 1);
    const scale = Math.min(1, maxSize / largest);
    return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
export function readImagePixelsFit(image: TextureImage, maxSize: number): PixelBuffer {
    if (image instanceof ImageData && Math.max(image.width, image.height) <= maxSize) {
        return { data: image.data, width: image.width, height: image.height };
    }
    const { width, height } = fitSize(image.width, image.height, maxSize);
    const context = getScratchContext(width, height);
    context.clearRect(0, 0, width, height);
    if (image instanceof ImageData) {
        const intermediate = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(image.width, image.height) : document.createElement('canvas');
        intermediate.width = image.width;
        intermediate.height = image.height;
        const intermediateContext = intermediate.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
        intermediateContext?.putImageData(image, 0, 0);
        context.drawImage(intermediate as CanvasImageSource, 0, 0, width, height);
    }
    else {
        context.drawImage(image as CanvasImageSource, 0, 0, width, height);
    }
    return { data: context.getImageData(0, 0, width, height).data, width, height };
}
export function readImagePixelsAt(image: TextureImage, width: number, height: number): Uint8ClampedArray {
    if (image instanceof ImageData && image.width === width && image.height === height)
        return image.data;
    const context = getScratchContext(width, height);
    context.clearRect(0, 0, width, height);
    if (image instanceof ImageData) {
        const intermediate = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(image.width, image.height) : document.createElement('canvas');
        intermediate.width = image.width;
        intermediate.height = image.height;
        const intermediateContext = intermediate.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
        intermediateContext?.putImageData(image, 0, 0);
        context.drawImage(intermediate as CanvasImageSource, 0, 0, width, height);
    }
    else {
        context.drawImage(image as CanvasImageSource, 0, 0, width, height);
    }
    return context.getImageData(0, 0, width, height).data;
}
export interface OrmSources {
    occlusion: TextureImage | null;
    roughness: TextureImage | null;
    metallic: TextureImage | null;
}
export function packOrm(sources: OrmSources): ImageData | null {
    const present = [sources.occlusion, sources.roughness, sources.metallic].filter((image): image is TextureImage => image !== null);
    if (present.length === 0)
        return null;
    const largest = present.reduce((best, image) => (image.width * image.height > best.width * best.height ? image : best));
    const { width, height } = fitSize(largest.width, largest.height, MAX_PACKED_SIZE);
    const occlusion = sources.occlusion ? readImagePixelsAt(sources.occlusion, width, height) : null;
    const roughness = sources.roughness ? readImagePixelsAt(sources.roughness, width, height) : null;
    const metallic = sources.metallic ? readImagePixelsAt(sources.metallic, width, height) : null;
    const out = new Uint8ClampedArray(width * height * 4);
    for (let p = 0; p < out.length; p += 4) {
        out[p] = occlusion ? occlusion[p] : 255;
        out[p + 1] = roughness ? roughness[p] : 255;
        out[p + 2] = metallic ? metallic[p] : 255;
        out[p + 3] = 255;
    }
    return new ImageData(out, width, height);
}
export function extractChannel(image: TextureImage, channel: 0 | 1 | 2 | 3): ImageData {
    const { data, width, height } = readImagePixelsFit(image, MAX_PACKED_SIZE);
    const out = new Uint8ClampedArray(width * height * 4);
    for (let p = 0; p < out.length; p += 4) {
        const value = data[p + channel];
        out[p] = value;
        out[p + 1] = value;
        out[p + 2] = value;
        out[p + 3] = 255;
    }
    return new ImageData(out, width, height);
}
export function averageLinearColor(image: TextureImage): [
    number,
    number,
    number
] {
    const { data } = readImagePixelsFit(image, 16);
    const sum = [0, 0, 0];
    for (let p = 0; p < data.length; p += 4) {
        for (let c = 0; c < 3; c++) {
            const srgb = data[p + c] / 255;
            sum[c] += srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
        }
    }
    const count = data.length / 4;
    return [sum[0] / count, sum[1] / count, sum[2] / count];
}
export async function encodeImageToBlob(image: TextureImage): Promise<Blob> {
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d');
    if (!context)
        throw new Error('Canvas 2D indisponível para codificar a imagem.');
    if (image instanceof ImageData)
        context.putImageData(image, 0, 0);
    else
        context.drawImage(image as CanvasImageSource, 0, 0);
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Falha ao codificar a imagem.'))), 'image/png');
    });
}
