import type { DragEvent } from 'react';
import { GUI_ELEMENT_LABELS, type GuiNode } from '@/engine/gui/document/gui-document';
export type LayerDropZone = 'before' | 'inside' | 'after';
export interface LayerDropTarget {
    readonly id: string;
    readonly zone: LayerDropZone;
}
export interface LayerRow {
    readonly node: GuiNode;
    readonly parent: GuiNode;
    readonly depth: number;
}
export function matchesLayerQuery(node: GuiNode, query: string): boolean {
    return node.name.toLowerCase().includes(query) || GUI_ELEMENT_LABELS[node.kind].toLowerCase().includes(query);
}
export function layerSubtreeMatches(node: GuiNode, query: string): boolean {
    return matchesLayerQuery(node, query) || node.children.some((child) => layerSubtreeMatches(child, query));
}
export function layerChildren(node: GuiNode, query: string): GuiNode[] {
    const children = [...node.children].reverse();
    return query.length > 0 ? children.filter((child) => layerSubtreeMatches(child, query)) : children;
}
export function flattenLayers(root: GuiNode, query: string, isExpanded: (id: string) => boolean): LayerRow[] {
    const rows: LayerRow[] = [];
    const visit = (parent: GuiNode, depth: number) => {
        for (const child of layerChildren(parent, query)) {
            rows.push({ node: child, parent, depth });
            if (child.children.length > 0 && (query.length > 0 || isExpanded(child.id)))
                visit(child, depth + 1);
        }
    };
    visit(root, 0);
    return rows;
}
export function layerZoneFromPointer(event: DragEvent<HTMLElement>, acceptsInside: boolean): LayerDropZone {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientY - rect.top) / rect.height;
    if (!acceptsInside)
        return ratio < 0.5 ? 'before' : 'after';
    if (ratio < 0.25)
        return 'before';
    if (ratio > 0.75)
        return 'after';
    return 'inside';
}
export function layerInsertionIndex(parent: GuiNode, anchorId: string, zone: Exclude<LayerDropZone, 'inside'>): number {
    const index = parent.children.findIndex((child) => child.id === anchorId);
    return zone === 'before' ? index + 1 : index;
}
export interface LayerSummary {
    readonly total: number;
    readonly hidden: number;
    readonly locked: number;
}
export function summarizeLayers(root: GuiNode): LayerSummary {
    let total = 0;
    let hidden = 0;
    let locked = 0;
    const visit = (node: GuiNode) => {
        for (const child of node.children) {
            total++;
            if (!child.visible)
                hidden++;
            if (child.locked)
                locked++;
            visit(child);
        }
    };
    visit(root);
    return { total, hidden, locked };
}
