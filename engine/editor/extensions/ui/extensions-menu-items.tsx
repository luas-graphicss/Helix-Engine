'use client';
import { Blocks, FilePlus2, RefreshCw } from 'lucide-react';
import { DropdownMenuGroup, DropdownMenuItem, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger } from '@/components/ui/dropdown-menu';
import { useDockLayoutStore } from '@/engine/editor/layout/dock-layout-context';
import { MENU_CONTENT_CLASS, MENU_ITEM_CLASS } from '@/engine/editor/menus/menu-styles';
import { NewExtensionMenuItems } from './new-extension-menu-items';
import { useExtensionHost } from './use-extension-host';
export function ExtensionsMenuItems() {
    const dock = useDockLayoutStore();
    const host = useExtensionHost();
    return (<DropdownMenuGroup>
      <DropdownMenuItem className={MENU_ITEM_CLASS} onClick={() => dock.reveal('extensions')}>
        <Blocks aria-hidden/>
        Gerenciar extensões
      </DropdownMenuItem>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger className={MENU_ITEM_CLASS}>
          <FilePlus2 aria-hidden/>
          Nova extensão
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className={`${MENU_CONTENT_CLASS} w-72`}>
          <NewExtensionMenuItems />
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuItem className={MENU_ITEM_CLASS} disabled={!host.trusted || host.entries.length === 0} onClick={() => host.reloadAll()}>
        <RefreshCw aria-hidden/>
        Recarregar extensões
      </DropdownMenuItem>
    </DropdownMenuGroup>);
}
