'use client';
import { useCallback, useState } from 'react';
import type { Entity } from '@/engine/core/scene/entity';
import { LARGE_GROUP } from './tree-model';
interface ExpansionState {
    overrides: ReadonlyMap<number, boolean>;
    fallback: boolean | null;
}
export interface Expansion {
    isExpanded: (entity: Entity) => boolean;
    setExpanded: (entity: Entity, open: boolean) => void;
    toggleExpanded: (entity: Entity) => void;
    expandAll: () => void;
    collapseAll: () => void;
    reveal: (entity: Entity) => void;
}
export function useExpansion(): Expansion {
    const [state, setState] = useState<ExpansionState>({ overrides: new Map(), fallback: null });
    const isExpanded = useCallback((entity: Entity): boolean => state.overrides.get(entity.id) ?? state.fallback ?? entity.children.length <= LARGE_GROUP, [state]);
    const setExpanded = useCallback((entity: Entity, open: boolean) => {
        setState((current) => {
            if (current.overrides.get(entity.id) === open)
                return current;
            const overrides = new Map(current.overrides);
            overrides.set(entity.id, open);
            return { ...current, overrides };
        });
    }, []);
    const toggleExpanded = useCallback((entity: Entity) => setExpanded(entity, !isExpanded(entity)), [isExpanded, setExpanded]);
    const expandAll = useCallback(() => setState({ overrides: new Map(), fallback: true }), []);
    const collapseAll = useCallback(() => setState({ overrides: new Map(), fallback: false }), []);
    const reveal = useCallback((entity: Entity) => {
        setState((current) => {
            let overrides: Map<number, boolean> | null = null;
            for (let ancestor = entity.parent; ancestor && ancestor.parent; ancestor = ancestor.parent) {
                const open = current.overrides.get(ancestor.id) ?? current.fallback ?? ancestor.children.length <= LARGE_GROUP;
                if (open)
                    continue;
                overrides ??= new Map(current.overrides);
                overrides.set(ancestor.id, true);
            }
            return overrides ? { ...current, overrides } : current;
        });
    }, []);
    return { isExpanded, setExpanded, toggleExpanded, expandAll, collapseAll, reveal };
}
