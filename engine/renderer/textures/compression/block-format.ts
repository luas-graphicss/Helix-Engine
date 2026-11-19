export type BlockFormat = 'bc1' | 'bc3';
export const BLOCK_SIZE = 4;
export const BLOCK_PIXELS = BLOCK_SIZE * BLOCK_SIZE;
const COLOR_BLOCK_BYTES = 8;
export const ALPHA_BLOCK_BYTES = 8;
const BLOCK_BYTES: Record<BlockFormat, number> = { bc1: COLOR_BLOCK_BYTES, bc3: ALPHA_BLOCK_BYTES + COLOR_BLOCK_BYTES };
export function blockBytes(format: BlockFormat): number {
    return BLOCK_BYTES[format];
}
export function blockLevelBytes(format: BlockFormat, width: number, height: number): number {
    return Math.ceil(width / BLOCK_SIZE) * Math.ceil(height / BLOCK_SIZE) * BLOCK_BYTES[format];
}
