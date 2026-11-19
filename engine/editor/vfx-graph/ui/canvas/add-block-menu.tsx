'use client';
import { Plus } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MENU_CONTENT_CLASS, MENU_ITEM_CLASS, MENU_LABEL_CLASS } from '@/engine/editor/menus/menu-styles';
import { BLOCK_CATEGORY_LABEL, blocksForStage } from '@/engine/vfx-graph/blocks/block-catalog';
import { BLOCK_CATEGORIES } from '@/engine/vfx-graph/blocks/block-definition';
import type { ContextKind } from '@/engine/vfx-graph/document/effect-document';
import { FOCUS_RING_CLASS } from '@/engine/ui/surface-styles';
import { cn } from '@/lib/utils';
type AddBlockMenuProps = {
    stage: ContextKind;
    onAdd: (type: string) => void;
};
export function AddBlockMenu({ stage, onAdd }: AddBlockMenuProps) {
    const blocks = blocksForStage(stage);
    return (<DropdownMenu>
      <DropdownMenuTrigger render={<button type="button" className={cn('flex h-full w-full items-center gap-1.5 rounded-b-sm px-2 text-2xs text-muted-foreground transition-colors duration-100 hover:bg-highlight hover:text-foreground', FOCUS_RING_CLASS)}/>}>
        <Plus className="size-3" aria-hidden/>
        Bloco
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className={cn(MENU_CONTENT_CLASS, 'max-h-80 overflow-y-auto')}>
        {BLOCK_CATEGORIES.map((category) => {
            const items = blocks.filter((definition) => definition.category === category);
            if (items.length === 0)
                return null;
            return (<DropdownMenuGroup key={category}>
              <DropdownMenuLabel className={MENU_LABEL_CLASS}>{BLOCK_CATEGORY_LABEL[category]}</DropdownMenuLabel>
              {items.map((definition) => (<DropdownMenuItem key={definition.type} className={MENU_ITEM_CLASS} title={definition.description} onClick={() => onAdd(definition.type)}>
                  {definition.label}
                </DropdownMenuItem>))}
            </DropdownMenuGroup>);
        })}
      </DropdownMenuContent>
    </DropdownMenu>);
}
