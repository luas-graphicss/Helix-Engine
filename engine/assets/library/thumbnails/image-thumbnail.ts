import type { TextureImage } from '@/engine/core/scene/texture';
export const THUMBNAIL_SIZE = 192;
const WEBP_QUALITY = 0.86;
export function encodeCanvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob((webp) => {
            if (webp && webp.type === 'image/webp')
                return resolve(webp);
            canvas.toBlob((png) => (png ? resolve(png) : reject(new Error('Falha ao codificar a miniatura.'))), 'image/png');
        }, 'image/webp', WEBP_QUALITY);
    });
}
function drawSource(context: CanvasRenderingContext2D, image: TextureImage, sx: number, sy: number, sw: number, sh: number, size: number): void {
    if (image instanceof ImageData) {
        const scratch = document.createElement('canvas');
        scratch.width = image.width;
        scratch.height = image.height;
        scratch.getContext('2d')?.putImageData(image, 0, 0);
        context.drawImage(scratch, sx, sy, sw, sh, 0, 0, size, size);
    }
    else {
        context.drawImage(image, sx, sy, sw, sh, 0, 0, size, size);
    }
}
export async function renderImageThumbnail(image: TextureImage, size = THUMBNAIL_SIZE): Promise<Blob> {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    if (!context)
        throw new Error('Canvas 2D indisponível para gerar a miniatura.');
    const side = Math.min(image.width, image.height);
    const sx = (image.width - side) / 2;
    const sy = (image.height - side) / 2;
    context.imageSmoothingQuality = 'high';
    drawSource(context, image, sx, sy, side, side, size);
    return encodeCanvasToBlob(canvas);
}
export async function renderPixelsThumbnail(pixels: Uint8Array, width: number, height: number, size = THUMBNAIL_SIZE): Promise<Blob> {
    const flipped = new Uint8ClampedArray(pixels.length);
    const rowBytes = width * 4;
    for (let row = 0; row < height; row++) {
        const source = (height - 1 - row) * rowBytes;
        flipped.set(pixels.subarray(source, source + rowBytes), row * rowBytes);
    }
    return renderImageThumbnail(new ImageData(flipped, width, height), size);
}
