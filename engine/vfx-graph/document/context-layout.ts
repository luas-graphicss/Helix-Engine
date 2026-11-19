import type { EffectContext } from './effect-document';
export const CONTEXT_WIDTH = 248;
export const CONTEXT_HEADER_HEIGHT = 28;
export const BLOCK_ROW_HEIGHT = 24;
export const CONTEXT_FOOTER_HEIGHT = 26;
export const CONTEXT_GAP = 44;
export const SYSTEM_GAP = 56;
export function contextHeight(context: EffectContext): number {
    return CONTEXT_HEADER_HEIGHT + context.blocks.length * BLOCK_ROW_HEIGHT + CONTEXT_FOOTER_HEIGHT;
}
