'use client';
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu';
import type { Entity } from '@/engine/core/scene/entity';
import { useEditorState } from '@/engine/editor/session/editor-session-context';
import { EntityContextMenuContent } from '@/engine/editor/menus/entity-context-menu';
import { HierarchyContext, type HierarchyContextValue } from './hierarchy/hierarchy-context';
import { HierarchyToolbar } from './hierarchy/hierarchy-toolbar';
import { TreeRow } from './hierarchy/tree-row';
import { flattenTree, summarizeScene, type DropTarget } from './hierarchy/tree-model';
import { useExpansion } from './hierarchy/use-expansion';
import { useTreeKeyboard } from './hierarchy/use-tree-keyboard';
function plural(count: number, singular: string, pluralForm: string): string {
    return `${count} ${count === 1 ? singular : pluralForm}`;
}
export function HierarchyPanel() {
    const session = useEditorState();
    const [query, setQuery] = useState('');
    const [renamingId, setRenamingId] = useState<number | null>(null);
    const [anchorId, setAnchorId] = useState<number | null>(null);
    const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
    const [dragged, setDragged] = useState<readonly Entity[]>([]);
    const expansion = useExpansion();
    const treeRef = useRef<HTMLDivElement>(null);
    const normalizedQuery = query.trim().toLowerCase();
    const rows = flattenTree(session.scene.root, normalizedQuery, expansion.isExpanded);
    const summary = summarizeScene(session.scene);
    const selectedCount = session.selectedEntities().length;
    const selected = session.selectedEntity;
    const { selectedId } = session;
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
    const onKeyDown = useTreeKeyboard({ session, rows, expansion, anchorId, setAnchorId, startRename: (entity) => setRenamingId(entity.id) });
    const onTreeContextMenu = (event: MouseEvent<HTMLDivElement>) => {
        if (event.target === event.currentTarget)
            session.select(null);
    };
    const context: HierarchyContextValue = {
        query: normalizedQuery,
        rows,
        renamingId,
        setRenamingId,
        anchorId,
        setAnchorId,
        dropTarget,
        setDropTarget,
        dragged,
        setDragged,
        isExpanded: expansion.isExpanded,
        setExpanded: expansion.setExpanded,
        toggleExpanded: expansion.toggleExpanded,
    };
    return (<HierarchyContext.Provider value={context}>
      <div className="flex h-full flex-col">
        <HierarchyToolbar query={query} onQueryChange={setQuery} onExpandAll={expansion.expandAll} onCollapseAll={expansion.collapseAll} onFolderCreated={setRenamingId}/>
        <ContextMenu>
          <ContextMenuTrigger render={<div ref={treeRef} role="tree" tabIndex={0} aria-label="Hierarquia da cena" aria-multiselectable onKeyDown={onKeyDown} onContextMenu={onTreeContextMenu} className="min-h-0 flex-1 overflow-auto py-1 outline-none focus-visible:ring-1 focus-visible:ring-primary/50 focus-visible:ring-inset"/>}>
            <TreeRow entity={session.scene.root} depth={0}/>
          </ContextMenuTrigger>
          <EntityContextMenuContent entity={selected} onRename={(entity) => setRenamingId(entity.id)}/>
        </ContextMenu>
        <div className="flex h-6 shrink-0 items-center gap-2 border-t border-border px-2 font-mono text-[10px] text-muted-foreground">
          <span>{plural(summary.total, 'ator', 'atores')}</span>
          <span>· {plural(selectedCount, 'selecionado', 'selecionados')}</span>
          {summary.hidden > 0 && <span>· {plural(summary.hidden, 'oculto', 'ocultos')}</span>}
          {summary.locked > 0 && <span>· {plural(summary.locked, 'bloqueado', 'bloqueados')}</span>}
        </div>
      </div>
    </HierarchyContext.Provider>);
}
