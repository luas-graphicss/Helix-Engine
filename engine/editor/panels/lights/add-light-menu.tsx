'use client';
import type { ReactElement, ReactNode } from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { LIGHT_PRESETS } from '@/engine/core/scene/light-presets';
import { LOCAL_LIGHT_SHORT_LABEL } from '@/engine/core/scene/light';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { LIGHT_ICON } from '@/engine/editor/lights/light-icons';
import { LIGHT_ADD_GROUP } from '@/engine/editor/menus/add-entity-model';
import { MENU_CONTENT_CLASS, MENU_ITEM_CLASS, MENU_LABEL_CLASS } from '@/engine/editor/menus/menu-styles';
import { addLightFromPreset } from '@/engine/editor/operations/entity-operations';
type AddLightMenuProps = {
    trigger: ReactElement;
    children: ReactNode;
    align?: 'start' | 'end';
};
export function AddLightMenu({ trigger, children, align = 'start' }: AddLightMenuProps) {
    const session = useEditorSession();
    return (<DropdownMenu>
      <DropdownMenuTrigger render={trigger}>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align={align} className={`${MENU_CONTENT_CLASS} grid w-[30rem] grid-cols-2 gap-x-1`}>
        <DropdownMenuGroup>
          <DropdownMenuLabel className={MENU_LABEL_CLASS}>Tipos</DropdownMenuLabel>
          {LIGHT_ADD_GROUP.entries.map((entry) => (<DropdownMenuItem key={entry.id} className={`${MENU_ITEM_CLASS} items-start py-1.5`} onClick={() => entry.run(session)}>
              <entry.icon aria-hidden className="mt-0.5"/>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span>{entry.label}</span>
                {entry.description && <span className="text-3xs leading-relaxed text-pretty text-muted-foreground">{entry.description}</span>}
              </span>
            </DropdownMenuItem>))}
        </DropdownMenuGroup>
        <DropdownMenuGroup>
          <DropdownMenuLabel className={MENU_LABEL_CLASS}>Presets prontos</DropdownMenuLabel>
          {LIGHT_PRESETS.map((preset) => {
            const Icon = LIGHT_ICON[preset.type];
            return (<DropdownMenuItem key={preset.id} className={`${MENU_ITEM_CLASS} py-1`} onClick={() => addLightFromPreset(session, preset.id)}>
                <Icon aria-hidden/>
                <span className="flex min-w-0 flex-1 items-baseline justify-between gap-2">
                  <span className="truncate">{preset.label}</span>
                  <span className="shrink-0 text-3xs text-muted-foreground">{LOCAL_LIGHT_SHORT_LABEL[preset.type]}</span>
                </span>
              </DropdownMenuItem>);
        })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>);
}
