import type { GuiPoint, GuiRect, UDim2 } from '@/engine/gui/document/gui-document';
import type { GuiBox, GuiLayoutEntry, GuiLayoutResult } from '@/engine/gui/layout/gui-layout';
import { applyMatrix, matrixInvert, transformedBounds } from '@/engine/gui/layout/gui-matrix';
export interface GuiFrameSize {
    readonly width: number;
    readonly height: number;
}
function round(value: number): number {
    return Math.round(value * 100) / 100;
}
export function parentContentFrame(layout: GuiLayoutResult, parentId: string | null): GuiFrameSize {
    const parent = parentId ? layout.entries.get(parentId) : null;
    if (!parent)
        return { width: layout.viewport.x, height: layout.viewport.y };
    const s = layout.offsetScale;
    const padding = parent.node.layout.padding;
    const base = parent.canvasSize ?? { x: parent.width, y: parent.height };
    return { width: Math.max(0, base.x - (padding.left + padding.right) * s), height: Math.max(0, base.y - (padding.top + padding.bottom) * s) };
}
export function parentContentMatrix(layout: GuiLayoutResult, parentId: string | null) {
    const parent = parentId ? layout.entries.get(parentId) : null;
    if (!parent)
        return layout.entries.get(layout.document.root.id)?.world ?? ([1, 0, 0, 1, 0, 0] as const);
    const s = layout.offsetScale;
    const padding = parent.node.layout.padding;
    const [a, b, c, d, e, f] = parent.world;
    const tx = padding.left * s;
    const ty = padding.top * s;
    return [a, b, c, d, a * tx + c * ty + e, b * tx + d * ty + f] as const;
}
export function entryBox(entry: GuiLayoutEntry): GuiBox {
    return { x: entry.x, y: entry.y, width: entry.width, height: entry.height };
}
export function entryScreenBounds(entry: GuiLayoutEntry): GuiBox {
    return transformedBounds(entry.world, entry.width, entry.height);
}
export function unionBoxes(boxes: readonly GuiBox[]): GuiBox | null {
    if (boxes.length === 0)
        return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const box of boxes) {
        minX = Math.min(minX, box.x);
        minY = Math.min(minY, box.y);
        maxX = Math.max(maxX, box.x + box.width);
        maxY = Math.max(maxY, box.y + box.height);
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
export function screenDeltaToParent(layout: GuiLayoutResult, parentId: string | null, dx: number, dy: number): GuiPoint {
    const inverse = matrixInvert(parentContentMatrix(layout, parentId));
    const origin = applyMatrix(inverse, 0, 0);
    const moved = applyMatrix(inverse, dx, dy);
    return { x: moved.x - origin.x, y: moved.y - origin.y };
}
export function screenPointToParent(layout: GuiLayoutResult, parentId: string | null, x: number, y: number): GuiPoint {
    return applyMatrix(matrixInvert(parentContentMatrix(layout, parentId)), x, y);
}
export function rectFromBox(rect: GuiRect, box: GuiBox, frame: GuiFrameSize, offsetScale: number): GuiRect {
    const s = offsetScale || 1;
    const anchorX = box.x + rect.anchor.x * box.width;
    const anchorY = box.y + rect.anchor.y * box.height;
    return {
        ...rect,
        position: {
            x: { scale: rect.position.x.scale, offset: round((anchorX - rect.position.x.scale * frame.width) / s) },
            y: { scale: rect.position.y.scale, offset: round((anchorY - rect.position.y.scale * frame.height) / s) },
        },
        size: {
            x: { scale: rect.size.x.scale, offset: round((box.width - rect.size.x.scale * frame.width) / s) },
            y: { scale: rect.size.y.scale, offset: round((box.height - rect.size.y.scale * frame.height) / s) },
        },
    };
}
export type GuiUnitTarget = 'position' | 'size' | 'both';
export function toProportional(rect: GuiRect, box: GuiBox, frame: GuiFrameSize, target: GuiUnitTarget): GuiRect {
    const fw = frame.width || 1;
    const fh = frame.height || 1;
    const anchorX = box.x + rect.anchor.x * box.width;
    const anchorY = box.y + rect.anchor.y * box.height;
    const position: UDim2 = target === 'size' ? rect.position : { x: { scale: round(anchorX / fw), offset: 0 }, y: { scale: round(anchorY / fh), offset: 0 } };
    const size: UDim2 = target === 'position' ? rect.size : { x: { scale: round(box.width / fw), offset: 0 }, y: { scale: round(box.height / fh), offset: 0 } };
    return { ...rect, position, size };
}
export function toPixels(rect: GuiRect, box: GuiBox, offsetScale: number, target: GuiUnitTarget): GuiRect {
    const s = offsetScale || 1;
    const anchorX = box.x + rect.anchor.x * box.width;
    const anchorY = box.y + rect.anchor.y * box.height;
    const position: UDim2 = target === 'size' ? rect.position : { x: { scale: 0, offset: round(anchorX / s) }, y: { scale: 0, offset: round(anchorY / s) } };
    const size: UDim2 = target === 'position' ? rect.size : { x: { scale: 0, offset: round(box.width / s) }, y: { scale: 0, offset: round(box.height / s) } };
    return { ...rect, position, size };
}
export interface GuiAnchorPreset {
    readonly id: string;
    readonly label: string;
    readonly anchor: GuiPoint;
}
export const GUI_ANCHOR_PRESETS: readonly GuiAnchorPreset[] = [
    { id: 'top-left', label: 'Superior esquerdo', anchor: { x: 0, y: 0 } },
    { id: 'top', label: 'Superior', anchor: { x: 0.5, y: 0 } },
    { id: 'top-right', label: 'Superior direito', anchor: { x: 1, y: 0 } },
    { id: 'left', label: 'Esquerda', anchor: { x: 0, y: 0.5 } },
    { id: 'center', label: 'Centro', anchor: { x: 0.5, y: 0.5 } },
    { id: 'right', label: 'Direita', anchor: { x: 1, y: 0.5 } },
    { id: 'bottom-left', label: 'Inferior esquerdo', anchor: { x: 0, y: 1 } },
    { id: 'bottom', label: 'Inferior', anchor: { x: 0.5, y: 1 } },
    { id: 'bottom-right', label: 'Inferior direito', anchor: { x: 1, y: 1 } },
];
export function withAnchorPreset(rect: GuiRect, box: GuiBox, frame: GuiFrameSize, offsetScale: number, anchor: GuiPoint): GuiRect {
    const s = offsetScale || 1;
    const anchorX = box.x + anchor.x * box.width;
    const anchorY = box.y + anchor.y * box.height;
    return {
        ...rect,
        anchor,
        position: {
            x: { scale: anchor.x, offset: round((anchorX - anchor.x * frame.width) / s) },
            y: { scale: anchor.y, offset: round((anchorY - anchor.y * frame.height) / s) },
        },
    };
}
export function withAnchor(rect: GuiRect, box: GuiBox, frame: GuiFrameSize, offsetScale: number, anchor: GuiPoint): GuiRect {
    return rectFromBox({ ...rect, anchor }, box, frame, offsetScale);
}
export function currentAnchorPresetId(rect: GuiRect): string | null {
    const preset = GUI_ANCHOR_PRESETS.find((candidate) => candidate.anchor.x === rect.anchor.x && candidate.anchor.y === rect.anchor.y && rect.position.x.scale === candidate.anchor.x && rect.position.y.scale === candidate.anchor.y);
    return preset?.id ?? null;
}
