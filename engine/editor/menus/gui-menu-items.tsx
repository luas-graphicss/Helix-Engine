'use client';
import { AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignStartHorizontal, AlignStartVertical, ArrowDownToLine, ArrowLeft, ArrowUpToLine, ChevronDown, ChevronUp, ClipboardCopy, ClipboardPaste, Copy, Download, Eye, EyeOff, FileUp, FolderInput, FolderOpen, LayoutPanelTop, LayoutTemplate, Lock, LockOpen, Play, Plus, Redo2, Save, Scissors, SquareDashed, Trash2, Type, Undo2, Ungroup, X, } from 'lucide-react';
import { DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger } from '@/components/ui/dropdown-menu';
import { GUI_TEMPLATES } from '@/engine/gui/templates/gui-templates';
import { useGuiDesigner } from '@/engine/editor/gui/ui/use-gui-designer';
import { alignSelectedGuiNodes, copySelectedGuiNodes, cutSelectedGuiNodes, deleteSelectedGuiNodes, duplicateSelectedGuiNodes, groupSelectedGuiNodes, isGuiContainer, pasteGuiNodes, reorderSelectedGuiNodes, setGuiNodesLocked, setGuiNodesVisible, ungroupSelectedGuiNodes, type GuiAlignment, type GuiReorder, } from '@/engine/editor/operations/gui-element-operations';
import { closeGuiDesigner, createGuiScreen, exportGuiDocument, importGuiFonts, importGuiScreens, openGuiAssetInDesigner, saveGuiDesignerDocument } from '@/engine/editor/operations/gui-operations';
import { useSessionTopic } from '@/engine/editor/session/editor-session-context';
import type { ShortcutActionId } from '@/engine/editor/shortcuts/shortcut-actions';
import { MenuShortcut } from './menu-shortcut';
import { MENU_CONTENT_CLASS, MENU_ITEM_CLASS, MENU_LABEL_CLASS, MENU_SHORTCUT_CLASS } from './menu-styles';
const REORDER_ITEMS: ReadonlyArray<{
    direction: GuiReorder;
    label: string;
    action: ShortcutActionId;
    icon: typeof ArrowUpToLine;
}> = [
    { direction: 'front', label: 'Trazer para a frente', action: 'gui.bringToFront', icon: ArrowUpToLine },
    { direction: 'forward', label: 'Avançar', action: 'gui.bringForward', icon: ChevronUp },
    { direction: 'backward', label: 'Recuar', action: 'gui.sendBackward', icon: ChevronDown },
    { direction: 'back', label: 'Enviar para trás', action: 'gui.sendToBack', icon: ArrowDownToLine },
];
const ALIGN_ITEMS: ReadonlyArray<{
    alignment: GuiAlignment;
    label: string;
    action: ShortcutActionId;
    icon: typeof AlignStartVertical;
}> = [
    { alignment: 'left', label: 'Esquerda', action: 'gui.alignLeft', icon: AlignStartVertical },
    { alignment: 'hcenter', label: 'Centro horizontal', action: 'gui.alignHCenter', icon: AlignCenterVertical },
    { alignment: 'right', label: 'Direita', action: 'gui.alignRight', icon: AlignEndVertical },
    { alignment: 'top', label: 'Topo', action: 'gui.alignTop', icon: AlignStartHorizontal },
    { alignment: 'vcenter', label: 'Centro vertical', action: 'gui.alignVCenter', icon: AlignCenterHorizontal },
    { alignment: 'bottom', label: 'Base', action: 'gui.alignBottom', icon: AlignEndHorizontal },
];
export function GuiEditMenuItems() {
    const session = useSessionTopic('assets', 'workspace');
    const designer = useGuiDesigner();
    const { history } = session;
    const count = designer.selectedIds.size;
    const hasSelection = count > 0 && designer.mode === 'design';
    const ids = [...designer.selectedIds];
    const allVisible = designer.selectedNodes.every((node) => node.visible);
    const allLocked = designer.selectedNodes.every((node) => node.locked);
    const primary = designer.primaryNode;
    return (<>
      <DropdownMenuGroup>
        <DropdownMenuItem className={MENU_ITEM_CLASS} disabled={!history.canUndo} onClick={() => history.undo()}>
          <Undo2 aria-hidden/>
          {history.undoLabel ? `Desfazer ${history.undoLabel}` : 'Desfazer'}
          <MenuShortcut action="edit.undo"/>
        </DropdownMenuItem>
        <DropdownMenuItem className={MENU_ITEM_CLASS} disabled={!history.canRedo} onClick={() => history.redo()}>
          <Redo2 aria-hidden/>
          {history.redoLabel ? `Refazer ${history.redoLabel}` : 'Refazer'}
          <MenuShortcut action="edit.redo"/>
        </DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        {primary?.text && count === 1 && (<DropdownMenuItem className={MENU_ITEM_CLASS} onClick={() => designer.beginTextEdit(primary.id)}>
            <Type aria-hidden/>
            Editar texto
            <MenuShortcut action="gui.enter"/>
          </DropdownMenuItem>)}
        <DropdownMenuItem className={MENU_ITEM_CLASS} disabled={!hasSelection} onClick={() => duplicateSelectedGuiNodes(session)}>
          <Copy aria-hidden/>
          Duplicar
          <MenuShortcut action="gui.duplicate"/>
        </DropdownMenuItem>
        <DropdownMenuItem className={MENU_ITEM_CLASS} disabled={!hasSelection} onClick={() => cutSelectedGuiNodes(session)}>
          <Scissors aria-hidden/>
          Recortar
          <MenuShortcut action="gui.cut"/>
        </DropdownMenuItem>
        <DropdownMenuItem className={MENU_ITEM_CLASS} disabled={!hasSelection} onClick={() => copySelectedGuiNodes(session)}>
          <ClipboardCopy aria-hidden/>
          Copiar
          <MenuShortcut action="gui.copy"/>
        </DropdownMenuItem>
        <DropdownMenuItem className={MENU_ITEM_CLASS} disabled={designer.clipboard.length === 0 || !designer.document} onClick={() => pasteGuiNodes(session)}>
          <ClipboardPaste aria-hidden/>
          Colar
          <MenuShortcut action="gui.paste"/>
        </DropdownMenuItem>
        <DropdownMenuItem className={MENU_ITEM_CLASS} disabled={!designer.document} onClick={() => designer.selectAll()}>
          <SquareDashed aria-hidden/>
          Selecionar tudo
          <MenuShortcut action="gui.selectAll"/>
        </DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuItem className={MENU_ITEM_CLASS} disabled={!hasSelection} onClick={() => groupSelectedGuiNodes(session)}>
          <FolderInput aria-hidden/>
          Agrupar em quadro
          <MenuShortcut action="gui.group"/>
        </DropdownMenuItem>
        <DropdownMenuItem className={MENU_ITEM_CLASS} disabled={!designer.selectedNodes.some((node) => isGuiContainer(node) && node.children.length > 0)} onClick={() => ungroupSelectedGuiNodes(session)}>
          <Ungroup aria-hidden/>
          Desagrupar
          <MenuShortcut action="gui.ungroup"/>
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className={MENU_ITEM_CLASS} disabled={!hasSelection}>
            <ArrowUpToLine aria-hidden/>
            Ordem
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className={MENU_CONTENT_CLASS}>
            {REORDER_ITEMS.map(({ direction, label, action, icon: Icon }) => (<DropdownMenuItem key={direction} className={MENU_ITEM_CLASS} onClick={() => reorderSelectedGuiNodes(session, direction)}>
                <Icon aria-hidden/>
                {label}
                <MenuShortcut action={action}/>
              </DropdownMenuItem>))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className={MENU_ITEM_CLASS} disabled={!hasSelection}>
            <AlignStartVertical aria-hidden/>
            Alinhar
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className={MENU_CONTENT_CLASS}>
            <DropdownMenuLabel className={MENU_LABEL_CLASS}>{count === 1 ? 'Em relação ao pai' : 'Em relação à seleção'}</DropdownMenuLabel>
            {ALIGN_ITEMS.map(({ alignment, label, action, icon: Icon }) => (<DropdownMenuItem key={alignment} className={MENU_ITEM_CLASS} onClick={() => alignSelectedGuiNodes(session, alignment)}>
                <Icon aria-hidden/>
                {label}
                <MenuShortcut action={action}/>
              </DropdownMenuItem>))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuItem className={MENU_ITEM_CLASS} disabled={!hasSelection} onClick={() => setGuiNodesVisible(session, ids, !allVisible)}>
          {allVisible ? <EyeOff aria-hidden/> : <Eye aria-hidden/>}
          {allVisible ? 'Ocultar seleção' : 'Mostrar seleção'}
          <MenuShortcut action="gui.toggleVisibility"/>
        </DropdownMenuItem>
        <DropdownMenuItem className={MENU_ITEM_CLASS} disabled={!hasSelection} onClick={() => setGuiNodesLocked(session, ids, !allLocked)}>
          {allLocked ? <LockOpen aria-hidden/> : <Lock aria-hidden/>}
          {allLocked ? 'Desbloquear seleção' : 'Bloquear seleção'}
          <MenuShortcut action="gui.toggleLock"/>
        </DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuItem className={MENU_ITEM_CLASS} variant="destructive" disabled={!hasSelection} onClick={() => deleteSelectedGuiNodes(session)}>
          <Trash2 aria-hidden/>
          Excluir
          <MenuShortcut action="gui.delete"/>
        </DropdownMenuItem>
      </DropdownMenuGroup>
    </>);
}
export function InterfaceMenuItems() {
    const session = useSessionTopic('assets', 'workspace');
    const designer = useGuiDesigner();
    const screens = session.library.byKind('gui');
    const { document } = designer;
    const designing = session.workspace === 'gui';
    return (<>
      <DropdownMenuGroup>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className={MENU_ITEM_CLASS}>
            <Plus aria-hidden/>
            Nova tela
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className={MENU_CONTENT_CLASS}>
            <DropdownMenuLabel className={MENU_LABEL_CLASS}>A partir de um modelo</DropdownMenuLabel>
            {GUI_TEMPLATES.map((template) => (<DropdownMenuItem key={template.id} className={MENU_ITEM_CLASS} onClick={() => void createGuiScreen(session, template.id)}>
                <LayoutTemplate aria-hidden/>
                {template.label}
              </DropdownMenuItem>))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className={MENU_ITEM_CLASS} disabled={screens.length === 0}>
            <FolderOpen aria-hidden/>
            Abrir tela da biblioteca
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className={MENU_CONTENT_CLASS}>
            {screens.map((asset) => (<DropdownMenuItem key={asset.id} className={MENU_ITEM_CLASS} onClick={() => void openGuiAssetInDesigner(session, asset)}>
                <LayoutPanelTop aria-hidden/>
                {asset.name}
                {designer.assetId === asset.id && <DropdownMenuShortcut className={MENU_SHORTCUT_CLASS}>aberta</DropdownMenuShortcut>}
              </DropdownMenuItem>))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem className={MENU_ITEM_CLASS} onClick={() => void importGuiScreens(session)}>
          <FileUp aria-hidden/>
          Importar tela (.hxgui)…
        </DropdownMenuItem>
        <DropdownMenuItem className={MENU_ITEM_CLASS} onClick={() => importGuiFonts(session)}>
          <Type aria-hidden/>
          Importar fontes…
        </DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuItem className={MENU_ITEM_CLASS} disabled={!designer.dirty} onClick={() => void saveGuiDesignerDocument(session)}>
          <Save aria-hidden/>
          Salvar tela na biblioteca
          <MenuShortcut action="gui.save"/>
        </DropdownMenuItem>
        <DropdownMenuItem className={MENU_ITEM_CLASS} disabled={!document} onClick={() => document && exportGuiDocument(document)}>
          <Download aria-hidden/>
          Exportar arquivo .hxgui
        </DropdownMenuItem>
        <DropdownMenuItem className={MENU_ITEM_CLASS} disabled={!document} onClick={() => designer.togglePreview()}>
          <Play aria-hidden/>
          {designer.mode === 'preview' ? 'Voltar a editar' : 'Testar a tela'}
          <MenuShortcut action="gui.togglePreview"/>
        </DropdownMenuItem>
        <DropdownMenuItem className={MENU_ITEM_CLASS} disabled={!document} onClick={() => void closeGuiDesigner(session)}>
          <X aria-hidden/>
          Fechar tela
        </DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuItem className={MENU_ITEM_CLASS} onClick={() => session.setWorkspace(designing ? 'scene' : 'gui')}>
          {designing ? <ArrowLeft aria-hidden/> : <LayoutPanelTop aria-hidden/>}
          {designing ? 'Voltar à cena 3D' : 'Abrir a área de trabalho Interface'}
        </DropdownMenuItem>
      </DropdownMenuGroup>
    </>);
}
