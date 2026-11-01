'use client';
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { ChevronsDownUp, ChevronsUpDown, Layers, Plus } from 'lucide-react';
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { GUI_ELEMENT_KINDS, GUI_ELEMENT_LABELS } from '@/engine/gui/document/gui-document';
import { GuiElementContextMenu } from '@/engine/editor/gui/ui/gui-element-context-menu';
import { GUI_ELEMENT_ICONS } from '@/engine/editor/gui/ui/gui-element-icons';
import { useGuiDesigner } from '@/engine/editor/gui/ui/use-gui-designer';
import { MenuShortcut } from '@/engine/editor/menus/menu-shortcut';
import { MENU_CONTENT_CLASS, MENU_ITEM_CLASS } from '@/engine/editor/menus/menu-styles';
import { addGuiElement } from '@/engine/editor/operations/gui-element-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { guiToolAction } from '@/engine/editor/shortcuts/tool-actions';
import { IconButton } from '@/engine/ui/icon-button';
import { PanelToolbar } from '@/engine/ui/panel-toolbar';
import { SearchField } from '@/engine/ui/search-field';
import { flattenLayers, summarizeLayers, type LayerDropTarget } from './layers/gui-layer-model';
import { GuiLayerRow } from './layers/gui-layer-row';
import { GuiLayersContext, type GuiLayersContextValue } from './layers/gui-layers-context';
import { useGuiExpansion } from './layers/use-gui-expansion';
import { useGuiLayersKeyboard } from './layers/use-gui-layers-keyboard';
import { PanelSummaryFooter } from '@/engine/ui/panel-summary-footer';
function plural(count: number, singular: string, pluralForm: string): string {
    return `${count} ${count === 1 ? singular : pluralForm}`;
}
const TOOL_BUTTON_CLASS = 'inline-flex size-control shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-highlight hover:text-foreground data-[popup-open]:bg-highlight data-[popup-open]:text-foreground [&_svg]:size-3.5';
function AddElementMenu() {
    const session = useEditorSession();
    const designer = useGuiDesigner();
    return (<DropdownMenu>
      <DropdownMenuTrigger render={<button type="button" aria-label="Adicionar elemento" title="Adicionar elemento ao contêiner selecionado" className={TOOL_BUTTON_CLASS}/>}>
        <Plus />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={4} className={MENU_CONTENT_CLASS}>
        <DropdownMenuGroup>
          {GUI_ELEMENT_KINDS.map((kind) => {
            const Icon = GUI_ELEMENT_ICONS[kind];
            return (<DropdownMenuItem key={kind} className={MENU_ITEM_CLASS} onClick={() => {
                    const id = addGuiElement(session, kind);
                    if (id && kind === 'text')
                        designer.beginTextEdit(id);
                }}>
                <Icon aria-hidden/>
                {GUI_ELEMENT_LABELS[kind]}
                <MenuShortcut action={guiToolAction(kind)}/>
              </DropdownMenuItem>);
        })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>);
}
function NoScreen() {
    return (<div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground">
      <Layers className="size-5 opacity-60" aria-hidden/>
      <p className="text-2xs leading-relaxed text-pretty">Nenhuma tela aberta. Crie uma a partir de um modelo ou abra uma tela da biblioteca para ver as camadas.</p>
    </div>);
}
export function GuiLayersPanel() {
    const designer = useGuiDesigner();
    const [query, setQuery] = useState('');
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [anchorId, setAnchorId] = useState<string | null>(null);
    const [dropTarget, setDropTarget] = useState<LayerDropTarget | null>(null);
    const [dragged, setDragged] = useState<readonly string[]>([]);
    const expansion = useGuiExpansion();
    const treeRef = useRef<HTMLDivElement>(null);
    const { document } = designer;
    const root = document?.root ?? null;
    const normalizedQuery = query.trim().toLowerCase();
    const rows = root ? flattenLayers(root, normalizedQuery, expansion.isExpanded) : [];
    const summary = root ? summarizeLayers(root) : { total: 0, hidden: 0, locked: 0 };
    const { primaryId } = designer;
    useEffect(() => {
        if (!root || !primaryId)
            return;
        expansion.reveal(root, primaryId);
        const frame = requestAnimationFrame(() => {
            treeRef.current?.querySelector(`[data-gui-id="${primaryId}"]`)?.scrollIntoView({ block: 'nearest' });
        });
        return () => cancelAnimationFrame(frame);
    }, [root, primaryId, expansion.reveal]);
    const onKeyDown = useGuiLayersKeyboard({ designer, rows, expansion, anchorId, setAnchorId, startRename: setRenamingId });
    const onTreeContextMenu = (event: MouseEvent<HTMLDivElement>) => {
        if (event.target === event.currentTarget)
            designer.clearSelection();
    };
    if (!root)
        return <NoScreen />;
    const context: GuiLayersContextValue = {
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
    return (<GuiLayersContext.Provider value={context}>
      <div className="flex h-full flex-col">
        <PanelToolbar>
          <AddElementMenu />
          <SearchField placeholder="Filtrar camadas" value={query} onChange={setQuery}/>
          <IconButton label="Expandir tudo" size="sm" onClick={expansion.expandAll}>
            <ChevronsUpDown />
          </IconButton>
          <IconButton label="Recolher tudo" size="sm" onClick={expansion.collapseAll}>
            <ChevronsDownUp />
          </IconButton>
        </PanelToolbar>
        <ContextMenu>
          <ContextMenuTrigger render={<div ref={treeRef} role="tree" tabIndex={0} aria-label="Camadas da tela" aria-multiselectable onKeyDown={onKeyDown} onContextMenu={onTreeContextMenu} className="min-h-0 flex-1 overflow-auto py-1 outline-none focus-visible:ring-1 focus-visible:ring-primary/50 focus-visible:ring-inset"/>}>
            <GuiLayerRow node={root} depth={0}/>
          </ContextMenuTrigger>
          <GuiElementContextMenu onRename={() => setRenamingId(designer.primaryId)} onFocus={() => designer.fitSelectionInView()}/>
        </ContextMenu>
        <PanelSummaryFooter parts={[
            plural(summary.total, 'elemento', 'elementos'),
            plural(designer.selectedIds.size, 'selecionado', 'selecionados'),
            summary.hidden > 0 && plural(summary.hidden, 'oculto', 'ocultos'),
            summary.locked > 0 && plural(summary.locked, 'bloqueado', 'bloqueados'),
        ]}/>
      </div>
    </GuiLayersContext.Provider>);
}
