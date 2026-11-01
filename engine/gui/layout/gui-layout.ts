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
class Solver {
    private readonly entries = new Map<string, GuiLayoutEntry>();
    private readonly order: GuiLayoutEntry[] = [];
    private viewport: GuiPoint = { x: 0, y: 0 };
    constructor(private readonly context: GuiLayoutContext, private readonly offsetScale: number) { }
    run(document: GuiDocument, viewport: GuiPoint): GuiLayoutResult {
        this.viewport = viewport;
        this.place(document.root, { width: viewport.x, height: viewport.y }, GUI_IDENTITY, null, 0, [], null, null);
        return { document, entries: this.entries, order: this.order, viewport, offsetScale: this.offsetScale };
    }
    private safeFrame(node: GuiNode, parent: Frame, parentWorld: GuiMatrix): SafeFrame | null {
        const insets = this.context.safeArea;
        if (!node.rect.safeArea || !insets || !hasGuiInsets(insets))
            return null;
        const [, b, c, , originX, originY] = parentWorld;
        if (Math.abs(b) > 1e-6 || Math.abs(c) > 1e-6)
            return null;
        const left = Math.max(originX, insets.left);
        const top = Math.max(originY, insets.top);
        const right = Math.min(originX + parent.width, this.viewport.x - insets.right);
        const bottom = Math.min(originY + parent.height, this.viewport.y - insets.bottom);
        if (right <= left || bottom <= top)
            return null;
        return { x: left - originX, y: top - originY, frame: { width: right - left, height: bottom - top } };
    }
    private resolveSize(node: GuiNode, parent: Frame): GuiPoint {
        return { x: resolveUDim(node.rect.size.x, parent.width, this.offsetScale), y: resolveUDim(node.rect.size.y, parent.height, this.offsetScale) };
    }
    private clamp(node: GuiNode, width: number, height: number): GuiPoint {
        const s = this.offsetScale;
        const { minSize, maxSize } = node.rect;
        let w = Math.max(minSize.x * s, width);
        let h = Math.max(minSize.y * s, height);
        if (maxSize) {
            if (maxSize.x > 0)
                w = Math.min(maxSize.x * s, w);
            if (maxSize.y > 0)
                h = Math.min(maxSize.y * s, h);
        }
        return { x: Math.max(0, w), y: Math.max(0, h) };
    }
    private measure(node: GuiNode, parent: Frame, assigned: Partial<GuiPoint>): Measured {
        const base = this.resolveSize(node, parent);
        let width = assigned.x ?? base.x;
        let height = assigned.y ?? base.y;
        let textLayout: GuiTextLayout | null = null;
        let textBox: GuiBox | null = null;
        const auto = node.rect.autoSize;
        const autoX = (auto === 'x' || auto === 'xy') && assigned.x === undefined;
        const autoY = (auto === 'y' || auto === 'xy') && assigned.y === undefined;
        if (hasText(node) && node.text) {
            const style = scaledTextStyle(node.text, this.offsetScale);
            const box = guiTextBox(node, width, height, this.offsetScale);
            const maxWidth = autoX ? null : box.width;
            const maxHeight = autoY ? null : box.height;
            textLayout = this.context.measurer.layout(style, this.context.cssFamily(style.family), style.wrap ? maxWidth : null, maxHeight);
            const padX = width - box.width;
            const padY = height - box.height;
            if (autoX)
                width = Math.ceil(textLayout.width) + padX;
            if (autoY)
                height = Math.ceil(textLayout.height) + padY;
            if (node.kind === 'button' && node.control?.kind === 'button' && node.control.iconName && node.control.iconPosition === 'top' && autoY) {
                height = Math.max(height, Math.ceil(textLayout.height) + padY);
            }
        }
        else if (node.kind === 'icon' && (autoX || autoY)) {
            const side = Math.max(autoX ? height : width, 16 * this.offsetScale);
            if (autoX)
                width = side;
            if (autoY)
                height = side;
        }
        if (node.rect.aspectRatio && !(autoX && autoY)) {
            if (autoX || (!autoY && assigned.y !== undefined && assigned.x === undefined))
                width = height * node.rect.aspectRatio;
            else
                height = width / node.rect.aspectRatio;
        }
        const clamped = this.clamp(node, width, height);
        width = clamped.x;
        height = clamped.y;
        if (textLayout && node.text) {
            textBox = guiTextBox(node, width, height, this.offsetScale);
            const style = scaledTextStyle(node.text, this.offsetScale);
            if (!autoX)
                textLayout = this.context.measurer.layout(style, this.context.cssFamily(style.family), style.wrap ? textBox.width : null, autoY ? null : textBox.height);
        }
        return { width, height, textLayout, textBox };
    }
    private place(node: GuiNode, parent: Frame, parentWorld: GuiMatrix, parentId: string | null, depth: number, clipChain: readonly string[], assignedPosition: GuiPoint | null, assignedSize: Partial<GuiPoint> | null): GuiLayoutEntry {
        const safe = assignedPosition ? null : this.safeFrame(node, parent, parentWorld);
        const frame = safe?.frame ?? parent;
        const measured = this.measure(node, frame, assignedSize ?? {});
        const children = orderedGuiChildren(node).filter((child) => child.visible);
        const auto = node.rect.autoSize;
        const autoX = (auto === 'x' || auto === 'xy') && !hasText(node) && node.kind !== 'icon' && assignedSize?.x === undefined;
        const autoY = (auto === 'y' || auto === 'xy') && !hasText(node) && node.kind !== 'icon' && assignedSize?.y === undefined;
        if ((autoX || autoY) && children.length > 0) {
            const content = this.contentExtent(node, children, measured);
            const clamped = this.clamp(node, autoX ? content.x : measured.width, autoY ? content.y : measured.height);
            measured.width = clamped.x;
            measured.height = clamped.y;
        }
        const { width, height } = measured;
        const anchorX = node.rect.anchor.x * width;
        const anchorY = node.rect.anchor.y * height;
        const x = assignedPosition ? assignedPosition.x : (safe?.x ?? 0) + resolveUDim(node.rect.position.x, frame.width, this.offsetScale) - anchorX;
        const y = assignedPosition ? assignedPosition.y : (safe?.y ?? 0) + resolveUDim(node.rect.position.y, frame.height, this.offsetScale) - anchorY;
        let world = matrixTranslate(parentWorld, x + anchorX, y + anchorY);
        world = matrixRotate(world, node.rect.rotation);
        world = matrixTranslate(world, -anchorX, -anchorY);
        const clips = node.clipsContent || node.kind === 'scroll';
        const ownChain = clips ? [...clipChain, node.id] : clipChain;
        let canvasSize: GuiPoint | null = null;
        let childrenWorld = world;
        let childFrame: Frame = { width, height };
        if (node.kind === 'scroll' && node.control?.kind === 'scroll') {
            canvasSize = { x: Math.max(width, resolveUDim(node.control.canvasSize.x, width, this.offsetScale)), y: Math.max(height, resolveUDim(node.control.canvasSize.y, height, this.offsetScale)) };
            const scroll = this.context.scrollOffsets?.get(node.id) ?? { x: 0, y: 0 };
            childrenWorld = matrixTranslate(world, -scroll.x, -scroll.y);
            childFrame = { width: canvasSize.x, height: canvasSize.y };
        }
        const entry: GuiLayoutEntry = { node, parentId, x, y, width, height, world, depth, clipChain: ownChain, textLayout: measured.textLayout, textBox: measured.textBox, canvasSize };
        this.entries.set(node.id, entry);
        this.order.push(entry);
        const padding = node.layout.padding;
        const s = this.offsetScale;
        const inner: Frame = { width: Math.max(0, childFrame.width - (padding.left + padding.right) * s), height: Math.max(0, childFrame.height - (padding.top + padding.bottom) * s) };
        const innerWorld = matrixTranslate(childrenWorld, padding.left * s, padding.top * s);
        const flow = node.layout.kind === 'none' ? null : this.flowPositions(node, children, inner);
        for (const child of children) {
            const slot = flow?.get(child.id) ?? null;
            this.place(child, inner, innerWorld, node.id, depth + 1, ownChain, slot ? { x: slot.x, y: slot.y } : null, slot?.size ?? null);
        }
        return entry;
    }
    private contentExtent(node: GuiNode, children: readonly GuiNode[], measured: Measured): GuiPoint {
        const s = this.offsetScale;
        const padding = node.layout.padding;
        const inner: Frame = { width: Math.max(0, measured.width - (padding.left + padding.right) * s), height: Math.max(0, measured.height - (padding.top + padding.bottom) * s) };
        let maxX = 0;
        let maxY = 0;
        if (node.layout.kind !== 'none') {
            const flow = this.flowPositions(node, children, inner);
            for (const child of children) {
                const slot = flow.get(child.id);
                if (!slot)
                    continue;
                maxX = Math.max(maxX, slot.x + (slot.size.x ?? slot.measured.width));
                maxY = Math.max(maxY, slot.y + (slot.size.y ?? slot.measured.height));
            }
        }
        else {
            for (const child of children) {
                const size = this.measure(child, inner, {});
                const px = resolveUDim(child.rect.position.x, inner.width, s) - child.rect.anchor.x * size.width;
                const py = resolveUDim(child.rect.position.y, inner.height, s) - child.rect.anchor.y * size.height;
                maxX = Math.max(maxX, px + size.width);
                maxY = Math.max(maxY, py + size.height);
            }
        }
        return { x: maxX + (padding.left + padding.right) * s, y: maxY + (padding.top + padding.bottom) * s };
    }
    private flowPositions(node: GuiNode, children: readonly GuiNode[], inner: Frame): Map<string, FlowSlot> {
        const participants = node.children.filter((child) => child.visible && !child.rect.ignoreLayout);
        const slots = new Map<string, FlowSlot>();
        if (participants.length === 0)
            return slots;
        const layout = node.layout;
        const s = this.offsetScale;
        const gap = layout.gap * s;
        const horizontal = layout.direction === 'horizontal';
        const mainLength = horizontal ? inner.width : inner.height;
        const crossLength = horizontal ? inner.height : inner.width;
        if (layout.kind === 'grid') {
            const cellW = Math.max(1, resolveUDim(layout.cellSize.x, inner.width, s));
            const cellH = Math.max(1, resolveUDim(layout.cellSize.y, inner.height, s));
            const cellMain = horizontal ? cellW : cellH;
            const cellCross = horizontal ? cellH : cellW;
            const perLine = layout.columns ?? Math.max(1, Math.floor((mainLength + gap) / (cellMain + gap)));
            const lines = Math.ceil(participants.length / perLine);
            participants.forEach((child, index) => {
                const line = Math.floor(index / perLine);
                const slotInLine = index % perLine;
                const countInLine = line === lines - 1 ? participants.length - line * perLine : perLine;
                const lineLength = countInLine * cellMain + (countInLine - 1) * gap;
                const offset = this.mainOffset(layout.mainAlign, mainLength, lineLength, countInLine, gap);
                const main = offset.start + slotInLine * (cellMain + offset.gap);
                const cross = line * (cellCross + gap);
                const size = { x: cellW, y: cellH };
                slots.set(child.id, { x: horizontal ? main : cross, y: horizontal ? cross : main, size, measured: this.measure(child, { width: cellW, height: cellH }, size) });
            });
            return slots;
        }
        const measured = participants.map((child) => {
            const assigned: Partial<GuiPoint> = layout.crossAlign === 'stretch' ? (horizontal ? { y: crossLength } : { x: crossLength }) : {};
            return { child, assigned, size: this.measure(child, inner, assigned) };
        });
        const lines: Array<typeof measured> = [];
        let current: typeof measured = [];
        let used = 0;
        for (const item of measured) {
            const main = horizontal ? item.size.width : item.size.height;
            if (layout.wrap && current.length > 0 && used + gap + main > mainLength + 0.01) {
                lines.push(current);
                current = [];
                used = 0;
            }
            used += (current.length > 0 ? gap : 0) + main;
            current.push(item);
        }
        if (current.length > 0)
            lines.push(current);
        let crossCursor = 0;
        for (const line of lines) {
            const lineMain = line.reduce((total, item, index) => total + (index > 0 ? gap : 0) + (horizontal ? item.size.width : item.size.height), 0);
            const lineCross = line.reduce((max, item) => Math.max(max, horizontal ? item.size.height : item.size.width), 0);
            const { start, gap: spacing } = this.mainOffset(layout.mainAlign, mainLength, lineMain, line.length, gap);
            let mainCursor = start;
            for (const item of line) {
                const itemMain = horizontal ? item.size.width : item.size.height;
                const itemCross = horizontal ? item.size.height : item.size.width;
                const available = lines.length === 1 ? crossLength : lineCross;
                const crossOffset = layout.crossAlign === 'center' ? (available - itemCross) / 2 : layout.crossAlign === 'end' ? available - itemCross : 0;
                const cross = crossCursor + crossOffset;
                slots.set(item.child.id, { x: horizontal ? mainCursor : cross, y: horizontal ? cross : mainCursor, size: item.assigned, measured: item.size });
                mainCursor += itemMain + spacing;
            }
            crossCursor += lineCross + gap;
        }
        return slots;
    }
    private mainOffset(align: GuiNode['layout']['mainAlign'], available: number, lineLength: number, count: number, gap: number): {
        start: number;
        gap: number;
    } {
        const free = Math.max(0, available - lineLength);
        switch (align) {
            case 'center':
                return { start: free / 2, gap };
            case 'end':
                return { start: free, gap };
            case 'space-between':
                return count > 1 ? { start: 0, gap: gap + free / (count - 1) } : { start: free / 2, gap };
            case 'space-around': {
                const extra = free / count;
                return { start: extra / 2, gap: gap + extra };
            }
            default:
                return { start: 0, gap };
        }
    }
}
interface FlowSlot {
    readonly x: number;
    readonly y: number;
    readonly size: Partial<GuiPoint>;
    readonly measured: Measured;
}
export function layoutGuiDocument(document: GuiDocument, viewport: GuiPoint, context: GuiLayoutContext): GuiLayoutResult {
    const solver = new Solver(context, guiOffsetScale(document, viewport));
    return solver.run(document, viewport);
}
export function entryContains(entry: GuiLayoutEntry, localX: number, localY: number): boolean {
    return localX >= 0 && localY >= 0 && localX <= entry.width && localY <= entry.height;
}
