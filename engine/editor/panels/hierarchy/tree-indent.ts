export const INDENT = 14;
export const MIN_INDENT = 4;
export const BASE_PADDING = 6;
const CHEVRON_CENTER = 8;
export const MIN_ROW_CONTENT = 136;
const COMPACT_ROW_CONTENT = 176;
export interface TreeIndent {
    readonly step: number;
    readonly width: number;
}
export function computeTreeIndent(width: number, maxDepth: number): TreeIndent {
    if (width <= 0 || maxDepth <= 0)
        return { step: INDENT, width };
    const available = width - BASE_PADDING - MIN_ROW_CONTENT;
    const step = Math.floor(available / maxDepth);
    return { step: Math.min(INDENT, Math.max(MIN_INDENT, step)), width };
}
export interface RowLayout {
    readonly paddingLeft: number;
    readonly compact: boolean;
    readonly guideLeft: number;
    readonly guideWidth: number;
}
export function rowLayout(indent: TreeIndent, depth: number): RowLayout {
    const natural = BASE_PADDING + depth * indent.step;
    const limit = indent.width > 0 ? Math.max(BASE_PADDING, indent.width - MIN_ROW_CONTENT) : natural;
    const paddingLeft = Math.min(natural, limit);
    return {
        paddingLeft,
        compact: indent.width > 0 && indent.width - paddingLeft < COMPACT_ROW_CONTENT,
        guideLeft: BASE_PADDING + CHEVRON_CENTER + indent.step,
        guideWidth: Math.max(0, paddingLeft - BASE_PADDING - indent.step),
    };
}
export function indentGuideImage(step: number): string {
    return `repeating-linear-gradient(to right, var(--border-strong) 0 1px, transparent 1px ${step}px)`;
}
