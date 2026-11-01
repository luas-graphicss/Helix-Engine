import { guiOffsetScale, hasGuiInsets, resolveUDim, type GuiDocument, type GuiFontFamily, type GuiInsets, type GuiNode, type GuiPoint, type GuiTextStyle } from '@/engine/gui/document/gui-document';
import { orderedGuiChildren } from '@/engine/gui/document/gui-tree';
import type { GuiTextLayout, GuiTextMeasurer } from '@/engine/gui/text/gui-text-measure';
import { GUI_IDENTITY, matrixRotate, matrixTranslate, type GuiMatrix } from './gui-matrix';
export interface GuiBox {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
}
export interface GuiLayoutEntry {
    readonly node: GuiNode;
    readonly parentId: string | null;
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly world: GuiMatrix;
    readonly depth: number;
    readonly clipChain: readonly string[];
    readonly textLayout: GuiTextLayout | null;
    readonly textBox: GuiBox | null;
    readonly canvasSize: GuiPoint | null;
}
export interface GuiLayoutResult {
    readonly document: GuiDocument;
    readonly entries: ReadonlyMap<string, GuiLayoutEntry>;
    readonly order: readonly GuiLayoutEntry[];
    readonly viewport: GuiPoint;
    readonly offsetScale: number;
}
export interface GuiLayoutContext {
    readonly measurer: GuiTextMeasurer;
    readonly cssFamily: (family: GuiFontFamily) => string;
    readonly scrollOffsets?: ReadonlyMap<string, GuiPoint>;
    readonly safeArea?: GuiInsets;
}
interface Frame {
    readonly width: number;
    readonly height: number;
}
interface SafeFrame {
    readonly x: number;
    readonly y: number;
    readonly frame: Frame;
}
interface Measured {
    width: number;
    height: number;
    textLayout: GuiTextLayout | null;
    textBox: GuiBox | null;
}
export function scaledTextStyle(style: GuiTextStyle, scale: number): GuiTextStyle {
    return scale === 1 ? style : { ...style, size: style.size * scale, letterSpacing: style.letterSpacing * scale };
}
function textPadding(node: GuiNode): GuiPoint {
    switch (node.kind) {
        case 'button':
            return { x: 16, y: 8 };
        case 'input':
            return { x: 12, y: 6 };
        default:
            return { x: 0, y: 0 };
    }
}
export function guiTextBox(node: GuiNode, width: number, height: number, offsetScale: number): GuiBox {
    const padding = textPadding(node);
    let x = padding.x * offsetScale;
    let y = padding.y * offsetScale;
    let w = Math.max(0, width - 2 * x);
    let h = Math.max(0, height - 2 * y);
    if (node.kind === 'button' && node.control?.kind === 'button' && node.control.iconName && node.control.iconPosition !== 'only') {
        const icon = node.control.iconSize * offsetScale;
        const gap = node.control.iconGap * offsetScale;
        if (node.control.iconPosition === 'left') {
            x += icon + gap;
            w = Math.max(0, w - icon - gap);
        }
        else if (node.control.iconPosition === 'right') {
            w = Math.max(0, w - icon - gap);
        }
        else {
            y += icon + gap;
            h = Math.max(0, h - icon - gap);
        }
    }
    return { x, y, width: w, height: h };
}
function hasText(node: GuiNode): boolean {
    if (!node.text)
        return false;
    if (node.kind === 'button' && node.control?.kind === 'button' && node.control.iconPosition === 'only')
        return false;
    return node.kind === 'text' || node.kind === 'button' || node.kind === 'input' || node.kind === 'progress';
}
