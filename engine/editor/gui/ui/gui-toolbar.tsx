'use client';
import { ChevronDown, Download, Hand, MousePointer2, Play, Save, Shapes, X } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { GUI_ELEMENT_LABELS, type GuiElementKind } from '@/engine/gui/document/gui-document';
import { MenuShortcut } from '@/engine/editor/menus/menu-shortcut';
import { MENU_CONTENT_CLASS, MENU_ITEM_CLASS } from '@/engine/editor/menus/menu-styles';
import { closeGuiDesigner, exportGuiDocument, saveGuiDesignerDocument } from '@/engine/editor/operations/gui-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { useShortcutHint } from '@/engine/editor/shortcuts/shortcut-bindings';
import { guiToolAction } from '@/engine/editor/shortcuts/tool-actions';
import { IconButton } from '@/engine/ui/icon-button';
import { SegmentedControl } from '@/engine/ui/segmented-control';
import { ToolbarSeparator } from '@/engine/ui/toolbar-separator';
import { cn } from '@/lib/utils';
import type { GuiDesignerMode } from '../gui-designer';
import { GuiDevicePicker } from './device/gui-device-picker';
import { GUI_ELEMENT_ICONS } from './gui-element-icons';
import { GuiViewOptionsMenu, GuiZoomControls } from './gui-view-menus';
import { useGuiDesigner } from './use-gui-designer';
const PRIMARY_TOOLS: readonly GuiElementKind[] = ['frame', 'text', 'image', 'icon', 'button'];
const SECONDARY_TOOLS: readonly GuiElementKind[] = ['toggle', 'slider', 'progress', 'input', 'scroll', 'divider', 'video', 'viewport'];
const MODES: ReadonlyArray<{
    value: GuiDesignerMode;
    label: string;
}> = [
    { value: 'design', label: 'Design' },
    { value: 'preview', label: 'Testar' },
];
export function GuiToolbar() {
    const session = useEditorSession();
    const designer = useGuiDesigner();
    const hint = useShortcutHint();
    const { document } = designer;
    if (!document)
        return null;
    const secondaryActive = SECONDARY_TOOLS.find((kind) => kind === designer.tool) ?? null;
    const SecondaryIcon = secondaryActive ? GUI_ELEMENT_ICONS[secondaryActive] : Shapes;
    const withKey = (text: string, kind: GuiElementKind | 'select' | 'hand') => hint(text, guiToolAction(kind));
    return (<div className="flex min-h-toolbar shrink-0 flex-wrap items-center gap-x-0.5 gap-y-0.5 border-b border-border bg-surface bg-linear-to-b from-bevel to-transparent px-1.5 py-0.5 shadow-bevel">
      <div className="flex max-w-48 min-w-0 items-center gap-1.5 pr-1">
        <span className="truncate text-2xs font-semibold text-foreground" title={document.name}>
          {document.name}
        </span>
        <span className={cn('size-1.5 shrink-0 rounded-full', designer.dirty ? 'bg-warning' : 'bg-transparent')} aria-label={designer.dirty ? 'Alterações não salvas' : undefined} title={designer.dirty ? hint('Alterações não salvas', 'gui.save') : 'Salva na biblioteca'}/>
      </div>
      <IconButton label={hint('Salvar na biblioteca', 'gui.save')} size="sm" disabled={!designer.dirty} onClick={() => void saveGuiDesignerDocument(session)}>
        <Save />
      </IconButton>
      <IconButton label="Exportar arquivo .hxgui" size="sm" onClick={() => exportGuiDocument(document)}>
        <Download />
      </IconButton>
      <IconButton label="Fechar tela e voltar à cena" size="sm" onClick={() => void closeGuiDesigner(session)}>
        <X />
      </IconButton>

      <ToolbarSeparator />

      <div className="flex shrink-0 items-center gap-0.5 rounded-sm bg-surface-sunken p-0.5" role="radiogroup" aria-label="Ferramenta do canvas">
        <IconButton label={withKey('Selecionar', 'select')} active={designer.tool === 'select'} disabled={designer.mode === 'preview'} onClick={() => designer.setTool('select')}>
          <MousePointer2 />
        </IconButton>
        <IconButton label={`${withKey('Mão: arrastar a vista', 'hand')} ou segure Espaço`} active={designer.tool === 'hand'} disabled={designer.mode === 'preview'} onClick={() => designer.setTool('hand')}>
          <Hand />
        </IconButton>
        <span className="mx-0.5 h-4 w-px bg-border-strong" aria-hidden/>
        {PRIMARY_TOOLS.map((kind) => {
            const Icon = GUI_ELEMENT_ICONS[kind];
            return (<IconButton key={kind} label={`${withKey(GUI_ELEMENT_LABELS[kind], kind)}: clique ou desenhe no canvas`} active={designer.tool === kind} disabled={designer.mode === 'preview'} onClick={() => designer.setTool(kind)}>
              <Icon />
            </IconButton>);
        })}
        <DropdownMenu>
          <DropdownMenuTrigger render={<button type="button" title="Mais elementos" aria-label="Mais elementos" disabled={designer.mode === 'preview'} className={cn('inline-flex h-7 items-center justify-center gap-0.5 rounded-sm px-1 text-muted-foreground transition-colors hover:bg-highlight hover:text-foreground disabled:pointer-events-none disabled:opacity-40 data-[popup-open]:bg-highlight [&_svg]:size-4', secondaryActive && 'bg-primary/15 text-primary hover:bg-primary/20 hover:text-primary')}/>}>
            <SecondaryIcon aria-hidden/>
            <ChevronDown className="!size-3" aria-hidden/>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" sideOffset={4} className={MENU_CONTENT_CLASS}>
            <DropdownMenuGroup>
              {SECONDARY_TOOLS.map((kind) => {
            const Icon = GUI_ELEMENT_ICONS[kind];
            return (<DropdownMenuItem key={kind} className={MENU_ITEM_CLASS} onClick={() => designer.setTool(kind)}>
                    <Icon aria-hidden/>
                    {GUI_ELEMENT_LABELS[kind]}
                    <MenuShortcut action={guiToolAction(kind)}/>
                  </DropdownMenuItem>);
        })}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ToolbarSeparator />

      <div className="w-36 shrink-0" title={hint('Design edita a tela; Testar roda a interface como no jogo', 'gui.togglePreview')}>
        <SegmentedControl label="Modo do designer" options={MODES} value={designer.mode} onChange={(mode) => designer.setMode(mode)}/>
      </div>
      {designer.mode === 'preview' && <Play className="size-3.5 shrink-0 text-primary" aria-hidden/>}

      <ToolbarSeparator />

      <GuiDevicePicker />

      <div className="ml-auto flex shrink-0 items-center gap-0.5">
        <GuiZoomControls />
        <ToolbarSeparator />
        <GuiViewOptionsMenu />
      </div>
    </div>);
}
