'use client';
import { ArrowDown, ArrowUp, Copy, Eye, EyeOff, Focus, PenLine, Plus, Trash2 } from 'lucide-react';
import { ContextMenuContent, ContextMenuGroup, ContextMenuItem, ContextMenuSeparator, ContextMenuShortcut } from '@/components/ui/context-menu';
import { VFX_MAX_EMITTERS, vfxModuleInfo } from '@/engine/vfx/document/vfx-document';
import { MenuShortcut } from '@/engine/editor/menus/menu-shortcut';
import { MENU_CONTENT_CLASS, MENU_ITEM_CLASS, MENU_SHORTCUT_CLASS } from '@/engine/editor/menus/menu-styles';
import { addVfxEmitter, addVfxModule, duplicateVfxEmitter, duplicateVfxModule, moveVfxEmitter, moveVfxModule, removeVfxEmitter, removeVfxModule, soloVfxEmitter, toggleVfxEmitter, toggleVfxModule, } from '@/engine/editor/operations/vfx-document-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { useVfxEditor } from '@/engine/editor/vfx/ui/use-vfx-editor';
import { AddModuleSubmenu } from './module-catalog-menu';
const DANGER_CLASS = `${MENU_ITEM_CLASS} text-destructive [&_svg]:text-destructive`;
export function StackContextMenu({ onRename }: {
    onRename: (emitterId: string) => void;
}) {
    const session = useEditorSession();
    const editor = useVfxEditor();
    const { document } = editor;
    const emitter = editor.selectedEmitter;
    const module = editor.selectedModule;
    if (!document)
        return null;
    if (emitter && module) {
        const index = emitter.modules.findIndex((candidate) => candidate.id === module.id);
        const label = vfxModuleInfo(module.kind).label;
        return (<ContextMenuContent className={MENU_CONTENT_CLASS}>
        <ContextMenuGroup>
          <ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => duplicateVfxModule(session, emitter.id, module.id)}>
            <Copy aria-hidden/>
            Duplicar {label}
            <MenuShortcut menu="context" action="vfx.duplicate"/>
          </ContextMenuItem>
          <ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => toggleVfxModule(session, emitter.id, module.id)}>
            {module.enabled ? <EyeOff aria-hidden/> : <Eye aria-hidden/>}
            {module.enabled ? 'Desligar módulo' : 'Ligar módulo'}
          </ContextMenuItem>
        </ContextMenuGroup>
        <ContextMenuSeparator />
        <ContextMenuGroup>
          <ContextMenuItem className={MENU_ITEM_CLASS} disabled={index <= 0} onClick={() => moveVfxModule(session, emitter.id, module.id, index - 1)}>
            <ArrowUp aria-hidden/>
            Mover para cima
            <MenuShortcut menu="context" action="vfx.moveUp"/>
          </ContextMenuItem>
          <ContextMenuItem className={MENU_ITEM_CLASS} disabled={index >= emitter.modules.length - 1} onClick={() => moveVfxModule(session, emitter.id, module.id, index + 1)}>
            <ArrowDown aria-hidden/>
            Mover para baixo
            <MenuShortcut menu="context" action="vfx.moveDown"/>
          </ContextMenuItem>
        </ContextMenuGroup>
        <ContextMenuSeparator />
        <ContextMenuItem className={DANGER_CLASS} onClick={() => removeVfxModule(session, emitter.id, module.id)}>
          <Trash2 aria-hidden/>
          Remover módulo
          <MenuShortcut menu="context" action="vfx.delete"/>
        </ContextMenuItem>
      </ContextMenuContent>);
    }
    if (emitter) {
        const index = document.emitters.findIndex((candidate) => candidate.id === emitter.id);
        const alone = document.emitters.every((candidate) => candidate.enabled === (candidate.id === emitter.id));
        return (<ContextMenuContent className={MENU_CONTENT_CLASS}>
        <ContextMenuGroup>
          <ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => onRename(emitter.id)}>
            <PenLine aria-hidden/>
            Renomear
            <ContextMenuShortcut className={MENU_SHORTCUT_CLASS}>Duplo clique</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem className={MENU_ITEM_CLASS} disabled={document.emitters.length >= VFX_MAX_EMITTERS} onClick={() => duplicateVfxEmitter(session, emitter.id)}>
            <Copy aria-hidden/>
            Duplicar emissor
            <MenuShortcut menu="context" action="vfx.duplicate"/>
          </ContextMenuItem>
          <ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => toggleVfxEmitter(session, emitter.id)}>
            {emitter.enabled ? <EyeOff aria-hidden/> : <Eye aria-hidden/>}
            {emitter.enabled ? 'Desligar emissor' : 'Ligar emissor'}
          </ContextMenuItem>
          <ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => soloVfxEmitter(session, emitter.id)}>
            <Focus aria-hidden/>
            {alone ? 'Ligar todos os emissores' : 'Isolar este emissor'}
          </ContextMenuItem>
        </ContextMenuGroup>
        <ContextMenuSeparator />
        <AddModuleSubmenu onPick={(kind) => addVfxModule(session, emitter.id, kind)}/>
        <ContextMenuSeparator />
        <ContextMenuGroup>
          <ContextMenuItem className={MENU_ITEM_CLASS} disabled={index <= 0} onClick={() => moveVfxEmitter(session, emitter.id, index - 1)}>
            <ArrowUp aria-hidden/>
            Mover para cima
            <MenuShortcut menu="context" action="vfx.moveUp"/>
          </ContextMenuItem>
          <ContextMenuItem className={MENU_ITEM_CLASS} disabled={index >= document.emitters.length - 1} onClick={() => moveVfxEmitter(session, emitter.id, index + 1)}>
            <ArrowDown aria-hidden/>
            Mover para baixo
            <MenuShortcut menu="context" action="vfx.moveDown"/>
          </ContextMenuItem>
        </ContextMenuGroup>
        <ContextMenuSeparator />
        <ContextMenuItem className={DANGER_CLASS} onClick={() => removeVfxEmitter(session, emitter.id)}>
          <Trash2 aria-hidden/>
          Remover emissor
          <MenuShortcut menu="context" action="vfx.delete"/>
        </ContextMenuItem>
      </ContextMenuContent>);
    }
    return (<ContextMenuContent className={MENU_CONTENT_CLASS}>
      <ContextMenuItem className={MENU_ITEM_CLASS} disabled={document.emitters.length >= VFX_MAX_EMITTERS} onClick={() => addVfxEmitter(session)}>
        <Plus aria-hidden/>
        Adicionar emissor
      </ContextMenuItem>
    </ContextMenuContent>);
}
