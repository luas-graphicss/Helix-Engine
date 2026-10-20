import type { TextureImage } from '@/engine/core/scene/texture';
export type ImageSource = Blob | ArrayBuffer | ArrayBufferView;
export function sniffImageMimeType(bytes: Uint8Array): string | null {
    if (bytes.length < 12)
        return null;
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)
        return 'image/png';
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
        return 'image/jpeg';
    if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45)
        return 'image/webp';
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46)
        return 'image/gif';
    if (bytes[0] === 0x42 && bytes[1] === 0x4d)
        return 'image/bmp';
    if (bytes[0] === 0xab && bytes[1] === 0x4b && bytes[2] === 0x54 && bytes[3] === 0x58)
        return 'image/ktx2';
    return null;
}
export function mimeTypeFromFileName(fileName: string): string | null {
    const extension = fileName.split('.').pop()?.toLowerCase();
    switch (extension) {
        case 'png':
            return 'image/png';
        case 'jpg':
        case 'jpeg':
            return 'image/jpeg';
        case 'webp':
            return 'image/webp';
        case 'gif':
            return 'image/gif';
        case 'bmp':
            return 'image/bmp';
        case 'tga':
            return 'image/x-tga';
        case 'tif':
        case 'tiff':
            return 'image/tiff';
        default:
            return null;
    }
}
function toBlob(source: ImageSource, mimeType: string | null): Blob {
    if (source instanceof Blob)
        return source;
    const bytes = source instanceof ArrayBuffer ? new Uint8Array(source) : new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
    const type = mimeType ?? sniffImageMimeType(bytes) ?? 'application/octet-stream';
    return new Blob([bytes], { type });
}
function decodeWithImageElement(blob: Blob): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(blob);
        const image = new Image();
        image.onload = () => {
            URL.revokeObjectURL(url);
            resolve(image);
        };
        image.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('O navegador não conseguiu decodificar a imagem.'));
        };
        image.src = url;
    });
}
export async function decodeImage(source: ImageSource, mimeType: string | null = null): Promise<TextureImage> {
    const blob = toBlob(source, mimeType);
    if (typeof createImageBitmap === 'function') {
        try {
            return await createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none', imageOrientation: 'none' });
        }
        catch {
        }
    }
    return decodeWithImageElement(blob);
}
export async function decodeImageFromUri(uri: string): Promise<TextureImage> {
    const response = await fetch(uri);
    if (!response.ok)
        throw new Error(`Falha ao carregar a imagem (${response.status}).`);
    return decodeImage(await response.blob());
}
