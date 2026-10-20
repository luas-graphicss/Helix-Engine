'use client';
import { ClipboardCopy, ClipboardPaste, Copy, Eye, EyeOff, FolderInput, Locate, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { ContextMenuContent, ContextMenuGroup, ContextMenuItem, ContextMenuSeparator, ContextMenuShortcut } from '@/components/ui/context-menu';
import type { Entity } from '@/engine/core/scene/entity';
import { useEditorState } from '@/engine/editor/session/editor-session-context';
import { copySelected, deleteEntity, duplicateEntity, groupEntity, pasteClipboard, setEntityVisibility, } from '@/engine/editor/operations/entity-operations';
import { resetTransform } from '@/engine/editor/operations/transform-operations';
import { focusInspectorName } from '@/engine/editor/shortcuts/focus-targets';
import { AddEntitySubmenu } from './add-entity-menu';
import { MENU_CONTENT_CLASS, MENU_ITEM_CLASS, MENU_SHORTCUT_CLASS } from './menu-styles';
type EntityContextMenuContentProps = {
    entity: Entity | null;
    onRename?: (entity: Entity) => void;
};
export function EntityContextMenuContent({ entity, onRename }: EntityContextMenuContentProps) {
    const session = useEditorState();
    const canPaste = session.clipboard !== null;
    return (<ContextMenuContent className={MENU_CONTENT_CLASS}>
      {entity && (<>
          <ContextMenuGroup>
            <ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => session.focusEntity(entity)}>
              <Locate aria-hidden/>
              Focar
              <ContextMenuShortcut className={MENU_SHORTCUT_CLASS}>F</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => (onRename ? onRename(entity) : focusInspectorName())}>
              <Pencil aria-hidden/>
              Renomear
              <ContextMenuShortcut className={MENU_SHORTCUT_CLASS}>F2</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => setEntityVisibility(session, entity, !entity.visible)}>
              {entity.visible ? <EyeOff aria-hidden/> : <Eye aria-hidden/>}
              {entity.visible ? 'Ocultar' : 'Mostrar'}
              <ContextMenuShortcut className={MENU_SHORTCUT_CLASS}>H</ContextMenuShortcut>
            </ContextMenuItem>
          </ContextMenuGroup>
          <ContextMenuSeparator />
          <ContextMenuGroup>
            <ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => duplicateEntity(session, entity)}>
              <Copy aria-hidden/>
              Duplicar
              <ContextMenuShortcut className={MENU_SHORTCUT_CLASS}>Ctrl+D</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => copySelected(session)}>
              <ClipboardCopy aria-hidden/>
              Copiar
              <ContextMenuShortcut className={MENU_SHORTCUT_CLASS}>Ctrl+C</ContextMenuShortcut>
            </ContextMenuItem>
          </ContextMenuGroup>
        </>)}
      <ContextMenuGroup>
        <ContextMenuItem className={MENU_ITEM_CLASS} disabled={!canPaste} onClick={() => pasteClipboard(session)}>
          <ClipboardPaste aria-hidden/>
          Colar
          <ContextMenuShortcut className={MENU_SHORTCUT_CLASS}>Ctrl+V</ContextMenuShortcut>
        </ContextMenuItem>
        {entity && (<ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => groupEntity(session, entity)}>
            <FolderInput aria-hidden/>
            Agrupar
            <ContextMenuShortcut className={MENU_SHORTCUT_CLASS}>Ctrl+G</ContextMenuShortcut>
          </ContextMenuItem>)}
        {entity && (<ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => resetTransform(session, entity)}>
            <RotateCcw aria-hidden/>
            Redefinir transformação
          </ContextMenuItem>)}
      </ContextMenuGroup>
      <ContextMenuSeparator />
      <ContextMenuGroup>
        <AddEntitySubmenu />
      </ContextMenuGroup>
      {entity && (<>
          <ContextMenuSeparator />
          <ContextMenuGroup>
            <ContextMenuItem className={MENU_ITEM_CLASS} variant="destructive" onClick={() => deleteEntity(session, entity)}>
              <Trash2 aria-hidden/>
              Excluir
              <ContextMenuShortcut className={MENU_SHORTCUT_CLASS}>Del</ContextMenuShortcut>
            </ContextMenuItem>
          </ContextMenuGroup>
        </>)}
    </ContextMenuContent>);
}
