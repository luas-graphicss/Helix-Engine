'use client';
import type { DragEvent, MouseEvent } from 'react';
import { ChevronDown, ChevronRight, Eye, EyeOff, LayoutGrid, Lock, LockOpen, MonitorSmartphone, Rows3 } from 'lucide-react';
import { GUI_ELEMENT_LABELS, GUI_ROOT_ID, type GuiNode } from '@/engine/gui/document/gui-document';
import { topLevelGuiIds } from '@/engine/gui/document/gui-tree';
import { GUI_ELEMENT_ICONS } from '@/engine/editor/gui/ui/gui-element-icons';
import { useGuiDesigner } from '@/engine/editor/gui/ui/use-gui-designer';
import { isGuiContainer, setGuiNodesLocked, setGuiNodesVisible } from '@/engine/editor/operations/gui-element-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { IconButton } from '@/engine/ui/icon-button';
import { cn } from '@/lib/utils';
import { canDropOnLayer, dropLayers } from './gui-layer-drop';
import { layerChildren, layerZoneFromPointer } from './gui-layer-model';
import { GuiLayerRenameInput } from './gui-layer-rename-input';
import { useGuiLayers } from './gui-layers-context';
const INDENT = 14;
const BASE_PADDING = 6;
function LayoutBadge({ node }: {
    node: GuiNode;
}) {
    if (node.layout.kind === 'none')
        return null;
    const grid = node.layout.kind === 'grid';
    const title = grid ? 'Layout automático em grade' : `Layout automático em lista ${node.layout.direction === 'horizontal' ? 'horizontal' : 'vertical'}`;
    const Icon = grid ? LayoutGrid : Rows3;
    return (<span className="flex shrink-0 items-center rounded-xs border border-primary/40 px-1 text-primary" aria-label={title} title={title}>
      <Icon className={cn('size-2.5', !grid && node.layout.direction === 'horizontal' && 'rotate-90')} aria-hidden/>
    </span>);
}
export function GuiLayerRow({ node, depth }: {
    node: GuiNode;
    depth: number;
}) {
    const session = useEditorSession();
    const designer = useGuiDesigner();
    const layers = useGuiLayers();
    const root = designer.document?.root;
    const isRoot = node.id === GUI_ROOT_ID;
    const filtering = layers.query.length > 0;
    const children = layerChildren(node, layers.query);
    const hasChildren = children.length > 0;
    const expanded = isRoot || filtering || layers.isExpanded(node.id);
    const isPrimary = node.id === designer.primaryId;
    const isSelected = !isRoot && designer.isSelected(node.id);
    const isDragged = layers.dragged.includes(node.id);
    const dropZone = layers.dropTarget?.id === node.id ? layers.dropTarget.zone : null;
    const container = isGuiContainer(node);
    const Icon = isRoot ? MonitorSmartphone : GUI_ELEMENT_ICONS[node.kind];
    const canAcceptDrop = root ? canDropOnLayer(root, layers.dragged, node.id) : false;
    const onClick = (event: MouseEvent<HTMLDivElement>) => {
        if (isRoot) {
            designer.clearSelection();
            layers.setAnchorId(null);
            return;
        }
        if (event.shiftKey) {
            const { rows } = layers;
            const anchor = rows.findIndex((row) => row.node.id === (layers.anchorId ?? designer.primaryId));
            const index = rows.findIndex((row) => row.node.id === node.id);
            if (anchor !== -1 && index !== -1) {
                const [start, end] = anchor <= index ? [anchor, index] : [index, anchor];
                designer.select(rows.slice(start, end + 1).map((row) => row.node.id), { primary: node.id });
                return;
            }
        }
        if (event.ctrlKey || event.metaKey)
            designer.select([node.id], { toggle: true });
        else
            designer.select([node.id]);
        layers.setAnchorId(node.id);
    };
    const onContextMenu = () => {
        if (isRoot) {
            designer.clearSelection();
            return;
        }
        if (!designer.isSelected(node.id))
            designer.select([node.id]);
        else if (!isPrimary)
            designer.select([...designer.selectedIds], { primary: node.id });
    };
    const onDragStart = (event: DragEvent<HTMLDivElement>) => {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', node.name);
        if (designer.isSelected(node.id) && root) {
            layers.setDragged(topLevelGuiIds(root, [...designer.selectedIds]));
        }
        else {
            designer.select([node.id]);
            layers.setDragged([node.id]);
        }
    };
    const onDragOver = (event: DragEvent<HTMLDivElement>) => {
        if (!canAcceptDrop)
            return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        const zone = isRoot ? 'inside' : layerZoneFromPointer(event, container);
        if (dropZone !== zone)
            layers.setDropTarget({ id: node.id, zone });
    };
    const onDrop = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        const target = layers.dropTarget ?? { id: node.id, zone: 'inside' as const };
        const dragged = layers.dragged;
        layers.setDropTarget(null);
        layers.setDragged([]);
        if (!canAcceptDrop)
            return;
        dropLayers(session, dragged, target, layers.rows);
        if (target.zone === 'inside')
            layers.setExpanded(node.id, true);
    };
    return (<>
      <div role="treeitem" aria-selected={isSelected} aria-expanded={hasChildren ? expanded : undefined} aria-level={depth + 1} data-gui-id={node.id} draggable={!isRoot && layers.renamingId !== node.id && !node.locked} onClick={onClick} onDoubleClick={() => {
            if (!isRoot)
                layers.setRenamingId(node.id);
        }} onContextMenu={onContextMenu} onPointerEnter={() => {
            if (!isRoot)
                designer.setHovered(node.id);
        }} onPointerLeave={() => {
            if (designer.hoveredId === node.id)
                designer.setHovered(null);
        }} onDragStart={onDragStart} onDragEnd={() => {
            layers.setDragged([]);
            layers.setDropTarget(null);
        }} onDragOver={onDragOver} onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null) && dropZone)
                layers.setDropTarget(null);
        }} onDrop={onDrop} className={cn('group flex h-6 cursor-default items-center gap-1 pr-1 text-2xs select-none', isPrimary ? 'bg-primary/25 text-foreground' : isSelected ? 'bg-primary/12 text-foreground' : 'text-foreground/90 hover:bg-highlight', !isRoot && designer.hoveredId === node.id && !isSelected && 'bg-highlight', !node.visible && 'opacity-50', isDragged && 'opacity-40', dropZone === 'inside' && 'bg-primary/10 ring-1 ring-primary/60 ring-inset', dropZone === 'before' && 'shadow-[inset_0_2px_0_0_var(--primary)]', dropZone === 'after' && 'shadow-[inset_0_-2px_0_0_var(--primary)]')} style={{ paddingLeft: BASE_PADDING + depth * INDENT }}>
        <button type="button" tabIndex={-1} onClick={(event) => {
            event.stopPropagation();
            if (!isRoot)
                layers.toggleExpanded(node.id);
        }} aria-label={expanded ? 'Recolher' : 'Expandir'} className={cn('flex size-4 shrink-0 items-center justify-center text-muted-foreground', (!hasChildren || isRoot) && 'invisible')}>
          {expanded ? <ChevronDown className="size-3"/> : <ChevronRight className="size-3"/>}
        </button>
        <Icon className={cn('size-3.5 shrink-0', node.locked ? 'text-muted-foreground/60' : isRoot ? 'text-primary' : 'text-muted-foreground')} aria-hidden/>
        {layers.renamingId === node.id ? (<GuiLayerRenameInput node={node} onDone={() => layers.setRenamingId(null)}/>) : (<span className={cn('truncate', node.locked && 'text-muted-foreground', isRoot && 'font-medium')}>{node.name}</span>)}
        <LayoutBadge node={node}/>
        <span className="ml-auto truncate text-3xs text-muted-foreground/70">{isRoot ? `${designer.document?.referenceSize.x ?? 0}×${designer.document?.referenceSize.y ?? 0}` : GUI_ELEMENT_LABELS[node.kind]}</span>
        {!isRoot && (<>
            <IconButton label={node.locked ? 'Desbloquear' : 'Bloquear (não selecionável no canvas)'} size="sm" onClick={(event) => {
                event.stopPropagation();
                setGuiNodesLocked(session, [node.id], !node.locked);
            }} className={cn('size-5 [&_svg]:size-3', !node.locked && 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100')}>
              {node.locked ? <Lock /> : <LockOpen />}
            </IconButton>
            <IconButton label={node.visible ? 'Ocultar' : 'Mostrar'} size="sm" onClick={(event) => {
                event.stopPropagation();
                setGuiNodesVisible(session, [node.id], !node.visible);
            }} className={cn('size-5 [&_svg]:size-3', node.visible && 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100')}>
              {node.visible ? <Eye /> : <EyeOff />}
            </IconButton>
          </>)}
      </div>
      {hasChildren && expanded && (<div role="group">
          {children.map((child) => (<GuiLayerRow key={child.id} node={child} depth={depth + 1}/>))}
        </div>)}
    </>);
}
