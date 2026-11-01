import { GUI_ROOT_ID, type GuiNode } from '@/engine/gui/document/gui-document';
import { findGuiParent, guiAncestors, isGuiDescendant, topLevelGuiIds } from '@/engine/gui/document/gui-tree';
import { entriesInRect, hitTestGui } from '@/engine/gui/layout/gui-hit-test';
import type { GuiBox, GuiLayoutEntry, GuiLayoutResult } from '@/engine/gui/layout/gui-layout';
import { GUI_IDENTITY, type GuiMatrix } from '@/engine/gui/layout/gui-matrix';
import { isGuiContainer, pickGuiNodeAt } from '@/engine/editor/operations/gui-element-operations';
import { entryScreenBounds, unionBoxes } from './gui-geometry';
export interface GuiSelectionFrame {
    readonly box: GuiBox;
    readonly world: GuiMatrix;
    readonly rotation: number;
    readonly single: boolean;
    readonly entry: GuiLayoutEntry | null;
}
export function matrixRotationDegrees(matrix: GuiMatrix): number {
    return (Math.atan2(matrix[1], matrix[0]) * 180) / Math.PI;
}
function chainFromRoot(root: GuiNode, id: string): GuiNode[] {
    const ancestors = guiAncestors(root, id);
    const node = ancestors.length > 0 ? findChild(ancestors[ancestors.length - 1], id) : null;
    return node ? [...ancestors.slice(1), node] : [];
}
function findChild(parent: GuiNode, id: string): GuiNode | null {
    return parent.children.find((child) => child.id === id) ?? null;
}
export function selectionScopeId(root: GuiNode, primaryId: string | null): string {
    if (!primaryId)
        return GUI_ROOT_ID;
    return findGuiParent(root, primaryId)?.id ?? GUI_ROOT_ID;
}
export function pickForClick(layout: GuiLayoutResult, root: GuiNode, x: number, y: number, selectedIds: ReadonlySet<string>, primaryId: string | null, deep: boolean): GuiLayoutEntry | null {
    const hit = pickGuiNodeAt(layout, x, y);
    if (!hit || deep)
        return hit;
    const chain = chainFromRoot(root, hit.node.id);
    if (chain.length === 0)
        return hit;
    for (let index = chain.length - 1; index >= 0; index--) {
        if (selectedIds.has(chain[index].id))
            return layout.entries.get(chain[index].id) ?? hit;
    }
    const scopeId = selectionScopeId(root, primaryId);
    for (let index = 0; index < chain.length; index++) {
        const parentId = index === 0 ? GUI_ROOT_ID : chain[index - 1].id;
        if (parentId === scopeId)
            return layout.entries.get(chain[index].id) ?? hit;
    }
    return layout.entries.get(chain[0].id) ?? hit;
}
export function pickForDoubleClick(layout: GuiLayoutResult, root: GuiNode, x: number, y: number, selectedIds: ReadonlySet<string>): GuiLayoutEntry | null {
    const hit = pickGuiNodeAt(layout, x, y);
    if (!hit)
        return null;
    const chain = chainFromRoot(root, hit.node.id);
    for (let index = chain.length - 2; index >= 0; index--) {
        if (selectedIds.has(chain[index].id))
            return layout.entries.get(chain[index + 1].id) ?? hit;
    }
    return hit;
}
function selectable(entry: GuiLayoutEntry): boolean {
    return entry.node.id !== GUI_ROOT_ID && entry.node.visible && !entry.node.locked;
}
function enclosed(entry: GuiLayoutEntry, rect: GuiBox): boolean {
    const bounds = entryScreenBounds(entry);
    return bounds.x >= rect.x && bounds.y >= rect.y && bounds.x + bounds.width <= rect.x + rect.width && bounds.y + bounds.height <= rect.y + rect.height;
}
export function marqueeSelection(layout: GuiLayoutResult, root: GuiNode, rect: GuiBox): string[] {
    const candidates = entriesInRect(layout, rect, (entry) => selectable(entry) && !hasHiddenOrLockedAncestor(layout, entry)).filter((entry) => !isGuiContainer(entry.node) || enclosed(entry, rect));
    return topLevelGuiIds(root, candidates.map((entry) => entry.node.id));
}
function hasHiddenOrLockedAncestor(layout: GuiLayoutResult, entry: GuiLayoutEntry): boolean {
    let parentId = entry.parentId;
    while (parentId) {
        const parent = layout.entries.get(parentId);
        if (!parent)
            return false;
        if (!parent.node.visible || parent.node.locked)
            return true;
        parentId = parent.parentId;
    }
    return false;
}
export function pickDropContainer(layout: GuiLayoutResult, root: GuiNode, x: number, y: number, movingIds: readonly string[]): GuiLayoutEntry {
    const moving = new Set(movingIds);
    const accept = (entry: GuiLayoutEntry): boolean => {
        if (!isGuiContainer(entry.node) || !entry.node.visible || entry.node.locked)
            return false;
        if (moving.has(entry.node.id))
            return false;
        for (const id of moving)
            if (isGuiDescendant(root, id, entry.node.id))
                return false;
        return !hasHiddenOrLockedAncestor(layout, entry);
    };
    return hitTestGui(layout, x, y, accept) ?? layout.entries.get(GUI_ROOT_ID)!;
}
export function selectionFrame(layout: GuiLayoutResult, selectedIds: ReadonlySet<string>): GuiSelectionFrame | null {
    const entries = [...selectedIds].map((id) => layout.entries.get(id)).filter((entry): entry is GuiLayoutEntry => entry !== undefined);
    if (entries.length === 0)
        return null;
    if (entries.length === 1) {
        const entry = entries[0];
        return { box: { x: 0, y: 0, width: entry.width, height: entry.height }, world: entry.world, rotation: matrixRotationDegrees(entry.world), single: true, entry };
    }
    const union = unionBoxes(entries.map(entryScreenBounds));
    return union ? { box: union, world: GUI_IDENTITY, rotation: 0, single: false, entry: null } : null;
}
export function selectionBounds(layout: GuiLayoutResult, ids: Iterable<string>): GuiBox | null {
    const boxes: GuiBox[] = [];
    for (const id of ids) {
        const entry = layout.entries.get(id);
        if (entry)
            boxes.push(entryScreenBounds(entry));
    }
    return unionBoxes(boxes);
}
