'use client';
import type { ReactElement, ReactNode } from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { VFX_TEMPLATE_CATEGORIES, VFX_TEMPLATE_CATEGORY_LABEL, VFX_TEMPLATES, type VfxTemplate, type VfxTemplateCategory } from '@/engine/vfx/document/vfx-templates';
import { MENU_CONTENT_CLASS, MENU_ITEM_CLASS, MENU_LABEL_CLASS } from '@/engine/editor/menus/menu-styles';
interface TemplateGroup {
    readonly category: VfxTemplateCategory;
    readonly label: string;
    readonly templates: readonly VfxTemplate[];
}
const TEMPLATE_GROUPS: readonly TemplateGroup[] = VFX_TEMPLATE_CATEGORIES.map((category) => ({
    category,
    label: VFX_TEMPLATE_CATEGORY_LABEL[category],
    templates: VFX_TEMPLATES.filter((template) => template.category === category),
}));
const COLUMNS: readonly (readonly TemplateGroup[])[] = [TEMPLATE_GROUPS.slice(0, 2), TEMPLATE_GROUPS.slice(2, 4), TEMPLATE_GROUPS.slice(4)];
type VfxTemplateMenuProps = {
    onPick: (templateId: string) => void;
    trigger: ReactElement;
    children?: ReactNode;
    align?: 'start' | 'end';
};
export function VfxTemplateMenu({ onPick, trigger, children, align = 'end' }: VfxTemplateMenuProps) {
    return (<DropdownMenu>
      <DropdownMenuTrigger render={trigger}>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align={align} className={`${MENU_CONTENT_CLASS} grid w-[30rem] grid-cols-3 items-start gap-x-1 p-1.5`}>
        {COLUMNS.map((groups, column) => (<div key={column} className="flex min-w-0 flex-col">
            {groups.map((group) => (<DropdownMenuGroup key={group.category}>
                <DropdownMenuLabel className={`${MENU_LABEL_CLASS} pl-2`}>{group.label}</DropdownMenuLabel>
                {group.templates.map((template) => (<DropdownMenuItem key={template.id} className={`${MENU_ITEM_CLASS} pl-2`} title={template.description} onClick={() => onPick(template.id)}>
                    <span className="truncate">{template.label}</span>
                  </DropdownMenuItem>))}
              </DropdownMenuGroup>))}
          </div>))}
      </DropdownMenuContent>
    </DropdownMenu>);
}
