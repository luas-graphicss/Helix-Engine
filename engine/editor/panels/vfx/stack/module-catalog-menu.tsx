'use client';
import { Fragment, type ReactElement } from 'react';
import { Plus } from 'lucide-react';
import { ContextMenuGroup, ContextMenuItem, ContextMenuLabel, ContextMenuSeparator, ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger } from '@/components/ui/context-menu';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { VFX_MODULE_CATALOG, VFX_MODULE_CATEGORY_LABEL, type VfxModuleCategory, type VfxModuleInfo, type VfxModuleKind } from '@/engine/vfx/document/vfx-document';
import { MENU_CONTENT_CLASS, MENU_ITEM_CLASS, MENU_LABEL_CLASS } from '@/engine/editor/menus/menu-styles';
const CATEGORIES: readonly VfxModuleCategory[] = ['appearance', 'motion', 'forces', 'world'];
interface ModuleGroup {
    readonly category: VfxModuleCategory;
    readonly label: string;
    readonly modules: readonly VfxModuleInfo[];
}
const MODULE_GROUPS: readonly ModuleGroup[] = CATEGORIES.map((category) => ({
    category,
    label: VFX_MODULE_CATEGORY_LABEL[category],
    modules: VFX_MODULE_CATALOG.filter((info) => info.category === category),
}));
const ENTRY_CLASS = `${MENU_ITEM_CLASS} flex-col items-start gap-0 py-1`;
const CONTENT_CLASS = `${MENU_CONTENT_CLASS} w-72`;
function ModuleEntry({ info }: {
    info: VfxModuleInfo;
}) {
    return (<>
      <span>{info.label}</span>
      <span className="text-3xs leading-relaxed text-pretty text-muted-foreground">{info.description}</span>
    </>);
}
type AddModuleMenuProps = {
    onPick: (kind: VfxModuleKind) => void;
    trigger: ReactElement;
    children?: React.ReactNode;
    align?: 'start' | 'end';
};
export function AddModuleMenu({ onPick, trigger, children, align = 'end' }: AddModuleMenuProps) {
    return (<DropdownMenu>
      <DropdownMenuTrigger render={trigger}>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align={align} className={CONTENT_CLASS}>
        {MODULE_GROUPS.map((group, index) => (<Fragment key={group.category}>
            {index > 0 && <DropdownMenuSeparator />}
            <DropdownMenuGroup>
              <DropdownMenuLabel className={MENU_LABEL_CLASS}>{group.label}</DropdownMenuLabel>
              {group.modules.map((info) => (<DropdownMenuItem key={info.kind} className={ENTRY_CLASS} onClick={() => onPick(info.kind)}>
                  <ModuleEntry info={info}/>
                </DropdownMenuItem>))}
            </DropdownMenuGroup>
          </Fragment>))}
      </DropdownMenuContent>
    </DropdownMenu>);
}
export function AddModuleSubmenu({ onPick }: {
    onPick: (kind: VfxModuleKind) => void;
}) {
    return (<ContextMenuSub>
      <ContextMenuSubTrigger className={MENU_ITEM_CLASS}>
        <Plus aria-hidden/>
        Adicionar módulo
      </ContextMenuSubTrigger>
      <ContextMenuSubContent className={CONTENT_CLASS}>
        {MODULE_GROUPS.map((group, index) => (<Fragment key={group.category}>
            {index > 0 && <ContextMenuSeparator />}
            <ContextMenuGroup>
              <ContextMenuLabel className={MENU_LABEL_CLASS}>{group.label}</ContextMenuLabel>
              {group.modules.map((info) => (<ContextMenuItem key={info.kind} className={ENTRY_CLASS} onClick={() => onPick(info.kind)}>
                  <ModuleEntry info={info}/>
                </ContextMenuItem>))}
            </ContextMenuGroup>
          </Fragment>))}
      </ContextMenuSubContent>
    </ContextMenuSub>);
}
