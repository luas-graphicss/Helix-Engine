'use client';
import { useRef, type DragEvent } from 'react';
import { ArrowDownToLine, ArrowLeftToLine, ArrowRightToLine, Maximize2, PanelTopClose, RotateCcw, X } from 'lucide-react';
import { DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import type { TabDefinition } from '@/engine/ui/tab-strip';
import { MenuShortcut } from '@/engine/editor/menus/menu-shortcut';
import { MENU_ITEM_CLASS } from '@/engine/editor/menus/menu-styles';
import { ResizeHandle } from './resize-handle';
import { useResizableSize } from './use-resizable-size';
import { PanelFrame } from './panel-frame';
import { DOCK_AREA_LABELS, DOCK_AREA_LIMITS, DOCK_AREAS, type DockArea, type DockPanelId } from './dock-layout';
import { useDockLayout } from './dock-layout-context';
import { DOCK_PANELS, panelLabel } from './dock-panels';
import { useEditorSession, useSessionSelector } from '@/engine/editor/session/editor-session-context';
import type { EditorSession } from '@/engine/editor/session/editor-session';
const WORKSPACE_TOPICS = ['workspace'] as const;
const selectWorkspace = (session: EditorSession) => session.workspace;
export const DOCK_DRAG_TYPE = 'application/x-helix-dock-panel';
export function readDraggedPanel(event: DragEvent<HTMLElement>): DockPanelId | null {
    const id = event.dataTransfer.getData(DOCK_DRAG_TYPE);
    return id && id in DOCK_PANELS ? (id as DockPanelId) : null;
}
export function isPanelDrag(event: DragEvent<HTMLElement>): boolean {
    return Array.from(event.dataTransfer.types).includes(DOCK_DRAG_TYPE);
}
const AREA_ICON = { left: ArrowLeftToLine, right: ArrowRightToLine, bottom: ArrowDownToLine } as const;
type DockAreaViewProps = {
    area: DockArea;
    axis: 'horizontal' | 'vertical';
    inverted?: boolean;
    handleSide: 'before' | 'after';
    className?: string;
};
export function DockAreaView({ area, axis, inverted = false, handleSide, className }: DockAreaViewProps) {
    const [layout, dock] = useDockLayout();
    const session = useEditorSession();
    const workspace = useSessionSelector(selectWorkspace, { topics: WORKSPACE_TOPICS });
    const state = layout.areas[area];
    const limits = DOCK_AREA_LIMITS[area];
    const asideRef = useRef<HTMLElement>(null);
    const { viewportGovernor } = session;
    const resize = useResizableSize({
        ...limits,
        axis,
        inverted,
        size: state.size,
        onSizeChange: (size) => dock.setSize(area, size),
        measure: () => (asideRef.current ? (axis === 'horizontal' ? asideRef.current.offsetWidth : asideRef.current.offsetHeight) : undefined),
        onResizingChange: (resizing) => viewportGovernor.setResizing(resizing),
    });
    const markUiActivity = () => viewportGovernor.markUiActivity();
    if (state.panels.length === 0)
        return null;
    const tabs: TabDefinition[] = state.panels.map((id) => ({ id, label: panelLabel(id, workspace), icon: DOCK_PANELS[id].icon }));
    const active = state.active ?? state.panels[0];
    const activePanel = DOCK_PANELS[active];
    const otherAreas = DOCK_AREAS.filter((candidate) => candidate !== area);
    const handle = (<ResizeHandle axis={axis} active={resize.isResizing} label={`Redimensionar painel ${DOCK_AREA_LABELS[area].toLowerCase()}`} {...resize.handleProps}/>);
    const menu = (<>
      <DropdownMenuGroup>
        <DropdownMenuItem className={MENU_ITEM_CLASS} onClick={() => dock.close(active)}>
          <X aria-hidden/>
          Fechar {panelLabel(active, workspace)}
          {activePanel.shortcut && <MenuShortcut action={activePanel.shortcut}/>}
        </DropdownMenuItem>
        {state.panels.length > 1 && (<DropdownMenuItem className={MENU_ITEM_CLASS} onClick={() => dock.closeArea(area)}>
            <PanelTopClose aria-hidden/>
            Fechar grupo ({state.panels.length} painéis)
          </DropdownMenuItem>)}
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        {otherAreas.map((target) => {
            const Icon = AREA_ICON[target];
            return (<DropdownMenuItem key={target} className={MENU_ITEM_CLASS} onClick={() => dock.move(active, target)}>
              <Icon aria-hidden/>
              Mover para a {DOCK_AREA_LABELS[target].toLowerCase()}
            </DropdownMenuItem>);
        })}
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuItem className={MENU_ITEM_CLASS} onClick={() => dock.maximizeViewport()}>
          <Maximize2 aria-hidden/>
          Maximizar viewport
          <MenuShortcut action="panel.maximize"/>
        </DropdownMenuItem>
        <DropdownMenuItem className={MENU_ITEM_CLASS} onClick={() => dock.reset()}>
          <RotateCcw aria-hidden/>
          Restaurar layout padrão
        </DropdownMenuItem>
      </DropdownMenuGroup>
    </>);
    const frame = (<PanelFrame tabs={tabs} activeTabId={active} onActiveTabChange={(id) => dock.setActive(area, id as DockPanelId)} renderTab={(id) => DOCK_PANELS[id as DockPanelId].render()} onCloseTab={(id) => dock.close(id as DockPanelId)} menu={menu} onDragTab={(id, event) => {
            if (id)
                event.dataTransfer.setData(DOCK_DRAG_TYPE, id);
            dock.setDragging(id as DockPanelId | null);
        }} canDropTab={isPanelDrag} onDropTab={(event) => {
            const id = readDraggedPanel(event);
            if (id)
                dock.move(id, area);
            dock.setDragging(null);
        }}/>);
    const sizeStyle = axis === 'horizontal' ? { width: resize.size, maxWidth: '30%' } : { height: resize.size, maxHeight: '45%' };
    return (<>
      {handleSide === 'before' && handle}
      <aside ref={asideRef} className={className ?? 'flex shrink-0 flex-col'} style={sizeStyle} aria-label={`Painéis à ${DOCK_AREA_LABELS[area].toLowerCase()}`} onPointerMoveCapture={markUiActivity} onWheelCapture={markUiActivity} onKeyDownCapture={markUiActivity}>
        {frame}
      </aside>
      {handleSide === 'after' && handle}
    </>);
}
