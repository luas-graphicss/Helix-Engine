'use client';
import { createContext, useContext } from 'react';
import type { Entity } from '@/engine/core/scene/entity';
import type { DropTarget } from './tree-model';
export interface HierarchyContextValue {
    query: string;
    rows: readonly Entity[];
    renamingId: number | null;
    setRenamingId: (id: number | null) => void;
    anchorId: number | null;
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
