import type { GuiNode, GuiPoint } from '@/engine/gui/document/gui-document';
import { findGuiNode } from '@/engine/gui/document/gui-tree';
import type { GuiBox, GuiLayoutEntry, GuiLayoutResult } from '@/engine/gui/layout/gui-layout';
import { applyMatrix, matrixInvert, type GuiMatrix } from '@/engine/gui/layout/gui-matrix';
import type { GuiBoxChange } from '@/engine/editor/operations/gui-element-operations';
import { entryBox, entryScreenBounds, parentContentFrame, parentContentMatrix, screenPointToParent, type GuiFrameSize } from './gui-geometry';
import { snapBox, snapValue, type GuiSnapGuide, type GuiSnapOptions } from './gui-snapping';
import { angleAround, normalizeDegrees, resizeBox, rotatePoint, type GuiHandle } from './ui/gui-canvas-interaction';
import type { GuiSelectionFrame } from './gui-selection';
export interface DragModifiers {
    readonly shift: boolean;
    readonly alt: boolean;
    readonly ctrl: boolean;
}
export interface SnapSettings {
    readonly guides: boolean;
    readonly grid: number | null;
    readonly threshold: number;
}
export interface DragUpdate {
    readonly changes: readonly GuiBoxChange[];
    readonly guides: readonly GuiSnapGuide[];
}
function linearDelta(matrix: GuiMatrix, dx: number, dy: number): GuiPoint {
    const origin = applyMatrix(matrix, 0, 0);
    const moved = applyMatrix(matrix, dx, dy);
    return { x: moved.x - origin.x, y: moved.y - origin.y };
}
function isAxisAligned(matrix: GuiMatrix): boolean {
    return Math.abs(matrix[1]) < 1e-6 && Math.abs(matrix[2]) < 1e-6 && Math.abs(matrix[0] - 1) < 1e-6 && Math.abs(matrix[3] - 1) < 1e-6;
}
function guidesToDocument(guides: readonly GuiSnapGuide[], origin: GuiPoint): GuiSnapGuide[] {
    return guides.map((guide) => guide.axis === 'x' ? { ...guide, at: guide.at + origin.x, from: guide.from + origin.y, to: guide.to + origin.y } : { ...guide, at: guide.at + origin.y, from: guide.from + origin.x, to: guide.to + origin.x });
}
function snapTargets(layout: GuiLayoutResult, parentId: string | null, excluded: ReadonlySet<string>, frame: GuiFrameSize): GuiBox[] {
    const targets: GuiBox[] = [{ x: 0, y: 0, width: frame.width, height: frame.height }];
    for (const entry of layout.order) {
        if (entry.parentId !== parentId || excluded.has(entry.node.id) || !entry.node.visible)
            continue;
        targets.push(entryBox(entry));
    }
    return targets;
}
function snapOptions(settings: SnapSettings, targets: GuiBox[]): GuiSnapOptions {
    return { threshold: settings.threshold, grid: settings.grid, targets: settings.guides ? targets : [] };
}
interface MoveItem {
    readonly id: string;
    readonly parentId: string | null;
    readonly box: GuiBox;
    readonly parentMatrix: GuiMatrix;
}
export interface MoveSession {
    readonly kind: 'move';
    readonly origin: GuiPoint;
    readonly items: readonly MoveItem[];
    readonly reference: MoveItem;
    readonly referenceOrigin: GuiPoint;
    readonly referenceAligned: boolean;
    readonly targets: readonly GuiBox[];
}
export function beginMove(layout: GuiLayoutResult, ids: readonly string[], primaryId: string | null, origin: GuiPoint): MoveSession | null {
    const items: MoveItem[] = [];
    for (const id of ids) {
        const entry = layout.entries.get(id);
        if (!entry)
            continue;
        items.push({ id, parentId: entry.parentId, box: entryBox(entry), parentMatrix: parentContentMatrix(layout, entry.parentId) });
    }
    if (items.length === 0)
        return null;
    const reference = items.find((item) => item.id === primaryId) ?? items[0];
    const frame = parentContentFrame(layout, reference.parentId);
    return {
        kind: 'move',
        origin,
        items,
        reference,
        referenceOrigin: applyMatrix(reference.parentMatrix, 0, 0),
        referenceAligned: isAxisAligned(reference.parentMatrix),
        targets: snapTargets(layout, reference.parentId, new Set(ids), frame),
    };
}
export function updateMove(session: MoveSession, point: GuiPoint, modifiers: DragModifiers, snap: SnapSettings): DragUpdate {
    let dx = point.x - session.origin.x;
    let dy = point.y - session.origin.y;
    if (modifiers.shift) {
        if (Math.abs(dx) >= Math.abs(dy))
            dy = 0;
        else
            dx = 0;
    }
    let guides: readonly GuiSnapGuide[] = [];
    if (session.referenceAligned && (snap.guides || snap.grid)) {
        const moving = { ...session.reference.box, x: session.reference.box.x + dx, y: session.reference.box.y + dy };
        const result = snapBox(moving, snapOptions(snap, [...session.targets]), modifiers.shift ? (dy === 0 ? 'horizontal' : 'vertical') : 'all');
        dx += result.dx;
        dy += result.dy;
        guides = guidesToDocument(result.guides, session.referenceOrigin);
    }
    const changes = session.items.map((item) => {
        const local = linearDelta(matrixInvert(item.parentMatrix), dx, dy);
        return { id: item.id, box: { ...item.box, x: item.box.x + local.x, y: item.box.y + local.y } };
    });
    return { changes, guides };
}
interface ResizeItem {
    readonly id: string;
    readonly parentId: string | null;
    readonly bounds: GuiBox;
}
export interface ResizeSession {
    readonly kind: 'resize';
    readonly handle: GuiHandle;
    readonly origin: GuiPoint;
    readonly frame: GuiSelectionFrame;
    readonly toLocal: GuiMatrix;
    readonly single: {
        readonly id: string;
        readonly parentId: string | null;
        readonly box: GuiBox;
        readonly anchor: GuiPoint;
        readonly rotation: number;
        readonly minSize: GuiPoint;
        readonly keepAspect: boolean;
        readonly parentOrigin: GuiPoint;
        readonly aligned: boolean;
        readonly targets: readonly GuiBox[];
    } | null;
    readonly items: readonly ResizeItem[];
}
export function beginResize(layout: GuiLayoutResult, root: GuiNode, frame: GuiSelectionFrame, selectedIds: ReadonlySet<string>, handle: GuiHandle, origin: GuiPoint): ResizeSession {
    const toLocal = matrixInvert(frame.world);
    const s = layout.offsetScale;
    const items: ResizeItem[] = [];
    for (const id of selectedIds) {
        const entry = layout.entries.get(id);
        if (entry)
            items.push({ id, parentId: entry.parentId, bounds: entryScreenBounds(entry) });
    }
    let single: ResizeSession['single'] = null;
    if (frame.single && frame.entry) {
        const entry = frame.entry;
        const node = findGuiNode(root, entry.node.id) ?? entry.node;
        const parentMatrix = parentContentMatrix(layout, entry.parentId);
        single = {
            id: entry.node.id,
            parentId: entry.parentId,
            box: entryBox(entry),
            anchor: node.rect.anchor,
            rotation: node.rect.rotation,
            minSize: { x: Math.max(1, node.rect.minSize.x * s), y: Math.max(1, node.rect.minSize.y * s) },
            keepAspect: node.rect.aspectRatio !== null,
            parentOrigin: applyMatrix(parentMatrix, 0, 0),
            aligned: isAxisAligned(parentMatrix) && node.rect.rotation === 0,
            targets: snapTargets(layout, entry.parentId, new Set([entry.node.id]), parentContentFrame(layout, entry.parentId)),
        };
    }
    return { kind: 'resize', handle, origin, frame, toLocal, single, items };
}
function rotatedResize(start: GuiBox, anchor: GuiPoint, rotation: number, local: GuiBox): GuiBox {
    const pivot = { x: start.x + anchor.x * start.width, y: start.y + anchor.y * start.height };
    const shift = rotatePoint(local.x + anchor.x * local.width - anchor.x * start.width, local.y + anchor.y * local.height - anchor.y * start.height, rotation);
    return { x: pivot.x + shift.x - anchor.x * local.width, y: pivot.y + shift.y - anchor.y * local.height, width: local.width, height: local.height };
}
function snapResizedBox(box: GuiBox, handle: GuiHandle, options: GuiSnapOptions, minSize: GuiPoint): {
    box: GuiBox;
    guides: GuiSnapGuide[];
} {
    let next = box;
    const guides: GuiSnapGuide[] = [];
    const spanY: readonly [
        number,
        number
    ] = [box.y, box.y + box.height];
    const spanX: readonly [
        number,
        number
    ] = [box.x, box.x + box.width];
    if (handle.includes('e')) {
        const result = snapValue(box.x + box.width, 'x', options, spanY);
        if (result.delta !== 0 && box.width + result.delta >= minSize.x)
            next = { ...next, width: next.width + result.delta };
        guides.push(...result.guides);
    }
    else if (handle.includes('w')) {
        const result = snapValue(box.x, 'x', options, spanY);
        if (result.delta !== 0 && box.width - result.delta >= minSize.x)
            next = { ...next, x: next.x + result.delta, width: next.width - result.delta };
        guides.push(...result.guides);
    }
    if (handle.includes('s')) {
        const result = snapValue(box.y + box.height, 'y', options, spanX);
        if (result.delta !== 0 && box.height + result.delta >= minSize.y)
            next = { ...next, height: next.height + result.delta };
        guides.push(...result.guides);
    }
    else if (handle.includes('n')) {
        const result = snapValue(box.y, 'y', options, spanX);
        if (result.delta !== 0 && box.height - result.delta >= minSize.y)
            next = { ...next, y: next.y + result.delta, height: next.height - result.delta };
        guides.push(...result.guides);
    }
    return { box: next, guides };
}
export function updateResize(session: ResizeSession, layout: GuiLayoutResult, point: GuiPoint, modifiers: DragModifiers, snap: SnapSettings): DragUpdate {
    const delta = linearDelta(session.toLocal, point.x - session.origin.x, point.y - session.origin.y);
    const { single } = session;
    if (single) {
        const localStart = { x: 0, y: 0, width: single.box.width, height: single.box.height };
        const local = resizeBox(localStart, session.handle, delta.x, delta.y, { keepAspect: modifiers.shift || single.keepAspect, fromCenter: modifiers.alt, minSize: single.minSize });
        let box = single.rotation === 0 ? { x: single.box.x + local.x, y: single.box.y + local.y, width: local.width, height: local.height } : rotatedResize(single.box, single.anchor, single.rotation, local);
        let guides: GuiSnapGuide[] = [];
        if (single.aligned && !modifiers.alt && !(modifiers.shift || single.keepAspect) && (snap.guides || snap.grid)) {
            const snapped = snapResizedBox(box, session.handle, snapOptions(snap, [...single.targets]), single.minSize);
            box = snapped.box;
            guides = guidesToDocument(snapped.guides, single.parentOrigin);
        }
        return { changes: [{ id: single.id, box }], guides };
    }
    const union = session.frame.box;
    const resized = resizeBox(union, session.handle, delta.x, delta.y, { keepAspect: modifiers.shift, fromCenter: modifiers.alt, minSize: { x: 1, y: 1 } });
    const scaleX = union.width > 0 ? resized.width / union.width : 1;
    const scaleY = union.height > 0 ? resized.height / union.height : 1;
    const changes = session.items.map((item) => {
        const screen: GuiBox = {
            x: resized.x + (item.bounds.x - union.x) * scaleX,
            y: resized.y + (item.bounds.y - union.y) * scaleY,
            width: Math.max(1, item.bounds.width * scaleX),
            height: Math.max(1, item.bounds.height * scaleY),
        };
        const local = screenPointToParent(layout, item.parentId, screen.x, screen.y);
        return { id: item.id, box: { x: local.x, y: local.y, width: screen.width, height: screen.height } };
    });
    return { changes, guides: [] };
}
export interface RotateSession {
    readonly kind: 'rotate';
    readonly center: GuiPoint;
    readonly startAngle: number;
    readonly items: ReadonlyArray<{
        readonly id: string;
        readonly rotation: number;
    }>;
}
export function beginRotate(layout: GuiLayoutResult, root: GuiNode, frame: GuiSelectionFrame, selectedIds: ReadonlySet<string>, origin: GuiPoint): RotateSession {
    const center = applyMatrix(frame.world, frame.box.x + frame.box.width / 2, frame.box.y + frame.box.height / 2);
    const items: Array<{
        id: string;
        rotation: number;
    }> = [];
    for (const id of selectedIds) {
        const node = findGuiNode(root, id);
        if (node && layout.entries.has(id))
            items.push({ id, rotation: node.rect.rotation });
    }
    return { kind: 'rotate', center, startAngle: angleAround(center, origin), items };
}
export function updateRotate(session: RotateSession, point: GuiPoint, modifiers: DragModifiers): {
    readonly rotations: ReadonlyMap<string, number>;
    readonly display: number;
} {
    const delta = angleAround(session.center, point) - session.startAngle;
    const rotations = new Map<string, number>();
    let display = 0;
    for (const item of session.items) {
        let rotation = item.rotation + delta;
        if (modifiers.shift)
            rotation = Math.round(rotation / 15) * 15;
        rotation = normalizeDegrees(rotation);
        rotations.set(item.id, rotation);
        display = rotation;
    }
    return { rotations, display };
}
export function sessionEntries(layout: GuiLayoutResult, ids: Iterable<string>): GuiLayoutEntry[] {
    const entries: GuiLayoutEntry[] = [];
    for (const id of ids) {
        const entry = layout.entries.get(id);
        if (entry)
            entries.push(entry);
    }
    return entries;
}
