'use client';
import { memo, type DragEvent, type MouseEvent } from 'react';
import { Bone, Box, Camera, ChevronDown, ChevronRight, Earth, Eye, EyeOff, FileCode2, Film, Folder, LayoutTemplate, Lock, LockOpen, Mountain, PersonStanding, Radio, Sparkles, Sun, TriangleAlert, Video, Volume2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { GUI_SURFACE_CONTENT_LABEL, type GuiSurfaceContentKind } from '@/engine/gui/world/gui-surface-settings';
import { IconButton } from '@/engine/ui/icon-button';
import { cn } from '@/lib/utils';
import type { Entity, EntityKind } from '@/engine/core/scene/entity';
import { LOCAL_LIGHT_LABEL, isLocalLight } from '@/engine/core/scene/light';
import { canBeCsgBrush } from '@/engine/geometry/csg/csg-roles';
import { useSessionSelector, useSessionTopic } from '@/engine/editor/session/editor-session-context';
import type { SessionTopic } from '@/engine/editor/session/session-topics';
import { reparentEntities, setEntityLocked, setEntityVisibility } from '@/engine/editor/operations/entity-operations';
import { convertToBrushes } from '@/engine/editor/operations/csg-operations';
import { openScriptActor, scriptAssetOf } from '@/engine/editor/operations/script-operations';
import { LanguageTag } from '@/engine/editor/code/ui/language-tag';
import { lightIcon } from '@/engine/editor/lights/light-icons';
import { CSG_OPERATION_BADGE } from '@/engine/editor/panels/inspector/csg/csg-icons';
import { useEngineSetting } from '@/engine/settings/engine-settings-store';
import { useHierarchy } from './hierarchy-context';
import { RenameInput } from './rename-input';
import { indentGuideImage, rowLayout } from './tree-indent';
import { insertionIndex, visibleChildren, zoneFromPointer } from './tree-model';
const SELECTION_TOPICS: readonly SessionTopic[] = ['selection'];
const KIND_ICON: Record<EntityKind, LucideIcon> = { group: Folder, mesh: Box, light: Sun, camera: Camera, terrain: Mountain, character: PersonStanding, sound: Volume2, gui: LayoutTemplate, vfx: Sparkles, script: FileCode2 };
const KIND_LABEL: Record<EntityKind, string> = { group: 'Pasta', mesh: 'Malha', light: 'Luz', camera: 'Câmera', terrain: 'Terreno', character: 'Personagem', sound: 'Som', gui: 'Interface', vfx: 'Efeito', script: 'Script' };
const GUI_CONTENT_ICON: Record<GuiSurfaceContentKind, LucideIcon> = { screen: LayoutTemplate, video: Film, view: Video };
function entityIcon(entity: Entity): LucideIcon {
    if (entity.kind === 'light')
        return lightIcon(entity.light);
    if (entity.kind === 'sound' && entity.audioZone && !entity.audioSource)
        return Radio;
    if (entity.kind === 'gui' && entity.guiSurface)
        return GUI_CONTENT_ICON[entity.guiSurface.content.kind];
    return KIND_ICON[entity.kind];
}
function entityKindLabel(entity: Entity): string {
    if (isLocalLight(entity.light))
        return LOCAL_LIGHT_LABEL[entity.light.type];
    if (entity.kind === 'sound')
        return entity.audioSource ? 'Fonte de som' : 'Zona acústica';
    if (entity.kind === 'gui' && entity.guiSurface)
        return GUI_SURFACE_CONTENT_LABEL[entity.guiSurface.content.kind];
    return KIND_LABEL[entity.kind];
}
function CsgBadge({ entity }: {
    entity: Entity;
}) {
    if (entity.csgBrush) {
        const badge = CSG_OPERATION_BADGE[entity.csgBrush.operation];
        return (<span className={cn('flex size-3.5 shrink-0 items-center justify-center rounded-xs font-mono text-[9px] font-semibold', badge.className)} aria-label="Pincel CSG">
        {badge.sign}
      </span>);
    }
    if (entity.csg) {
        return (<span className="shrink-0 rounded-xs border border-primary/40 px-1 font-mono text-[9px] leading-[14px] tracking-wider text-primary" aria-label="Alvo CSG">
        CSG
      </span>);
    }
    return null;
}
function RigBadge({ entity }: {
    entity: Entity;
}) {
    const rig = entity.rig;
    if (!rig)
        return null;
    const title = `Rig "${rig.name}": ${rig.jointCount} ${rig.jointCount === 1 ? 'osso' : 'ossos'}${rig.profile.humanoid ? ' · humanoide' : ''}`;
    return (<span className="flex shrink-0 items-center gap-0.5 rounded-xs border border-axis-y/50 px-1 font-mono text-[9px] leading-[14px] tracking-wider text-axis-y" aria-label={title} title={title}>
      <Bone className="size-2.5" aria-hidden/>
      RIG
    </span>);
}
function AudioBadge({ entity }: {
    entity: Entity;
}) {
    if (entity.kind === 'sound' || (!entity.audioSource && !entity.audioZone))
        return null;
    const parts = [entity.audioSource && 'fonte de som', entity.audioZone && 'zona acústica'].filter(Boolean).join(' e ');
    const title = `Carrega ${parts}`;
    return (<span className="flex shrink-0 items-center gap-0.5 rounded-xs border border-warning/50 px-1 font-mono text-[9px] leading-[14px] tracking-wider text-warning" aria-label={title} title={title}>
      {entity.audioSource ? <Volume2 className="size-2.5" aria-hidden/> : <Radio className="size-2.5" aria-hidden/>}
      SOM
    </span>);
}
function GuiBadge({ entity }: {
    entity: Entity;
}) {
    if (entity.kind === 'gui' || !entity.guiSurface)
        return null;
    const title = `Carrega uma interface (${GUI_SURFACE_CONTENT_LABEL[entity.guiSurface.content.kind].toLowerCase()})`;
    const Icon = GUI_CONTENT_ICON[entity.guiSurface.content.kind];
    return (<span className="flex shrink-0 items-center gap-0.5 rounded-xs border border-primary/50 px-1 font-mono text-[9px] leading-[14px] tracking-wider text-primary" aria-label={title} title={title}>
      <Icon className="size-2.5" aria-hidden/>
      UI
    </span>);
}
function ScriptBadge({ entity }: {
    entity: Entity;
}) {
    const session = useSessionTopic('assets');
    if (entity.kind !== 'script' || !entity.script)
        return null;
    const asset = scriptAssetOf(session, entity);
    const language = asset?.details.kind === 'script' ? asset.details.language : null;
    if (!language) {
        return (<span className="flex shrink-0 items-center gap-0.5 rounded-xs border border-warning/50 px-1 font-mono text-[9px] leading-[14px] tracking-wider text-warning" aria-label="Sem script da biblioteca" title="Este ator ainda não aponta para um script da biblioteca">
        <TriangleAlert className="size-2.5" aria-hidden/>
        VAZIO
      </span>);
    }
    return (<span className={cn('flex shrink-0 items-center', !entity.script.enabled && 'opacity-40')} title={entity.script.enabled ? undefined : 'Script desativado: não roda'}>
      <LanguageTag language={language}/>
    </span>);
}
function ScriptCarrierBadge({ entity }: {
    entity: Entity;
}) {
    if (entity.kind === 'script')
        return null;
    const count = entity.children.reduce((total, child) => total + (child.kind === 'script' ? 1 : 0), 0);
    if (count === 0)
        return null;
    const title = count === 1 ? 'Controlado por um script' : `Controlado por ${count} scripts`;
    return (<span className="flex shrink-0 items-center gap-0.5 rounded-xs border border-axis-z/50 px-1 font-mono text-[9px] leading-[14px] tracking-wider text-axis-z" aria-label={title} title={title}>
      <FileCode2 className="size-2.5" aria-hidden/>
      {count === 1 ? 'SCRIPT' : `${count} SCRIPTS`}
    </span>);
}
function isJointOf(entity: Entity): Entity | null {
    for (let ancestor = entity.parent; ancestor; ancestor = ancestor.parent) {
        if (ancestor.rig)
            return ancestor.rig.jointIndex(entity) !== -1 ? ancestor : null;
    }
    return null;
}
type SelectionState = 'none' | 'selected' | 'primary';
export const TreeRow = memo(function TreeRow({ entity, depth }: {
    entity: Entity;
    depth: number;
}) {
    const session = useSessionTopic('scene');
    const hierarchy = useHierarchy();
    const isRoot = entity.parent === null;
    const filtering = hierarchy.query.length > 0;
    const children = visibleChildren(entity, hierarchy.query);
    const hasChildren = children.length > 0;
    const expanded = filtering || hierarchy.isExpanded(entity);
    const selection = useSessionSelector<SelectionState>((current) => (entity.id === current.selectedId ? 'primary' : !isRoot && current.isSelected(entity) ? 'selected' : 'none'), { topics: SELECTION_TOPICS });
    const isPrimary = selection === 'primary';
    const isSelected = selection !== 'none';
    const isDragged = hierarchy.dragged.includes(entity);
    const dropZone = hierarchy.dropTarget?.entityId === entity.id ? hierarchy.dropTarget.zone : null;
    const jointOwner = isRoot ? null : isJointOf(entity);
    const Icon = isRoot ? Earth : jointOwner && entity.kind === 'group' ? Bone : entityIcon(entity);
    const kindLabel = isRoot ? 'Mundo' : entity.csgBrush ? 'Pincel' : jointOwner && entity.kind === 'group' ? 'Osso' : entityKindLabel(entity);
    const kindLabels = useEngineSetting('editor.hierarchy.kindLabels');
    const layout = rowLayout(hierarchy.indent, depth);
    const { dragged } = hierarchy;
    const canAcceptDrop = dragged.length > 0 && !dragged.some((moved) => moved.contains(entity));
    const onClick = (event: MouseEvent<HTMLDivElement>) => {
        if (isRoot) {
            session.select(null);
            hierarchy.setAnchorId(null);
            return;
        }
        if (event.shiftKey) {
            const rows = hierarchy.rowsOf();
            const anchor = rows.findIndex((row) => row.id === (hierarchy.anchorIdOf() ?? session.selectedId));
            const index = rows.indexOf(entity);
            if (anchor !== -1 && index !== -1) {
                const [start, end] = anchor <= index ? [anchor, index] : [index, anchor];
                session.setSelection(rows.slice(start, end + 1), entity);
                return;
            }
        }
        if (event.ctrlKey || event.metaKey) {
            session.toggleSelection(entity);
        }
        else {
            session.select(entity);
        }
        hierarchy.setAnchorId(entity.id);
    };
    const onContextMenu = () => {
        if (isRoot) {
            session.select(null);
            return;
        }
        if (!session.isSelected(entity))
            session.select(entity);
        else if (!isPrimary)
            session.setSelection(session.selectedEntities(), entity);
    };
    const onDragStart = (event: DragEvent<HTMLDivElement>) => {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', entity.name);
        if (session.isSelected(entity)) {
            hierarchy.setDragged(session.selectionRoots());
        }
        else {
            session.select(entity);
            hierarchy.setDragged([entity]);
        }
    };
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
        hierarchy.setDragged([]);
        if (!canAcceptDrop)
            return;
        if (zone === 'inside' || !entity.parent) {
            if (entity.csg && dragged.every((moved) => canBeCsgBrush(moved)))
                convertToBrushes(session, entity, dragged, 'subtract');
            else
                reparentEntities(session, dragged, entity, entity.children.length);
            hierarchy.setExpanded(entity, true);
            return;
        }
        reparentEntities(session, dragged, entity.parent, insertionIndex(entity.parent, entity, zone, dragged));
    };
    return (<>
      <div role="treeitem" aria-selected={isSelected} aria-expanded={hasChildren ? expanded : undefined} aria-level={depth + 1} data-entity-id={entity.id} draggable={!isRoot && hierarchy.renamingId !== entity.id} onClick={onClick} onDoubleClick={() => {
            if (isRoot)
                return;
            session.select(entity);
            if (entity.kind === 'script')
                void openScriptActor(session, entity);
            else
                session.focusEntity(entity);
        }} onContextMenu={onContextMenu} onDragStart={onDragStart} onDragEnd={() => {
            hierarchy.setDragged([]);
            hierarchy.setDropTarget(null);
        }} onDragOver={onDragOver} onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null) && dropZone)
                hierarchy.setDropTarget(null);
        }} onDrop={onDrop} className={cn('group relative flex h-control cursor-default items-center gap-1 pr-1 text-2xs select-none [contain-intrinsic-block-size:var(--spacing-control)] [content-visibility:auto]', isPrimary ? 'bg-primary/25 text-foreground' : isSelected ? 'bg-primary/12 text-foreground' : 'text-foreground/90 hover:bg-highlight', !entity.visible && 'opacity-50', isDragged && 'opacity-40', dropZone === 'inside' && 'bg-primary/10 ring-1 ring-primary/60 ring-inset', dropZone === 'before' && 'shadow-[inset_0_2px_0_0_var(--primary)]', dropZone === 'after' && 'shadow-[inset_0_-2px_0_0_var(--primary)]')} style={{ paddingLeft: layout.paddingLeft }}>
        {layout.guideWidth > 0 && (<span aria-hidden className="pointer-events-none absolute inset-y-0" style={{ left: layout.guideLeft, width: layout.guideWidth, backgroundImage: indentGuideImage(hierarchy.indent.step) }}/>)}
        <button type="button" tabIndex={-1} onClick={(event) => {
            event.stopPropagation();
            hierarchy.toggleExpanded(entity);
        }} aria-label={expanded ? 'Recolher' : 'Expandir'} className={cn('flex size-4 shrink-0 items-center justify-center text-muted-foreground', !hasChildren && 'invisible')}>
          {expanded ? <ChevronDown className="size-3"/> : <ChevronRight className="size-3"/>}
        </button>
        <Icon className={cn('size-3.5 shrink-0', entity.locked ? 'text-muted-foreground/60' : 'text-muted-foreground')} aria-hidden/>
        {hierarchy.renamingId === entity.id ? (<RenameInput entity={entity} onDone={() => hierarchy.setRenamingId(null)}/>) : (<span className={cn('truncate', entity.locked && 'text-muted-foreground')}>{entity.name}</span>)}
        <ScriptBadge entity={entity}/>
        <CsgBadge entity={entity}/>
        <RigBadge entity={entity}/>
        <GuiBadge entity={entity}/>
        <AudioBadge entity={entity}/>
        <ScriptCarrierBadge entity={entity}/>
        <span className={cn('ml-auto truncate text-3xs text-muted-foreground/70', (layout.compact || !kindLabels) && 'sr-only')}>{kindLabel}</span>
        {!isRoot && (<>
            <IconButton label={entity.locked ? 'Desbloquear' : 'Bloquear (não selecionável no viewport)'} size="xs" onClick={(event) => {
                event.stopPropagation();
                setEntityLocked(session, entity, !entity.locked);
            }} className={cn(!entity.locked && 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100')}>
              {entity.locked ? <Lock /> : <LockOpen />}
            </IconButton>
            <IconButton label={entity.visible ? 'Ocultar' : 'Mostrar'} size="xs" onClick={(event) => {
                event.stopPropagation();
                setEntityVisibility(session, entity, !entity.visible);
            }} className={cn(entity.visible && 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100')}>
              {entity.visible ? <Eye /> : <EyeOff />}
            </IconButton>
          </>)}
      </div>
      {hasChildren && expanded && (<div role="group">
          {children.map((child) => (<TreeRow key={child.id} entity={child} depth={depth + 1}/>))}
        </div>)}
    </>);
});
