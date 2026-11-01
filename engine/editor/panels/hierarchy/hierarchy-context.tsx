'use client';
import { createContext, useContext } from 'react';
import type { Entity } from '@/engine/core/scene/entity';
import type { TreeIndent } from './tree-indent';
import type { DropTarget } from './tree-model';
export interface HierarchyContextValue {
    query: string;
    rowsOf: () => readonly Entity[];
    indent: TreeIndent;
    renamingId: number | null;
    setRenamingId: (id: number | null) => void;
    anchorIdOf: () => number | null;
    setAnchorId: (id: number | null) => void;
    dropTarget: DropTarget | null;
    setDropTarget: (target: DropTarget | null) => void;
    dragged: readonly Entity[];
    setDragged: (entities: readonly Entity[]) => void;
    isExpanded: (entity: Entity) => boolean;
    setExpanded: (entity: Entity, open: boolean) => void;
    toggleExpanded: (entity: Entity) => void;
}
export const HierarchyContext = createContext<HierarchyContextValue | null>(null);
export function useHierarchy(): HierarchyContextValue {
    const value = useContext(HierarchyContext);
    if (!value)
        throw new Error('useHierarchy deve ser usado dentro de HierarchyPanel.');
    return value;
}
