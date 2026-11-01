'use client';
import { BookmarkPlus, Boxes, Clapperboard, ClipboardCopy, ClipboardPaste, Copy, Eye, EyeOff, Focus, FolderInput, FolderPlus, ListTree, Locate, Lock, LockOpen, Paintbrush, Palette, Pencil, RotateCcw, Trash2, Ungroup, } from 'lucide-react';
import { ContextMenuContent, ContextMenuGroup, ContextMenuItem, ContextMenuSeparator } from '@/components/ui/context-menu';
import type { Entity } from '@/engine/core/scene/entity';
import { useSessionTopic } from '@/engine/editor/session/editor-session-context';
import { rigOwnerOf } from '@/engine/editor/animation/animation-editor';
import { useDockLayoutStore } from '@/engine/editor/layout/dock-layout-context';
import { MaterialPickerSubmenu } from '@/engine/editor/materials/material-picker';
import { openMaterialEditor } from '@/engine/editor/materials/material-editor-requests';
import { applyLibraryMaterialToEntity, materialTargetKind, saveEntityMaterialToLibrary } from '@/engine/editor/operations/material-library-operations';
import { addFolder, copySelected, deleteEntities, describeEntities, duplicateEntities, groupEntities, hiddenEntities, isolateEntities, pasteClipboard, selectChildren, showAllEntities, toggleEntitiesLocked, toggleEntitiesVisibility, ungroupEntity, unlockAllEntities, lockedEntities, } from '@/engine/editor/operations/entity-operations';
import { savePrefabToLibrary } from '@/engine/editor/operations/prefab-operations';
import { resetTransform } from '@/engine/editor/operations/transform-operations';
import { focusInspectorName } from '@/engine/editor/shortcuts/focus-targets';
import { AddEntitySubmenu } from './add-entity-menu';
import { AudioContextActions } from './audio-context-actions';
import { CsgContextActions } from './csg-context-actions';
import { GuiContextActions } from './gui-context-actions';
import { ScriptContextActions } from './script-context-actions';
import { VfxContextActions } from './vfx-context-actions';
import { LightContextActions } from './light-context-actions';
import { MenuShortcut } from './menu-shortcut';
import { MENU_CONTENT_CLASS, MENU_ITEM_CLASS } from './menu-styles';
type EntityContextMenuContentProps = {
    entity: Entity | null;
    onRename?: (entity: Entity) => void;
};
function MaterialActions({ entity }: {
    entity: Entity;
}) {
    const session = useSessionTopic('scene', 'selection');
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
            <MenuShortcut menu="context" action="view.materialEditor"/>
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
    const session = useSessionTopic('scene', 'selection');
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
    const session = useSessionTopic('scene', 'selection');
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
          <MenuShortcut menu="context" action="selection.showAll"/>
        </ContextMenuItem>)}
      {locked > 0 && (<ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => unlockAllEntities(session)}>
          <LockOpen aria-hidden/>
          Desbloquear todos ({locked})
          <MenuShortcut menu="context" action="selection.unlockAll"/>
        </ContextMenuItem>)}
    </ContextMenuGroup>);
}
export function EntityContextMenuContent({ entity, onRename }: EntityContextMenuContentProps) {
    const session = useSessionTopic('scene', 'selection');
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
              <MenuShortcut menu="context" action="selection.focus"/>
            </ContextMenuItem>
            {!many && (<ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => (onRename ? onRename(entity) : focusInspectorName())}>
                <Pencil aria-hidden/>
                Renomear
                <MenuShortcut menu="context" action="edit.rename"/>
              </ContextMenuItem>)}
            <ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => toggleEntitiesVisibility(session, selection)}>
              {anyVisible ? <EyeOff aria-hidden/> : <Eye aria-hidden/>}
              {anyVisible ? 'Ocultar' : 'Mostrar'}
              <MenuShortcut menu="context" action="selection.toggleVisibility"/>
            </ContextMenuItem>
            <ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => isolateEntities(session, selection)}>
              <Focus aria-hidden/>
              Isolar
              <MenuShortcut menu="context" action="selection.isolate"/>
            </ContextMenuItem>
            <ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => toggleEntitiesLocked(session, selection)}>
              {allLocked ? <LockOpen aria-hidden/> : <Lock aria-hidden/>}
              {allLocked ? 'Desbloquear' : 'Bloquear seleção'}
              <MenuShortcut menu="context" action="selection.toggleLock"/>
            </ContextMenuItem>
          </ContextMenuGroup>
          <ContextMenuSeparator />
          <LightContextActions selection={selection}/>
          <ScriptContextActions selection={selection}/>
          <GuiContextActions selection={selection}/>
          <VfxContextActions selection={selection}/>
          <AudioContextActions selection={selection}/>
          {!many && <AnimateAction entity={entity}/>}
          {!many && <MaterialActions entity={entity}/>}
          <ContextMenuGroup>
            <CsgContextActions entity={entity}/>
          </ContextMenuGroup>
          <ContextMenuGroup>
            <ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => duplicateEntities(session, selection)}>
              <Copy aria-hidden/>
              Duplicar
              <MenuShortcut menu="context" action="edit.duplicate"/>
            </ContextMenuItem>
            {!many && entity.parent && (<ContextMenuItem className={MENU_ITEM_CLASS} title="Guarda este ator com seus descendentes na biblioteca, para instanciar quantas vezes quiser" onClick={() => void savePrefabToLibrary(session, entity)}>
                <Boxes aria-hidden/>
                Salvar como prefab
              </ContextMenuItem>)}
            <ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => {
                if (!session.isSelected(entity))
                    session.select(entity);
                copySelected(session);
            }}>
              <ClipboardCopy aria-hidden/>
              Copiar
              <MenuShortcut menu="context" action="edit.copy"/>
            </ContextMenuItem>
          </ContextMenuGroup>
        </>)}
      <ContextMenuGroup>
        <ContextMenuItem className={MENU_ITEM_CLASS} disabled={!canPaste} onClick={() => pasteClipboard(session, container ?? undefined)}>
          <ClipboardPaste aria-hidden/>
          {container ? 'Colar dentro' : 'Colar'}
          <MenuShortcut menu="context" action="edit.paste"/>
        </ContextMenuItem>
        {entity && (<ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => groupEntities(session, selection)}>
            <FolderInput aria-hidden/>
            {many ? `Agrupar ${label}` : 'Agrupar'}
            <MenuShortcut menu="context" action="edit.group"/>
          </ContextMenuItem>)}
        {groups.length > 0 && (<ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => groups.forEach((group) => ungroupEntity(session, group))}>
            <Ungroup aria-hidden/>
            Desagrupar
            <MenuShortcut menu="context" action="edit.ungroup"/>
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
              <MenuShortcut menu="context" action="edit.delete"/>
            </ContextMenuItem>
          </ContextMenuGroup>
        </>)}
    </ContextMenuContent>);
}
