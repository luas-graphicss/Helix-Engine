import type { DragEvent } from 'react';
import type { Entity } from '@/engine/core/scene/entity';
import type { Scene } from '@/engine/core/scene/scene';
export type DropZone = 'before' | 'inside' | 'after';
export interface DropTarget {
    entityId: number;
    zone: DropZone;
}
export const LARGE_GROUP = 200;
export function matchesQuery(entity: Entity, query: string): boolean {
    return entity.name.toLowerCase().includes(query);
}
export function subtreeMatches(entity: Entity, query: string): boolean {
    return matchesQuery(entity, query) || entity.children.some((child) => subtreeMatches(child, query));
}
export function visibleChildren(entity: Entity, query: string): Entity[] {
    return query.length > 0 ? entity.children.filter((child) => subtreeMatches(child, query)) : entity.children;
}
export function flattenTree(root: Entity, query: string, isExpanded: (entity: Entity) => boolean): Entity[] {
    const rows: Entity[] = [];
    const visit = (entity: Entity) => {
        for (const child of visibleChildren(entity, query)) {
            rows.push(child);
            if (child.children.length > 0 && (query.length > 0 || isExpanded(child)))
                visit(child);
        }
    };
    visit(root);
    return rows;
}
export function zoneFromPointer(event: DragEvent<HTMLElement>): DropZone {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientY - rect.top) / rect.height;
    if (ratio < 0.25)
        return 'before';
    if (ratio > 0.75)
        return 'after';
    return 'inside';
}
export function insertionIndex(parent: Entity, anchor: Entity, zone: Exclude<DropZone, 'inside'>, moved: readonly Entity[]): number {
    const raw = parent.children.indexOf(anchor) + (zone === 'after' ? 1 : 0);
    let index = raw;
    for (const entity of moved) {
        if (entity.parent !== parent)
            continue;
        if (parent.children.indexOf(entity) < raw)
            index--;
    }
    return index;
}
export interface SceneSummary {
    total: number;
    hidden: number;
    locked: number;
}
export function summarizeScene(scene: Scene): SceneSummary {
    const summary: SceneSummary = { total: 0, hidden: 0, locked: 0 };
    scene.traverse((entity) => {
        if (!entity.parent)
            return;
        summary.total++;
        if (!entity.visible)
            summary.hidden++;
        if (entity.locked)
            summary.locked++;
    });
    return summary;
}
