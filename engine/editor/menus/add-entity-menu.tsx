'use client';
import type { ReactElement, ReactNode } from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger, } from '@/components/ui/dropdown-menu';
import { ContextMenuGroup, ContextMenuItem, ContextMenuLabel, ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger, } from '@/components/ui/context-menu';
import { Plus } from 'lucide-react';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { ADD_MENU_GROUPS } from './add-entity-model';
import { MENU_CONTENT_CLASS, MENU_ITEM_CLASS, MENU_LABEL_CLASS } from './menu-styles';
type AddEntityMenuProps = {
    trigger: ReactElement;
    children: ReactNode;
};
export function AddEntityMenu({ trigger, children }: AddEntityMenuProps) {
    const session = useEditorSession();
    return (<DropdownMenu>
      <DropdownMenuTrigger render={trigger}>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className={MENU_CONTENT_CLASS}>
        {ADD_MENU_GROUPS.map((group) => (<DropdownMenuGroup key={group.id}>
            <DropdownMenuLabel className={MENU_LABEL_CLASS}>{group.label}</DropdownMenuLabel>
            {group.entries.map((entry) => (<DropdownMenuItem key={entry.id} className={MENU_ITEM_CLASS} onClick={() => entry.run(session)}>
                <entry.icon aria-hidden/>
                {entry.label}
              </DropdownMenuItem>))}
          </DropdownMenuGroup>))}
      </DropdownMenuContent>
    </DropdownMenu>);
}
export function AddEntitySubmenu() {
    const session = useEditorSession();
    return (<ContextMenuSub>
      <ContextMenuSubTrigger className={MENU_ITEM_CLASS}>
        <Plus aria-hidden/>
        Adicionar
      </ContextMenuSubTrigger>
      <ContextMenuSubContent className={MENU_CONTENT_CLASS}>
        {ADD_MENU_GROUPS.map((group) => (<ContextMenuGroup key={group.id}>
            <ContextMenuLabel className={MENU_LABEL_CLASS}>{group.label}</ContextMenuLabel>
            {group.entries.map((entry) => (<ContextMenuItem key={entry.id} className={MENU_ITEM_CLASS} onClick={() => entry.run(session)}>
                <entry.icon aria-hidden/>
                {entry.label}
              </ContextMenuItem>))}
          </ContextMenuGroup>))}
      </ContextMenuSubContent>
    </ContextMenuSub>);
}
