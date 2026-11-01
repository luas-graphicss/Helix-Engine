'use client';
import { Maximize2, Minimize2, RotateCcw } from 'lucide-react';
import { DropdownMenuCheckboxItem, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { MenuShortcut } from '@/engine/editor/menus/menu-shortcut';
import { MENU_ITEM_CLASS } from '@/engine/editor/menus/menu-styles';
import { DOCK_PANEL_IDS } from './dock-layout';
import { useDockLayout } from './dock-layout-context';
import { DOCK_PANELS } from './dock-panels';
export function PanelsMenuItems() {
    const [layout, dock] = useDockLayout();
    return (<>
      <DropdownMenuGroup>
        <DropdownMenuLabel className="px-2 py-1 font-mono text-3xs tracking-wider text-muted-foreground uppercase">Painéis</DropdownMenuLabel>
        {DOCK_PANEL_IDS.map((id) => {
            const panel = DOCK_PANELS[id];
            const Icon = panel.icon;
            return (<DropdownMenuCheckboxItem key={id} className={MENU_ITEM_CLASS} checked={dock.isOpen(id)} onCheckedChange={() => dock.toggle(id)}>
              <Icon aria-hidden/>
              {panel.label}
              {panel.shortcut && <MenuShortcut action={panel.shortcut}/>}
            </DropdownMenuCheckboxItem>);
        })}
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuItem className={MENU_ITEM_CLASS} onClick={() => dock.toggleMaximized()}>
          {layout.maximized ? <Minimize2 aria-hidden/> : <Maximize2 aria-hidden/>}
          {layout.maximized ? 'Restaurar painéis' : 'Maximizar viewport'}
          <MenuShortcut action="panel.maximize"/>
        </DropdownMenuItem>
        <DropdownMenuItem className={MENU_ITEM_CLASS} onClick={() => dock.reset()}>
          <RotateCcw aria-hidden/>
          Restaurar layout padrão
        </DropdownMenuItem>
      </DropdownMenuGroup>
    </>);
}
