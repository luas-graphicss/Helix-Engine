import type { Texture, TextureImage } from '@/engine/core/scene/texture';
interface BakedImage {
    version: number;
    blob: Promise<Blob | null>;
}
const bakedImages = new WeakMap<Texture, BakedImage>();
function createCanvas(width: number, height: number): OffscreenCanvas | HTMLCanvasElement {
    if (typeof OffscreenCanvas !== 'undefined')
        return new OffscreenCanvas(width, height);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
}
type Canvas2dContext = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
function createCpuContext(width: number, height: number): {
    canvas: OffscreenCanvas | HTMLCanvasElement;
    context: Canvas2dContext;
} | null {
    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d', { willReadFrequently: true }) as Canvas2dContext | null;
    return context ? { canvas, context } : null;
}
function canvasToBlob(canvas: OffscreenCanvas | HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
    if (canvas instanceof HTMLCanvasElement) {
        return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
    }
    return canvas.convertToBlob({ type, quality }).catch(() => null);
}
export async function encodeTextureImage(image: TextureImage): Promise<Blob | null> {
    const { width, height } = image;
    if (width <= 0 || height <= 0)
        return null;
    const target = createCpuContext(width, height);
    if (!target)
        return null;
    if (image instanceof ImageData)
        target.context.putImageData(image, 0, 0);
    else
        target.context.drawImage(image, 0, 0);
    return canvasToBlob(target.canvas, 'image/png');
}
export function bakeTexture(texture: Texture): Promise<Blob | null> {
    if (!texture.image || texture.dynamic)
        return Promise.resolve(null);
    const cached = bakedImages.get(texture);
    if (cached && cached.version === texture.version)
        return cached.blob;
    const blob = encodeTextureImage(texture.image).catch(() => null);
    bakedImages.set(texture, { version: texture.version, blob });
    return blob;
}
interface ImageDecoderLike {
    decode(options?: {
        frameIndex?: number;
        completeFramesOnly?: boolean;
    }): Promise<{
        image: VideoFrame;
    }>;
    close(): void;
}
interface ImageDecoderConstructor {
    new (init: {
        data: ArrayBuffer;
        type: string;
        premultiplyAlpha?: 'none' | 'premultiply' | 'default';
        colorSpaceConversion?: 'none' | 'default';
    }): ImageDecoderLike;
    isTypeSupported(type: string): Promise<boolean>;
}
const PACKED_RGB_FORMATS = new Set<string>(['RGBA', 'RGBX', 'BGRA', 'BGRX']);
async function videoFrameToImageData(frame: VideoFrame): Promise<ImageData | null> {
    const { format, visibleRect } = frame;
    const width = visibleRect?.width ?? frame.displayWidth;
    const height = visibleRect?.height ?? frame.displayHeight;
    if (!format || !PACKED_RGB_FORMATS.has(format) || width <= 0 || height <= 0)
        return null;
    const packed = new Uint8Array(frame.allocationSize());
    const [layout] = await frame.copyTo(packed);
    const rowBytes = width * 4;
    const stride = layout?.stride ?? rowBytes;
    const offset = layout?.offset ?? 0;
    const pixels = new Uint8ClampedArray(rowBytes * height);
    for (let y = 0; y < height; y++) {
        const start = offset + y * stride;
        pixels.set(packed.subarray(start, start + rowBytes), y * rowBytes);
    }
    if (format === 'BGRA' || format === 'BGRX') {
        for (let i = 0; i < pixels.length; i += 4) {
            const blue = pixels[i];
            pixels[i] = pixels[i + 2];
            pixels[i + 2] = blue;
        }
    }
    if (format === 'RGBX' || format === 'BGRX') {
        for (let i = 3; i < pixels.length; i += 4)
            pixels[i] = 255;
    }
    return new ImageData(pixels, width, height);
}
async function decodePixels(blob: Blob): Promise<ImageData | null> {
    const Decoder = (globalThis as {
        ImageDecoder?: ImageDecoderConstructor;
    }).ImageDecoder;
    if (!Decoder)
        return null;
    const type = blob.type || 'image/png';
    try {
        if (!(await Decoder.isTypeSupported(type)))
            return null;
        const decoder = new Decoder({ data: await blob.arrayBuffer(), type, premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
        try {
            const { image } = await decoder.decode({ frameIndex: 0, completeFramesOnly: true });
            try {
                return await videoFrameToImageData(image);
            }
            finally {
                image.close();
            }
        }
        finally {
            decoder.close();
        }
    }
    catch {
        return null;
    }
}
export async function decodeTextureImage(blob: Blob): Promise<TextureImage> {
    const pixels = await decodePixels(blob);
    if (pixels)
        return pixels;
    return createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
}
function flipRows(pixels: Uint8ClampedArray, width: number, height: number): void {
    const stride = width * 4;
    const row = new Uint8ClampedArray(stride);
    for (let top = 0, bottom = height - 1; top < bottom; top++, bottom--) {
        const a = top * stride;
        const b = bottom * stride;
        row.set(pixels.subarray(a, a + stride));
        pixels.copyWithin(a, b, b + stride);
        pixels.set(row, b);
    }
}
export interface CapturedFrameSource {
    framebuffer: WebGLFramebuffer;
    width: number;
    height: number;
}
export async function captureFrameThumbnail(gl: WebGL2RenderingContext, source: CapturedFrameSource, width: number): Promise<Blob | null> {
    const sourceWidth = source.width;
    const sourceHeight = source.height;
    if (sourceWidth <= 0 || sourceHeight <= 0)
        return null;
    const pixels = new Uint8ClampedArray(sourceWidth * sourceHeight * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, source.framebuffer);
    gl.readPixels(0, 0, sourceWidth, sourceHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    flipRows(pixels, sourceWidth, sourceHeight);
    for (let i = 3; i < pixels.length; i += 4)
        pixels[i] = 255;
    const height = Math.max(1, Math.round((sourceHeight / sourceWidth) * width));
    const bitmap = await createImageBitmap(new ImageData(pixels, sourceWidth, sourceHeight), { resizeWidth: width, resizeHeight: height, resizeQuality: 'high' });
    try {
        const canvas = createCanvas(width, height);
        const context = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;
        if (!context)
            return null;
        context.drawImage(bitmap, 0, 0, width, height);
        return canvasToBlob(canvas, 'image/jpeg', 0.82);
    }
    finally {
        bitmap.close();
    }
}
