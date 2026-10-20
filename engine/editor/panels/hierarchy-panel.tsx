'use client';
import { createContext, useContext, useState, type DragEvent } from 'react';
import { ChevronDown, ChevronRight, Eye, EyeOff, Earth, Sun, Camera, Box, Folder, Plus, Mountain } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu';
import { SearchField } from '@/engine/ui/search-field';
import { IconButton } from '@/engine/ui/icon-button';
import { cn } from '@/lib/utils';
import { useEditorState } from '@/engine/editor/session/editor-session-context';
import type { Entity, EntityKind } from '@/engine/core/scene/entity';
import { renameEntity, reparentEntity, setEntityVisibility } from '@/engine/editor/operations/entity-operations';
import { AddEntityMenu } from '@/engine/editor/menus/add-entity-menu';
import { EntityContextMenuContent } from '@/engine/editor/menus/entity-context-menu';
const KIND_ICON: Record<EntityKind, LucideIcon> = { group: Folder, mesh: Box, light: Sun, camera: Camera, terrain: Mountain };
const KIND_LABEL: Record<EntityKind, string> = { group: 'Pasta', mesh: 'Malha', light: 'Luz', camera: 'Câmera', terrain: 'Terreno' };
type DropZone = 'before' | 'inside' | 'after';
interface DropTarget {
    entityId: number;
    zone: DropZone;
}
interface HierarchyContextValue {
    query: string;
    renamingId: number | null;
    setRenamingId: (id: number | null) => void;
    dropTarget: DropTarget | null;
    setDropTarget: (target: DropTarget | null) => void;
    draggedId: number | null;
    setDraggedId: (id: number | null) => void;
}
const HierarchyContext = createContext<HierarchyContextValue | null>(null);
function useHierarchy(): HierarchyContextValue {
    const value = useContext(HierarchyContext);
    if (!value)
        throw new Error('useHierarchy deve ser usado dentro de HierarchyPanel.');
    return value;
}
function matchesQuery(entity: Entity, query: string): boolean {
    return entity.name.toLowerCase().includes(query);
}
function subtreeMatches(entity: Entity, query: string): boolean {
    return matchesQuery(entity, query) || entity.children.some((child) => subtreeMatches(child, query));
}
function zoneFromPointer(event: DragEvent<HTMLElement>): DropZone {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientY - rect.top) / rect.height;
    if (ratio < 0.25)
        return 'before';
    if (ratio > 0.75)
        return 'after';
    return 'inside';
}
function RenameInput({ entity, onDone }: {
    entity: Entity;
    onDone: () => void;
}) {
    const session = useEditorState();
    return (<input autoFocus defaultValue={entity.name} aria-label="Novo nome" onFocus={(event) => event.currentTarget.select()} onBlur={(event) => {
            renameEntity(session, entity, event.currentTarget.value);
            onDone();
        }} onKeyDown={(event) => {
            if (event.key === 'Enter')
                event.currentTarget.blur();
            if (event.key === 'Escape') {
                event.currentTarget.value = entity.name;
                event.currentTarget.blur();
            }
        }} onClick={(event) => event.stopPropagation()} className="h-5 min-w-0 flex-1 rounded-sm border border-primary/70 bg-input px-1 text-2xs text-foreground outline-none"/>);
}
const LARGE_GROUP = 200;
function TreeRow({ entity, depth }: {
    entity: Entity;
    depth: number;
}) {
    const session = useEditorState();
    const hierarchy = useHierarchy();
    const [open, setOpen] = useState(entity.children.length <= LARGE_GROUP);
    const isRoot = entity.parent === null;
    const filtering = hierarchy.query.length > 0;
    const visibleChildren = filtering ? entity.children.filter((child) => subtreeMatches(child, hierarchy.query)) : entity.children;
    const hasChildren = visibleChildren.length > 0;
    const expanded = filtering || open;
    const isSelected = entity.id === session.selectedId;
    const isDragged = entity.id === hierarchy.draggedId;
    const dropZone = hierarchy.dropTarget?.entityId === entity.id ? hierarchy.dropTarget.zone : null;
    const Icon = isRoot ? Earth : KIND_ICON[entity.kind];
    const draggedEntity = hierarchy.draggedId === null ? null : session.findById(hierarchy.draggedId);
    const canAcceptDrop = draggedEntity !== null && !draggedEntity.contains(entity);
    const onDragOver = (event: DragEvent<HTMLDivElement>) => {
        if (!canAcceptDrop)
            return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        const zone = isRoot ? 'inside' : zoneFromPointer(event);
        if (dropZone !== zone)
            hierarchy.setDropTarget({ entityId: entity.id, zone });
    };
    const onDrop = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        const zone = hierarchy.dropTarget?.zone ?? 'inside';
        hierarchy.setDropTarget(null);
        hierarchy.setDraggedId(null);
        if (!draggedEntity || !canAcceptDrop)
            return;
        if (zone === 'inside' || !entity.parent) {
            reparentEntity(session, draggedEntity, entity, entity.children.length);
            setOpen(true);
            return;
        }
        const parent = entity.parent;
        let index = parent.children.indexOf(entity) + (zone === 'after' ? 1 : 0);
        if (draggedEntity.parent === parent && parent.children.indexOf(draggedEntity) < index)
            index--;
        reparentEntity(session, draggedEntity, parent, index);
    };
    return (<>
      <div role="treeitem" aria-selected={isSelected} aria-expanded={hasChildren ? expanded : undefined} draggable={!isRoot && hierarchy.renamingId !== entity.id} onClick={() => session.select(isRoot ? null : entity)} onDoubleClick={() => {
            if (isRoot)
                return;
            session.select(entity);
            session.focusEntity(entity);
        }} onContextMenu={() => session.select(isRoot ? null : entity)} onDragStart={(event) => {
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', entity.name);
            hierarchy.setDraggedId(entity.id);
            session.select(entity);
        }} onDragEnd={() => {
            hierarchy.setDraggedId(null);
            hierarchy.setDropTarget(null);
        }} onDragOver={onDragOver} onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null) && dropZone)
                hierarchy.setDropTarget(null);
        }} onDrop={onDrop} className={cn('group flex h-6 cursor-default items-center gap-1 pr-1 text-2xs select-none', isSelected ? 'bg-primary/20 text-foreground' : 'text-foreground/90 hover:bg-highlight', !entity.visible && 'opacity-50', isDragged && 'opacity-40', dropZone === 'inside' && 'bg-primary/10 ring-1 ring-primary/60 ring-inset', dropZone === 'before' && 'shadow-[inset_0_2px_0_0_var(--primary)]', dropZone === 'after' && 'shadow-[inset_0_-2px_0_0_var(--primary)]')} style={{ paddingLeft: 6 + depth * 14 }}>
        <button type="button" tabIndex={-1} onClick={(event) => {
            event.stopPropagation();
            setOpen((value) => !value);
        }} aria-label={expanded ? 'Recolher' : 'Expandir'} className={cn('flex size-4 shrink-0 items-center justify-center text-muted-foreground', !hasChildren && 'invisible')}>
          {expanded ? <ChevronDown className="size-3"/> : <ChevronRight className="size-3"/>}
        </button>
        <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden/>
        {hierarchy.renamingId === entity.id ? (<RenameInput entity={entity} onDone={() => hierarchy.setRenamingId(null)}/>) : (<span className="truncate">{entity.name}</span>)}
        <span className="ml-auto truncate text-[10px] text-muted-foreground/70">{isRoot ? 'Mundo' : KIND_LABEL[entity.kind]}</span>
        {!isRoot && (<IconButton label={entity.visible ? 'Ocultar' : 'Mostrar'} size="sm" onClick={(event) => {
                event.stopPropagation();
                setEntityVisibility(session, entity, !entity.visible);
            }} className={cn('size-5 [&_svg]:size-3', entity.visible && 'opacity-0 group-hover:opacity-100')}>
            {entity.visible ? <Eye /> : <EyeOff />}
          </IconButton>)}
      </div>
      {hasChildren && expanded && (<div role="group">
          {visibleChildren.map((child) => (<TreeRow key={child.id} entity={child} depth={depth + 1}/>))}
        </div>)}
    </>);
}
export function HierarchyPanel() {
    const session = useEditorState();
    const [query, setQuery] = useState('');
    const [renamingId, setRenamingId] = useState<number | null>(null);
    const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
    const [draggedId, setDraggedId] = useState<number | null>(null);
    const total = session.countEntities();
    const selected = session.selectedEntity;
    return (<HierarchyContext.Provider value={{ query: query.trim().toLowerCase(), renamingId, setRenamingId, dropTarget, setDropTarget, draggedId, setDraggedId }}>
      <div className="flex h-full flex-col">
        <div className="flex h-8 shrink-0 items-center gap-1 border-b border-border px-1.5">
          <AddEntityMenu trigger={<button type="button" aria-label="Adicionar ator" title="Adicionar ator" className="inline-flex size-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-highlight hover:text-foreground [&_svg]:size-3.5"/>}>
            <Plus />
          </AddEntityMenu>
          <SearchField placeholder="Filtrar atores" value={query} onChange={setQuery}/>
        </div>
        <ContextMenu>
          <ContextMenuTrigger render={<div role="tree" aria-label="Hierarquia da cena" className="min-h-0 flex-1 overflow-auto py-1"/>}>
            <TreeRow entity={session.scene.root} depth={0}/>
          </ContextMenuTrigger>
          <EntityContextMenuContent entity={selected} onRename={(entity) => setRenamingId(entity.id)}/>
        </ContextMenu>
        <div className="flex h-6 shrink-0 items-center border-t border-border px-2 font-mono text-[10px] text-muted-foreground">
          {total} atores · {selected ? 1 : 0} selecionado
        </div>
      </div>
    </HierarchyContext.Provider>);
}
