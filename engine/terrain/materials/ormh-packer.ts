import type { TextureImage } from '@/engine/core/scene/texture';
import { TERRAIN_DATA_TEXTURE_SIZE } from './terrain-material';
let scratchCanvas: HTMLCanvasElement | OffscreenCanvas | null = null;
function acquireCanvas(size: number): {
    canvas: HTMLCanvasElement | OffscreenCanvas;
    context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
} {
    if (!scratchCanvas)
        scratchCanvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(size, size) : document.createElement('canvas');
    scratchCanvas.width = size;
    scratchCanvas.height = size;
    const context = scratchCanvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    if (!context)
        throw new Error('Não foi possível obter um contexto 2D para reamostrar texturas.');
    return { canvas: scratchCanvas, context };
}
export function readImagePixels(image: TextureImage, size = TERRAIN_DATA_TEXTURE_SIZE): Uint8ClampedArray {
    const { context } = acquireCanvas(size);
    context.clearRect(0, 0, size, size);
    if (image instanceof ImageData) {
        if (image.width === size && image.height === size)
            return image.data;
        const native = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(image.width, image.height) : document.createElement('canvas');
        native.width = image.width;
        native.height = image.height;
        const nativeContext = native.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
        if (!nativeContext)
            throw new Error('Não foi possível obter um contexto 2D para reamostrar texturas.');
        nativeContext.putImageData(image, 0, 0);
        context.drawImage(native, 0, 0, size, size);
    }
    else {
        context.drawImage(image, 0, 0, size, size);
    }
    return context.getImageData(0, 0, size, size).data;
}
export interface OrmhSources {
    occlusion?: TextureImage | null;
    roughness?: TextureImage | null;
    height?: TextureImage | null;
    fallbackRoughness: number;
}
export function packOrmh(sources: OrmhSources, size = TERRAIN_DATA_TEXTURE_SIZE): ImageData {
    const occlusion = sources.occlusion ? readImagePixels(sources.occlusion, size) : null;
    const roughness = sources.roughness ? readImagePixels(sources.roughness, size) : null;
    const height = sources.height ? readImagePixels(sources.height, size) : null;
    const fallbackRoughness = Math.round(Math.min(Math.max(sources.fallbackRoughness, 0), 1) * 255);
    const out = new Uint8ClampedArray(size * size * 4);
    for (let i = 0; i < size * size; i++) {
        const pixel = i * 4;
        out[pixel] = occlusion ? occlusion[pixel] : 255;
        out[pixel + 1] = roughness ? roughness[pixel] : fallbackRoughness;
        out[pixel + 2] = height ? height[pixel] : 128;
        out[pixel + 3] = 255;
    }
    return new ImageData(out, size, size);
}
