'use client';
import { BookmarkPlus, Clapperboard, ClipboardCopy, ClipboardPaste, Copy, Eye, EyeOff, Focus, FolderInput, FolderPlus, ListTree, Locate, Lock, LockOpen, Paintbrush, Palette, Pencil, RotateCcw, Trash2, Ungroup, } from 'lucide-react';
import { ContextMenuContent, ContextMenuGroup, ContextMenuItem, ContextMenuSeparator, ContextMenuShortcut } from '@/components/ui/context-menu';
import type { Entity } from '@/engine/core/scene/entity';
import { useEditorState } from '@/engine/editor/session/editor-session-context';
import { rigOwnerOf } from '@/engine/editor/animation/animation-editor';
import { useDockLayoutStore } from '@/engine/editor/layout/dock-layout-context';
import { MaterialPickerSubmenu } from '@/engine/editor/materials/material-picker';
import { openMaterialEditor } from '@/engine/editor/materials/material-editor-requests';
import { applyLibraryMaterialToEntity, materialTargetKind, saveEntityMaterialToLibrary } from '@/engine/editor/operations/material-library-operations';
import { addFolder, copySelected, deleteEntities, describeEntities, duplicateEntities, groupEntities, hiddenEntities, isolateEntities, pasteClipboard, selectChildren, showAllEntities, toggleEntitiesLocked, toggleEntitiesVisibility, ungroupEntity, unlockAllEntities, lockedEntities, } from '@/engine/editor/operations/entity-operations';
import { resetTransform } from '@/engine/editor/operations/transform-operations';
import { focusInspectorName } from '@/engine/editor/shortcuts/focus-targets';
import { AddEntitySubmenu } from './add-entity-menu';
import { CsgContextActions } from './csg-context-actions';
import { MENU_CONTENT_CLASS, MENU_ITEM_CLASS, MENU_SHORTCUT_CLASS } from './menu-styles';
type EntityContextMenuContentProps = {
    entity: Entity | null;
    onRename?: (entity: Entity) => void;
};
function MaterialActions({ entity }: {
    entity: Entity;
}) {
    const session = useEditorState();
    const targetKind = materialTargetKind(entity);
    if (!targetKind)
        return null;
    const libraryDocument = targetKind === 'mesh' ? session.materials.forMaterial(entity.material) : null;
    const ownMaterial = targetKind === 'mesh' && entity.material !== null && libraryDocument === null;
    return (<>
      <ContextMenuGroup>
        <MaterialPickerSubmenu label={targetKind === 'terrain' ? 'Adicionar camada de material' : 'Aplicar material'} icon={<Paintbrush aria-hidden/>} appliedId={libraryDocument?.id ?? null} onPick={(document) => applyLibraryMaterialToEntity(session, entity, document)}/>
        {libraryDocument && (<ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => openMaterialEditor({ materialId: libraryDocument.id })}>
            <Palette aria-hidden/>
            Editar material {libraryDocument.name}
            <ContextMenuShortcut className={MENU_SHORTCUT_CLASS}>M</ContextMenuShortcut>
          </ContextMenuItem>)}
        {ownMaterial && (<ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => saveEntityMaterialToLibrary(session, entity)}>
            <BookmarkPlus aria-hidden/>
            Salvar material na biblioteca
          </ContextMenuItem>)}
      </ContextMenuGroup>
      <ContextMenuSeparator />
    </>);
}
function AnimateAction({ entity }: {
    entity: Entity;
}) {
    const session = useEditorState();
    const dock = useDockLayoutStore();
    const owner = rigOwnerOf(entity);
    if (!owner)
        return null;
    const { animation } = session;
    const alreadyPerforming = animation.isPerformer(owner);
    return (<ContextMenuGroup>
      <ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => {
            if (!animation.active)
                animation.newClip(owner);
            else if (!alreadyPerforming)
                animation.addPerformer(owner);
            dock.open('animation');
        }}>
        <Clapperboard aria-hidden/>
        {!animation.active ? 'Animar (nova animação)' : alreadyPerforming ? 'Ir ao editor de animação' : 'Encenar a animação aberta'}
      </ContextMenuItem>
    </ContextMenuGroup>);
}
function SceneActions({ parent }: {
    parent: Entity | null;
}) {
    const session = useEditorState();
    const hidden = hiddenEntities(session.scene).length;
    const locked = lockedEntities(session.scene).length;
    return (<ContextMenuGroup>
      <ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => addFolder(session, parent ?? undefined)}>
        <FolderPlus aria-hidden/>
        {parent ? 'Nova pasta aqui' : 'Nova pasta'}
      </ContextMenuItem>
      {hidden > 0 && (<ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => showAllEntities(session)}>
          <Eye aria-hidden/>
          Mostrar todos ({hidden})
          <ContextMenuShortcut className={MENU_SHORTCUT_CLASS}>Alt+H</ContextMenuShortcut>
        </ContextMenuItem>)}
      {locked > 0 && (<ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => unlockAllEntities(session)}>
          <LockOpen aria-hidden/>
          Desbloquear todos ({locked})
          <ContextMenuShortcut className={MENU_SHORTCUT_CLASS}>Alt+L</ContextMenuShortcut>
        </ContextMenuItem>)}
    </ContextMenuGroup>);
}
export function EntityContextMenuContent({ entity, onRename }: EntityContextMenuContentProps) {
    const session = useEditorState();
    const canPaste = session.clipboard !== null;
    const selection = entity ? (session.isSelected(entity) ? session.selectedEntities() : [entity]) : [];
    const many = selection.length > 1;
    const label = many ? describeEntities(selection) : '';
    const allLocked = selection.length > 0 && selection.every((item) => item.locked);
    const anyVisible = selection.some((item) => item.visible);
    const groups = selection.filter((item) => item.kind === 'group' && item.children.length > 0);
    const withChildren = selection.some((item) => item.children.length > 0);
    const container = entity && entity.kind === 'group' && !many ? entity : null;
    return (<ContextMenuContent className={MENU_CONTENT_CLASS}>
      {entity && (<>
          <ContextMenuGroup>
            <ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => (many ? session.focusSelected() : session.focusEntity(entity))}>
              <Locate aria-hidden/>
              Focar{many ? ` ${label}` : ''}
              <ContextMenuShortcut className={MENU_SHORTCUT_CLASS}>F</ContextMenuShortcut>
            </ContextMenuItem>
            {!many && (<ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => (onRename ? onRename(entity) : focusInspectorName())}>
                <Pencil aria-hidden/>
                Renomear
                <ContextMenuShortcut className={MENU_SHORTCUT_CLASS}>F2</ContextMenuShortcut>
              </ContextMenuItem>)}
            <ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => toggleEntitiesVisibility(session, selection)}>
              {anyVisible ? <EyeOff aria-hidden/> : <Eye aria-hidden/>}
              {anyVisible ? 'Ocultar' : 'Mostrar'}
              <ContextMenuShortcut className={MENU_SHORTCUT_CLASS}>H</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => isolateEntities(session, selection)}>
              <Focus aria-hidden/>
              Isolar
              <ContextMenuShortcut className={MENU_SHORTCUT_CLASS}>Shift+H</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => toggleEntitiesLocked(session, selection)}>
              {allLocked ? <LockOpen aria-hidden/> : <Lock aria-hidden/>}
              {allLocked ? 'Desbloquear' : 'Bloquear seleção'}
              <ContextMenuShortcut className={MENU_SHORTCUT_CLASS}>L</ContextMenuShortcut>
            </ContextMenuItem>
          </ContextMenuGroup>
          <ContextMenuSeparator />
          {!many && <AnimateAction entity={entity}/>}
          {!many && <MaterialActions entity={entity}/>}
          <ContextMenuGroup>
            <CsgContextActions entity={entity}/>
          </ContextMenuGroup>
          <ContextMenuGroup>
            <ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => duplicateEntities(session, selection)}>
              <Copy aria-hidden/>
              Duplicar
              <ContextMenuShortcut className={MENU_SHORTCUT_CLASS}>Ctrl+D</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => {
                if (!session.isSelected(entity))
                    session.select(entity);
                copySelected(session);
            }}>
              <ClipboardCopy aria-hidden/>
              Copiar
              <ContextMenuShortcut className={MENU_SHORTCUT_CLASS}>Ctrl+C</ContextMenuShortcut>
            </ContextMenuItem>
          </ContextMenuGroup>
        </>)}
      <ContextMenuGroup>
        <ContextMenuItem className={MENU_ITEM_CLASS} disabled={!canPaste} onClick={() => pasteClipboard(session, container ?? undefined)}>
          <ClipboardPaste aria-hidden/>
          {container ? 'Colar dentro' : 'Colar'}
          <ContextMenuShortcut className={MENU_SHORTCUT_CLASS}>Ctrl+V</ContextMenuShortcut>
        </ContextMenuItem>
        {entity && (<ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => groupEntities(session, selection)}>
            <FolderInput aria-hidden/>
            {many ? `Agrupar ${label}` : 'Agrupar'}
            <ContextMenuShortcut className={MENU_SHORTCUT_CLASS}>Ctrl+G</ContextMenuShortcut>
          </ContextMenuItem>)}
        {groups.length > 0 && (<ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => groups.forEach((group) => ungroupEntity(session, group))}>
            <Ungroup aria-hidden/>
            Desagrupar
            <ContextMenuShortcut className={MENU_SHORTCUT_CLASS}>Ctrl+Shift+G</ContextMenuShortcut>
          </ContextMenuItem>)}
        {withChildren && (<ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => selectChildren(session, selection)}>
            <ListTree aria-hidden/>
            Selecionar filhos
          </ContextMenuItem>)}
        {entity && !many && (<ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => resetTransform(session, entity)}>
            <RotateCcw aria-hidden/>
            Redefinir transformação
          </ContextMenuItem>)}
      </ContextMenuGroup>
      <ContextMenuSeparator />
      <SceneActions parent={container}/>
      <ContextMenuSeparator />
      <ContextMenuGroup>
        <AddEntitySubmenu />
      </ContextMenuGroup>
      {entity && (<>
          <ContextMenuSeparator />
          <ContextMenuGroup>
            <ContextMenuItem className={MENU_ITEM_CLASS} variant="destructive" onClick={() => deleteEntities(session, selection)}>
              <Trash2 aria-hidden/>
              {many ? `Excluir ${label}` : 'Excluir'}
              <ContextMenuShortcut className={MENU_SHORTCUT_CLASS}>Del</ContextMenuShortcut>
            </ContextMenuItem>
          </ContextMenuGroup>
        </>)}
    </ContextMenuContent>);
}
