'use client';
import { useCallback, useState } from 'react';
import type { GuiNode } from '@/engine/gui/document/gui-document';
import { guiAncestors } from '@/engine/gui/document/gui-tree';
interface ExpansionState {
    readonly overrides: ReadonlyMap<string, boolean>;
    readonly fallback: boolean;
}
export interface GuiExpansion {
    readonly isExpanded: (id: string) => boolean;
    readonly setExpanded: (id: string, open: boolean) => void;
    readonly toggleExpanded: (id: string) => void;
    readonly expandAll: () => void;
    readonly collapseAll: () => void;
    readonly reveal: (root: GuiNode, id: string) => void;
}
export function useGuiExpansion(): GuiExpansion {
    const [state, setState] = useState<ExpansionState>({ overrides: new Map(), fallback: true });
    const isExpanded = useCallback((id: string): boolean => state.overrides.get(id) ?? state.fallback, [state]);
    const setExpanded = useCallback((id: string, open: boolean) => {
        setState((current) => {
            if ((current.overrides.get(id) ?? current.fallback) === open)
                return current;
            const overrides = new Map(current.overrides);
            overrides.set(id, open);
            return { ...current, overrides };
        });
    }, []);
    const toggleExpanded = useCallback((id: string) => setExpanded(id, !isExpanded(id)), [isExpanded, setExpanded]);
    const expandAll = useCallback(() => setState({ overrides: new Map(), fallback: true }), []);
    const collapseAll = useCallback(() => setState({ overrides: new Map(), fallback: false }), []);
    const reveal = useCallback((root: GuiNode, id: string) => {
        setState((current) => {
            let overrides: Map<string, boolean> | null = null;
            for (const ancestor of guiAncestors(root, id)) {
                if (ancestor === root || (current.overrides.get(ancestor.id) ?? current.fallback))
                    continue;
                overrides ??= new Map(current.overrides);
                overrides.set(ancestor.id, true);
            }
            return overrides ? { ...current, overrides } : current;
        });
    }, []);
    return { isExpanded, setExpanded, toggleExpanded, expandAll, collapseAll, reveal };
}
