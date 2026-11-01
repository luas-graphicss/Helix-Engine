'use client';
import { ChevronDown, WandSparkles } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MENU_CONTENT_CLASS, MENU_ITEM_CLASS, MENU_LABEL_CLASS } from '@/engine/editor/menus/menu-styles';
export interface AudioPresetOption {
    readonly id: string;
    readonly label: string;
    readonly description: string;
}
type AudioPresetsMenuProps = {
    title: string;
    presets: readonly AudioPresetOption[];
    onPick: (presetId: string) => void;
    label?: string;
};
export function AudioPresetsMenu({ title, presets, onPick, label = 'Presets' }: AudioPresetsMenuProps) {
    return (<DropdownMenu>
      <DropdownMenuTrigger render={<button type="button" className="flex h-5 items-center gap-1 rounded-sm border border-border px-1.5 text-3xs font-medium text-muted-foreground transition-colors hover:bg-highlight hover:text-foreground [&_svg]:size-3"/>}>
        <WandSparkles aria-hidden/>
        {label}
        <ChevronDown aria-hidden className="text-muted-foreground"/>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={`${MENU_CONTENT_CLASS} w-72`}>
        <DropdownMenuGroup>
          <DropdownMenuLabel className={MENU_LABEL_CLASS}>{title}</DropdownMenuLabel>
          {presets.map((preset) => (<DropdownMenuItem key={preset.id} className={`${MENU_ITEM_CLASS} flex-col items-start gap-0 py-1.5`} onClick={() => onPick(preset.id)}>
              <span>{preset.label}</span>
              <span className="text-3xs leading-relaxed text-pretty text-muted-foreground">{preset.description}</span>
            </DropdownMenuItem>))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>);
}
