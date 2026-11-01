import type { GuiPoint } from '@/engine/gui/document/gui-document';
import { entryContains, type GuiLayoutEntry, type GuiLayoutResult } from './gui-layout';
import { applyMatrix, matrixInvert } from './gui-matrix';
export function toLocal(entry: GuiLayoutEntry, x: number, y: number): GuiPoint {
    return applyMatrix(matrixInvert(entry.world), x, y);
}
function insideClipChain(layout: GuiLayoutResult, entry: GuiLayoutEntry, x: number, y: number): boolean {
    for (const id of entry.clipChain) {
        if (id === entry.node.id)
            continue;
        const clipper = layout.entries.get(id);
        if (!clipper)
            continue;
        const local = toLocal(clipper, x, y);
        if (!entryContains(clipper, local.x, local.y))
            return false;
    }
    return true;
}
export function hitTestGui(layout: GuiLayoutResult, x: number, y: number, accept: (entry: GuiLayoutEntry) => boolean): GuiLayoutEntry | null {
    for (let index = layout.order.length - 1; index >= 0; index--) {
        const entry = layout.order[index];
        if (!accept(entry))
            continue;
        const local = toLocal(entry, x, y);
        if (!entryContains(entry, local.x, local.y))
            continue;
        if (!insideClipChain(layout, entry, x, y))
            continue;
        return entry;
    }
    return null;
}
export function entriesInRect(layout: GuiLayoutResult, rect: {
    x: number;
    y: number;
    width: number;
    height: number;
}, accept: (entry: GuiLayoutEntry) => boolean): GuiLayoutEntry[] {
    const result: GuiLayoutEntry[] = [];
    for (const entry of layout.order) {
        if (!accept(entry))
            continue;
        const corners = [applyMatrix(entry.world, 0, 0), applyMatrix(entry.world, entry.width, 0), applyMatrix(entry.world, entry.width, entry.height), applyMatrix(entry.world, 0, entry.height)];
        const minX = Math.min(...corners.map((c) => c.x));
        const maxX = Math.max(...corners.map((c) => c.x));
        const minY = Math.min(...corners.map((c) => c.y));
        const maxY = Math.max(...corners.map((c) => c.y));
        if (maxX < rect.x || minX > rect.x + rect.width || maxY < rect.y || minY > rect.y + rect.height)
            continue;
        result.push(entry);
    }
    return result;
}
