import { downsampleLevel } from '@/engine/renderer/textures/mips/mip-downsampler';
import { isPowerOfTwo, mipLevelCount } from '@/engine/renderer/textures/mips/mip-levels';
import type { PixelLevel } from '@/engine/renderer/textures/mips/pixel-level';
import { encodeBlocks, hasTranslucency } from './block-encoder';
import { BLOCK_SIZE, type BlockFormat } from './block-format';
export interface CompressedMipChain {
    readonly format: BlockFormat;
    readonly width: number;
    readonly height: number;
    readonly levels: readonly Uint8Array<ArrayBuffer>[];
}
export function canBlockCompress(width: number, height: number): boolean {
    return isPowerOfTwo(width) && isPowerOfTwo(height) && width >= BLOCK_SIZE && height >= BLOCK_SIZE;
}
export function compressMipChain(base: PixelLevel, srgb: boolean): CompressedMipChain {
    const format: BlockFormat = hasTranslucency(base.pixels) ? 'bc3' : 'bc1';
    const levelCount = mipLevelCount(base.width, base.height);
    const levels: Uint8Array<ArrayBuffer>[] = [];
    let level = base;
    for (let index = 0; index < levelCount; index++) {
        if (index > 0)
            level = downsampleLevel(level, srgb);
        levels.push(encodeBlocks(level, format));
    }
    return { format, width: base.width, height: base.height, levels };
}
