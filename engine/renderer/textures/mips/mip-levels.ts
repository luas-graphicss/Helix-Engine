const RGBA_BYTES_PER_PIXEL = 4;
export function mipLevelCount(width: number, height: number): number {
    return Math.floor(Math.log2(Math.max(width, height, 1))) + 1;
}
export function mipLevelSize(size: number, level: number): number {
    return Math.max(1, size >> level);
}
export function isPowerOfTwo(size: number): boolean {
    return size > 0 && (size & (size - 1)) === 0;
}
export function rgbaLevelBytes(width: number, height: number): number {
    return width * height * RGBA_BYTES_PER_PIXEL;
}
export function mipChainBytes(width: number, height: number, topLevel: number, levelBytes: (width: number, height: number) => number): number {
    const levels = mipLevelCount(width, height);
    let bytes = 0;
    for (let level = topLevel; level < levels; level++)
        bytes += levelBytes(mipLevelSize(width, level), mipLevelSize(height, level));
    return bytes;
}
