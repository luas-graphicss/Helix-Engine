import 'server-only';
import { open } from 'node:fs/promises';
import path from 'node:path';
export interface ImageSize {
    readonly width: number;
    readonly height: number;
}
const HEADER_BYTES = 32;
const PUBLIC_ROOT = path.join(process.cwd(), 'public');
const sizes = new Map<string, Promise<ImageSize | null>>();
function fourcc(bytes: Uint8Array, offset: number): string {
    return String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
}
function uint24le(bytes: Uint8Array, offset: number): number {
    return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}
function uint16le(bytes: Uint8Array, offset: number): number {
    return bytes[offset] | (bytes[offset + 1] << 8);
}
function uint32be(bytes: Uint8Array, offset: number): number {
    return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}
function parsePng(bytes: Uint8Array): ImageSize | null {
    const signature = bytes[0] === 0x89 && fourcc(bytes, 1) === 'PNG';
    if (!signature || fourcc(bytes, 12) !== 'IHDR')
        return null;
    return { width: uint32be(bytes, 16), height: uint32be(bytes, 20) };
}
function parseWebp(bytes: Uint8Array): ImageSize | null {
    if (fourcc(bytes, 0) !== 'RIFF' || fourcc(bytes, 8) !== 'WEBP')
        return null;
    switch (fourcc(bytes, 12)) {
        case 'VP8X':
            return { width: uint24le(bytes, 24) + 1, height: uint24le(bytes, 27) + 1 };
        case 'VP8L': {
            const b0 = bytes[21];
            const b1 = bytes[22];
            const b2 = bytes[23];
            const b3 = bytes[24];
            return { width: 1 + (((b1 & 0x3f) << 8) | b0), height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)) };
        }
        case 'VP8 ':
            return { width: uint16le(bytes, 26) & 0x3fff, height: uint16le(bytes, 28) & 0x3fff };
        default:
            return null;
    }
}
async function readHeader(file: string): Promise<Uint8Array | null> {
    let handle;
    try {
        handle = await open(file, 'r');
        const buffer = new Uint8Array(HEADER_BYTES);
        const { bytesRead } = await handle.read(buffer, 0, HEADER_BYTES, 0);
        return bytesRead === HEADER_BYTES ? buffer : null;
    }
    catch (cause) {
        if ((cause as NodeJS.ErrnoException).code === 'ENOENT')
            return null;
        throw cause;
    }
    finally {
        await handle?.close();
    }
}
export function publicImageSize(src: string): Promise<ImageSize | null> {
    const cached = sizes.get(src);
    if (cached)
        return cached;
    const resolved = path.resolve(PUBLIC_ROOT, `.${src}`);
    const inside = resolved.startsWith(PUBLIC_ROOT + path.sep);
    const pending = inside
        ? readHeader(resolved).then((bytes) => (bytes ? (parseWebp(bytes) ?? parsePng(bytes)) : null))
        : Promise.resolve(null);
    sizes.set(src, pending);
    return pending;
}
