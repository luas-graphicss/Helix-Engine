import type { PixelLevel } from '@/engine/renderer/textures/mips/pixel-level';
import { encodeColorBlock } from './bc1-color-block';
import { encodeAlphaBlock } from './bc3-alpha-block';
import { ALPHA_BLOCK_BYTES, BLOCK_PIXELS, BLOCK_SIZE, blockBytes, blockLevelBytes, type BlockFormat } from './block-format';
const CHANNELS = 4;
const ALPHA_CHANNEL = 3;
const OPAQUE = 255;
const block = new Uint8Array(BLOCK_PIXELS * CHANNELS);
function gatherBlock(level: PixelLevel, blockX: number, blockY: number): void {
    const { pixels, width, height } = level;
    for (let row = 0; row < BLOCK_SIZE; row++) {
        const sourceRow = Math.min(blockY * BLOCK_SIZE + row, height - 1) * width;
        for (let column = 0; column < BLOCK_SIZE; column++) {
            const source = (sourceRow + Math.min(blockX * BLOCK_SIZE + column, width - 1)) * CHANNELS;
            const target = (row * BLOCK_SIZE + column) * CHANNELS;
            block[target] = pixels[source];
            block[target + 1] = pixels[source + 1];
            block[target + 2] = pixels[source + 2];
            block[target + 3] = pixels[source + 3];
        }
    }
}
export function hasTranslucency(pixels: Uint8Array): boolean {
    for (let pixel = ALPHA_CHANNEL; pixel < pixels.length; pixel += CHANNELS) {
        if (pixels[pixel] !== OPAQUE)
            return true;
    }
    return false;
}
export function encodeBlocks(level: PixelLevel, format: BlockFormat): Uint8Array<ArrayBuffer> {
    const blocksWide = Math.ceil(level.width / BLOCK_SIZE);
    const blocksHigh = Math.ceil(level.height / BLOCK_SIZE);
    const stride = blockBytes(format);
    const encoded = new Uint8Array(blockLevelBytes(format, level.width, level.height));
    for (let blockY = 0; blockY < blocksHigh; blockY++) {
        for (let blockX = 0; blockX < blocksWide; blockX++) {
            const offset = (blockY * blocksWide + blockX) * stride;
            gatherBlock(level, blockX, blockY);
            if (format === 'bc1') {
                encodeColorBlock(block, encoded, offset);
                continue;
            }
            encodeAlphaBlock(block, encoded, offset);
            encodeColorBlock(block, encoded, offset + ALPHA_BLOCK_BYTES);
        }
    }
    return encoded;
}
