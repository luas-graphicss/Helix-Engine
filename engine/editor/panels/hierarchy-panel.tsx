'use client';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu';
import type { Entity } from '@/engine/core/scene/entity';
import { useSessionTopic } from '@/engine/editor/session/editor-session-context';
import { EntityContextMenuContent } from '@/engine/editor/menus/entity-context-menu';
import { useElementSize } from '@/engine/ui/use-element-size';
import { HierarchyContext, type HierarchyContextValue } from './hierarchy/hierarchy-context';
import { HierarchyToolbar } from './hierarchy/hierarchy-toolbar';
import { TreeRow } from './hierarchy/tree-row';
import { computeTreeIndent } from './hierarchy/tree-indent';
import { flattenTree, summarizeScene, type DropTarget } from './hierarchy/tree-model';
import { useExpansion } from './hierarchy/use-expansion';
import { useTreeKeyboard } from './hierarchy/use-tree-keyboard';
import { PanelSummaryFooter } from '@/engine/ui/panel-summary-footer';
function plural(count: number, singular: string, pluralForm: string): string {
    return `${count} ${count === 1 ? singular : pluralForm}`;
}
export function HierarchyPanel() {
    const session = useSessionTopic('scene', 'selection');
    const [query, setQuery] = useState('');
    const [renamingId, setRenamingId] = useState<number | null>(null);
    const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
    const [dragged, setDragged] = useState<readonly Entity[]>([]);
    const expansion = useExpansion();
    const treeRef = useRef<HTMLDivElement>(null);
    const rowsRef = useRef<HTMLDivElement>(null);
    const { width } = useElementSize(rowsRef);
    const normalizedQuery = useDeferredValue(query.trim().toLowerCase());
    const { rows, maxDepth } = flattenTree(session.scene.root, normalizedQuery, expansion.isExpanded);
    const indent = useMemo(() => computeTreeIndent(width, maxDepth), [width, maxDepth]);
    const summary = summarizeScene(session.scene);
    const selectedCount = session.selectedEntities().length;
    const selected = session.selectedEntity;
    const { selectedId } = session;
    const visibleRows = useRef(rows);
    visibleRows.current = rows;
    const rowsOf = useCallback(() => visibleRows.current, []);
    const anchor = useRef<number | null>(null);
    const anchorIdOf = useCallback(() => anchor.current, []);
    const setAnchorId = useCallback((id: number | null) => {
        anchor.current = id;
    }, []);
    useEffect(() => {
        if (selectedId === null)
            return;
        const entity = session.findById(selectedId);
        if (!entity)
            return;
        expansion.reveal(entity);
        const frame = requestAnimationFrame(() => {
            treeRef.current?.querySelector(`[data-entity-id="${selectedId}"]`)?.scrollIntoView({ block: 'nearest' });
        });
        return () => cancelAnimationFrame(frame);
    }, [session, selectedId, expansion.reveal]);
    const onKeyDown = useTreeKeyboard({ session, rows, expansion, anchorIdOf, setAnchorId, startRename: (entity) => setRenamingId(entity.id) });
    const onTreeContextMenu = (event: MouseEvent<HTMLDivElement>) => {
        if (event.target === event.currentTarget)
            session.select(null);
    };
    const { isExpanded, setExpanded, toggleExpanded } = expansion;
    const context = useMemo<HierarchyContextValue>(() => ({
        query: normalizedQuery,
        rowsOf,
        indent,
        renamingId,
        setRenamingId,
        anchorIdOf,
        setAnchorId,
        dropTarget,
        setDropTarget,
        dragged,
        setDragged,
        isExpanded,
        setExpanded,
        toggleExpanded,
    }), [normalizedQuery, rowsOf, indent, renamingId, anchorIdOf, setAnchorId, dropTarget, dragged, isExpanded, setExpanded, toggleExpanded]);
    return (<HierarchyContext.Provider value={context}>
      <div className="flex h-full flex-col">
        <HierarchyToolbar query={query} onQueryChange={setQuery} onExpandAll={expansion.expandAll} onCollapseAll={expansion.collapseAll} onFolderCreated={setRenamingId}/>
        <ContextMenu>
          <ContextMenuTrigger render={<div ref={treeRef} role="tree" tabIndex={0} aria-label="Hierarquia da cena" aria-multiselectable onKeyDown={onKeyDown} onContextMenu={onTreeContextMenu} className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto py-1 outline-none focus-visible:ring-1 focus-visible:ring-primary/50 focus-visible:ring-inset"/>}>
            <div ref={rowsRef}>
              <TreeRow entity={session.scene.root} depth={0}/>
            </div>
          </ContextMenuTrigger>
          <EntityContextMenuContent entity={selected} onRename={(entity) => setRenamingId(entity.id)}/>
        </ContextMenu>
        <PanelSummaryFooter parts={[
            plural(summary.total, 'ator', 'atores'),
            plural(selectedCount, 'selecionado', 'selecionados'),
            summary.hidden > 0 && plural(summary.hidden, 'oculto', 'ocultos'),
            summary.locked > 0 && plural(summary.locked, 'bloqueado', 'bloqueados'),
        ]}/>
      </div>
    </HierarchyContext.Provider>);
}
