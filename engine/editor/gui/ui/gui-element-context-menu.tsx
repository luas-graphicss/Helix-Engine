'use client';
import { AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignStartHorizontal, AlignStartVertical, ArrowDownToLine, ArrowUpToLine, ChevronDown, ChevronUp, ClipboardCopy, ClipboardPaste, Copy, CornerDownRight, CornerUpLeft, Eye, EyeOff, FolderInput, Locate, Lock, LockOpen, Pencil, Plus, Scissors, SquareDashed, Trash2, Type, Ungroup, } from 'lucide-react';
import { ContextMenuContent, ContextMenuGroup, ContextMenuItem, ContextMenuLabel, ContextMenuSeparator, ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger } from '@/components/ui/context-menu';
import { GUI_ELEMENT_KINDS, GUI_ELEMENT_LABELS } from '@/engine/gui/document/gui-document';
import { MenuShortcut } from '@/engine/editor/menus/menu-shortcut';
import { MENU_CONTENT_CLASS, MENU_ITEM_CLASS, MENU_LABEL_CLASS } from '@/engine/editor/menus/menu-styles';
import { addGuiElement, alignSelectedGuiNodes, copySelectedGuiNodes, cutSelectedGuiNodes, deleteSelectedGuiNodes, duplicateSelectedGuiNodes, groupSelectedGuiNodes, isGuiContainer, pasteGuiNodes, reorderSelectedGuiNodes, selectGuiChildren, selectGuiParent, setGuiNodesLocked, setGuiNodesVisible, ungroupSelectedGuiNodes, } from '@/engine/editor/operations/gui-element-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { GUI_ELEMENT_ICONS } from './gui-element-icons';
import { useGuiDesigner } from './use-gui-designer';
interface GuiElementContextMenuProps {
    readonly onRename?: () => void;
    readonly onFocus?: () => void;
}
export function GuiElementContextMenu({ onRename, onFocus }: GuiElementContextMenuProps) {
    const session = useEditorSession();
    const designer = useGuiDesigner();
    const primary = designer.primaryNode;
    const count = designer.selectedIds.size;
    const hasSelection = count > 0;
    const allVisible = designer.selectedNodes.every((node) => node.visible);
    const allLocked = designer.selectedNodes.every((node) => node.locked);
    const ids = [...designer.selectedIds];
    return (<ContextMenuContent className={MENU_CONTENT_CLASS}>
      {hasSelection && primary && (<>
          <ContextMenuLabel className={MENU_LABEL_CLASS}>{count === 1 ? `${GUI_ELEMENT_LABELS[primary.kind]} · ${primary.name}` : `${count} elementos`}</ContextMenuLabel>
          <ContextMenuGroup>
            {primary.text && count === 1 && (<ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => designer.beginTextEdit(primary.id)}>
                <Type aria-hidden/>
                Editar texto
                <MenuShortcut menu="context" action="gui.enter"/>
              </ContextMenuItem>)}
            {onRename && count === 1 && (<ContextMenuItem className={MENU_ITEM_CLASS} onClick={onRename}>
                <Pencil aria-hidden/>
                Renomear
                <MenuShortcut menu="context" action="gui.rename"/>
              </ContextMenuItem>)}
            {onFocus && (<ContextMenuItem className={MENU_ITEM_CLASS} onClick={onFocus}>
                <Locate aria-hidden/>
                Enquadrar seleção
                <MenuShortcut menu="context" action="gui.fitSelection"/>
              </ContextMenuItem>)}
          </ContextMenuGroup>
          <ContextMenuSeparator />
          <ContextMenuGroup>
            <ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => cutSelectedGuiNodes(session)}>
              <Scissors aria-hidden/>
              Recortar
              <MenuShortcut menu="context" action="gui.cut"/>
            </ContextMenuItem>
            <ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => copySelectedGuiNodes(session)}>
              <ClipboardCopy aria-hidden/>
              Copiar
              <MenuShortcut menu="context" action="gui.copy"/>
            </ContextMenuItem>
            <ContextMenuItem className={MENU_ITEM_CLASS} disabled={designer.clipboard.length === 0} onClick={() => pasteGuiNodes(session)}>
              <ClipboardPaste aria-hidden/>
              Colar
              <MenuShortcut menu="context" action="gui.paste"/>
            </ContextMenuItem>
            <ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => duplicateSelectedGuiNodes(session)}>
              <Copy aria-hidden/>
              Duplicar
              <MenuShortcut menu="context" action="gui.duplicate"/>
            </ContextMenuItem>
          </ContextMenuGroup>
          <ContextMenuSeparator />
          <ContextMenuGroup>
            <ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => groupSelectedGuiNodes(session)}>
              <FolderInput aria-hidden/>
              Agrupar em quadro
              <MenuShortcut menu="context" action="gui.group"/>
            </ContextMenuItem>
            <ContextMenuItem className={MENU_ITEM_CLASS} disabled={!designer.selectedNodes.some((node) => isGuiContainer(node) && node.children.length > 0)} onClick={() => ungroupSelectedGuiNodes(session)}>
              <Ungroup aria-hidden/>
              Desagrupar
              <MenuShortcut menu="context" action="gui.ungroup"/>
            </ContextMenuItem>
            <ContextMenuSub>
              <ContextMenuSubTrigger className={MENU_ITEM_CLASS}>
                <ArrowUpToLine aria-hidden/>
                Ordem
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className={MENU_CONTENT_CLASS}>
                <ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => reorderSelectedGuiNodes(session, 'front')}>
                  <ArrowUpToLine aria-hidden/>
                  Trazer para a frente
                  <MenuShortcut menu="context" action="gui.bringToFront"/>
                </ContextMenuItem>
                <ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => reorderSelectedGuiNodes(session, 'forward')}>
                  <ChevronUp aria-hidden/>
                  Avançar
                  <MenuShortcut menu="context" action="gui.bringForward"/>
                </ContextMenuItem>
                <ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => reorderSelectedGuiNodes(session, 'backward')}>
                  <ChevronDown aria-hidden/>
                  Recuar
                  <MenuShortcut menu="context" action="gui.sendBackward"/>
                </ContextMenuItem>
                <ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => reorderSelectedGuiNodes(session, 'back')}>
                  <ArrowDownToLine aria-hidden/>
                  Enviar para trás
                  <MenuShortcut menu="context" action="gui.sendToBack"/>
                </ContextMenuItem>
              </ContextMenuSubContent>
            </ContextMenuSub>
            <ContextMenuSub>
              <ContextMenuSubTrigger className={MENU_ITEM_CLASS}>
                <AlignStartVertical aria-hidden/>
                Alinhar
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className={MENU_CONTENT_CLASS}>
                <ContextMenuLabel className={MENU_LABEL_CLASS}>{count === 1 ? 'Em relação ao pai' : 'Em relação à seleção'}</ContextMenuLabel>
                <ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => alignSelectedGuiNodes(session, 'left')}>
                  <AlignStartVertical aria-hidden/>
                  Esquerda
                  <MenuShortcut menu="context" action="gui.alignLeft"/>
                </ContextMenuItem>
                <ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => alignSelectedGuiNodes(session, 'hcenter')}>
                  <AlignCenterVertical aria-hidden/>
                  Centro horizontal
                  <MenuShortcut menu="context" action="gui.alignHCenter"/>
                </ContextMenuItem>
                <ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => alignSelectedGuiNodes(session, 'right')}>
                  <AlignEndVertical aria-hidden/>
                  Direita
                  <MenuShortcut menu="context" action="gui.alignRight"/>
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => alignSelectedGuiNodes(session, 'top')}>
                  <AlignStartHorizontal aria-hidden/>
                  Topo
                  <MenuShortcut menu="context" action="gui.alignTop"/>
                </ContextMenuItem>
                <ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => alignSelectedGuiNodes(session, 'vcenter')}>
                  <AlignCenterHorizontal aria-hidden/>
                  Centro vertical
                  <MenuShortcut menu="context" action="gui.alignVCenter"/>
                </ContextMenuItem>
                <ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => alignSelectedGuiNodes(session, 'bottom')}>
                  <AlignEndHorizontal aria-hidden/>
                  Base
                  <MenuShortcut menu="context" action="gui.alignBottom"/>
                </ContextMenuItem>
              </ContextMenuSubContent>
            </ContextMenuSub>
          </ContextMenuGroup>
          <ContextMenuSeparator />
          <ContextMenuGroup>
            <ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => selectGuiParent(session)}>
              <CornerUpLeft aria-hidden/>
              Selecionar pai
              <MenuShortcut menu="context" action="gui.selectParent"/>
            </ContextMenuItem>
            <ContextMenuItem className={MENU_ITEM_CLASS} disabled={!primary.children.length} onClick={() => selectGuiChildren(session)}>
              <CornerDownRight aria-hidden/>
              Selecionar filhos
              <MenuShortcut menu="context" action="gui.enter"/>
            </ContextMenuItem>
            <ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => setGuiNodesVisible(session, ids, !allVisible)}>
              {allVisible ? <EyeOff aria-hidden/> : <Eye aria-hidden/>}
              {allVisible ? 'Ocultar' : 'Mostrar'}
              <MenuShortcut menu="context" action="gui.toggleVisibility"/>
            </ContextMenuItem>
            <ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => setGuiNodesLocked(session, ids, !allLocked)}>
              {allLocked ? <LockOpen aria-hidden/> : <Lock aria-hidden/>}
              {allLocked ? 'Desbloquear' : 'Bloquear'}
              <MenuShortcut menu="context" action="gui.toggleLock"/>
            </ContextMenuItem>
          </ContextMenuGroup>
          <ContextMenuSeparator />
          <ContextMenuGroup>
            <ContextMenuItem className={MENU_ITEM_CLASS} variant="destructive" onClick={() => deleteSelectedGuiNodes(session)}>
              <Trash2 aria-hidden/>
              Excluir
              <MenuShortcut menu="context" action="gui.delete"/>
            </ContextMenuItem>
          </ContextMenuGroup>
        </>)}
      {!hasSelection && (<>
          <ContextMenuGroup>
            <ContextMenuSub>
              <ContextMenuSubTrigger className={MENU_ITEM_CLASS}>
                <Plus aria-hidden/>
                Adicionar elemento
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className={MENU_CONTENT_CLASS}>
                {GUI_ELEMENT_KINDS.map((kind) => {
                const Icon = GUI_ELEMENT_ICONS[kind];
                return (<ContextMenuItem key={kind} className={MENU_ITEM_CLASS} onClick={() => addGuiElement(session, kind)}>
                      <Icon aria-hidden/>
                      {GUI_ELEMENT_LABELS[kind]}
                    </ContextMenuItem>);
            })}
              </ContextMenuSubContent>
            </ContextMenuSub>
            <ContextMenuItem className={MENU_ITEM_CLASS} disabled={designer.clipboard.length === 0} onClick={() => pasteGuiNodes(session)}>
              <ClipboardPaste aria-hidden/>
              Colar
              <MenuShortcut menu="context" action="gui.paste"/>
            </ContextMenuItem>
            <ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => designer.selectAll()}>
              <SquareDashed aria-hidden/>
              Selecionar tudo
              <MenuShortcut menu="context" action="gui.selectAll"/>
            </ContextMenuItem>
            {onFocus && (<ContextMenuItem className={MENU_ITEM_CLASS} onClick={onFocus}>
                <Locate aria-hidden/>
                Enquadrar tela
                <MenuShortcut menu="context" action="gui.fitAll"/>
              </ContextMenuItem>)}
          </ContextMenuGroup>
        </>)}
    </ContextMenuContent>);
}
