'use client';
import { ChevronDown, Eye, Grid2x2, Grid3x3, Magnet, Maximize, Minus, Plus, Ruler, Scan, Shield, Spline, SquareDashed } from 'lucide-react';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuTrigger, } from '@/components/ui/dropdown-menu';
import { MenuShortcut } from '@/engine/editor/menus/menu-shortcut';
import { MENU_CONTENT_CLASS, MENU_ITEM_CLASS, MENU_LABEL_CLASS, MENU_SHORTCUT_CLASS } from '@/engine/editor/menus/menu-styles';
import { IconButton } from '@/engine/ui/icon-button';
import { GUI_ZOOM_LEVELS } from '../gui-designer';
import { formatSafeArea } from './device/gui-device-format';
import { useGuiDesigner } from './use-gui-designer';
const GRID_SIZES = [4, 8, 16, 32, 64];
export function formatZoom(zoom: number): string {
    return `${Math.round(zoom * 100)}%`;
}
export function GuiZoomControls() {
    const designer = useGuiDesigner();
    const physicalZoom = designer.physicalSizeZoom;
    return (<div className="flex items-center gap-0.5">
      <IconButton label="Afastar (Ctrl+−)" size="sm" onClick={() => designer.zoomStepAtCenter(-1)}>
        <Minus />
      </IconButton>
      <DropdownMenu>
        <DropdownMenuTrigger render={<button type="button" title="Zoom" className="flex h-6 w-16 items-center justify-center gap-1 rounded-sm font-mono text-2xs tabular-nums text-foreground transition-colors hover:bg-highlight data-[popup-open]:bg-highlight"/>}>
          {formatZoom(designer.view.zoom)}
          <ChevronDown className="size-3 text-muted-foreground" aria-hidden/>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={4} className={MENU_CONTENT_CLASS}>
          <DropdownMenuGroup>
            <DropdownMenuItem className={MENU_ITEM_CLASS} onClick={() => designer.fitAll()}>
              <Maximize aria-hidden/>
              Enquadrar tela
              <MenuShortcut action="gui.fitAll"/>
            </DropdownMenuItem>
            <DropdownMenuItem className={MENU_ITEM_CLASS} disabled={designer.selectedIds.size === 0} onClick={() => designer.fitSelectionInView()}>
              <Scan aria-hidden/>
              Enquadrar seleção
              <MenuShortcut action="gui.fitSelection"/>
            </DropdownMenuItem>
            <DropdownMenuItem className={MENU_ITEM_CLASS} onClick={() => designer.zoomAtCenter(1)}>
              <Eye aria-hidden/>
              Zoom 100%
              <MenuShortcut action="gui.zoomReset"/>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel className={MENU_LABEL_CLASS}>Aparelho emulado</DropdownMenuLabel>
            <DropdownMenuItem className={MENU_ITEM_CLASS} onClick={() => designer.zoomToDevicePixels()}>
              <Grid2x2 aria-hidden/>
              Pixels do aparelho (1:1)
              <DropdownMenuShortcut className={MENU_SHORTCUT_CLASS}>{formatZoom(designer.devicePixelZoom)}</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem className={MENU_ITEM_CLASS} disabled={physicalZoom === null} onClick={() => designer.zoomToPhysicalSize()}>
              <Ruler aria-hidden/>
              Tamanho físico real
              <DropdownMenuShortcut className={MENU_SHORTCUT_CLASS}>{physicalZoom === null ? 'densidade desconhecida' : formatZoom(physicalZoom)}</DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup value={String(designer.view.zoom)} onValueChange={(value) => designer.zoomAtCenter(Number(value))}>
            <DropdownMenuGroup>
              {GUI_ZOOM_LEVELS.map((level) => (<DropdownMenuRadioItem key={level} className={MENU_ITEM_CLASS} value={String(level)}>
                  {formatZoom(level)}
                </DropdownMenuRadioItem>))}
            </DropdownMenuGroup>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <IconButton label="Aproximar (Ctrl+=)" size="sm" onClick={() => designer.zoomStepAtCenter(1)}>
        <Plus />
      </IconButton>
    </div>);
}
export function GuiViewOptionsMenu() {
    const designer = useGuiDesigner();
    const { options } = designer;
    return (<DropdownMenu>
      <DropdownMenuTrigger render={<button type="button" title="Opções do canvas" aria-label="Opções do canvas" className="inline-flex size-6 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-highlight hover:text-foreground data-[popup-open]:bg-highlight data-[popup-open]:text-foreground"/>}>
        <Eye className="size-4" aria-hidden/>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={4} className={MENU_CONTENT_CLASS}>
        <DropdownMenuGroup>
          <DropdownMenuLabel className={MENU_LABEL_CLASS}>Encaixe</DropdownMenuLabel>
          <DropdownMenuCheckboxItem className={MENU_ITEM_CLASS} checked={options.snapGuides} onCheckedChange={() => designer.toggleOption('snapGuides')}>
            <Spline aria-hidden/>
            Guias inteligentes
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem className={MENU_ITEM_CLASS} checked={options.snapGrid} onCheckedChange={() => designer.toggleOption('snapGrid')}>
            <Magnet aria-hidden/>
            Encaixar na grade
          </DropdownMenuCheckboxItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel className={MENU_LABEL_CLASS}>Exibir</DropdownMenuLabel>
          <DropdownMenuCheckboxItem className={MENU_ITEM_CLASS} checked={options.grid} onCheckedChange={() => designer.toggleOption('grid')}>
            <Grid3x3 aria-hidden/>
            Grade
            <MenuShortcut action="gui.toggleGrid"/>
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem className={MENU_ITEM_CLASS} checked={options.rulers} onCheckedChange={() => designer.toggleOption('rulers')}>
            <Ruler aria-hidden/>
            Réguas
            <MenuShortcut action="gui.toggleRulers"/>
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem className={MENU_ITEM_CLASS} checked={options.outlines} onCheckedChange={() => designer.toggleOption('outlines')}>
            <SquareDashed aria-hidden/>
            Contornos de todos os elementos
            <MenuShortcut action="gui.toggleOutlines"/>
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem className={MENU_ITEM_CLASS} checked={options.safeArea} onCheckedChange={() => designer.toggleOption('safeArea')}>
            <Shield aria-hidden/>
            {designer.followsReference ? 'Área segura (margem de 5%)' : `Área segura · ${formatSafeArea(designer.screen.safeArea) ?? 'nenhuma'}`}
            <MenuShortcut action="gui.toggleSafeArea"/>
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem className={MENU_ITEM_CLASS} checked={options.checkerboard} onCheckedChange={() => designer.toggleOption('checkerboard')}>
            <Grid3x3 aria-hidden/>
            Fundo xadrez (transparência)
          </DropdownMenuCheckboxItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={String(options.gridSize)} onValueChange={(value) => designer.setOption('gridSize', Number(value))}>
          <DropdownMenuGroup>
            <DropdownMenuLabel className={MENU_LABEL_CLASS}>Passo da grade</DropdownMenuLabel>
            {GRID_SIZES.map((size) => (<DropdownMenuRadioItem key={size} className={MENU_ITEM_CLASS} value={String(size)}>
                {size} px
              </DropdownMenuRadioItem>))}
          </DropdownMenuGroup>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>);
}
