'use client';
import { ChevronDown, WandSparkles } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { LIGHT_PRESETS, type LightPresetId } from '@/engine/core/scene/light-presets';
import { LOCAL_LIGHT_LABEL } from '@/engine/core/scene/light';
import { LIGHT_ICON } from '@/engine/editor/lights/light-icons';
import { MENU_CONTENT_CLASS, MENU_ITEM_CLASS, MENU_LABEL_CLASS } from '@/engine/editor/menus/menu-styles';
type LightPresetsMenuProps = {
    label?: string;
    onPick: (presetId: LightPresetId) => void;
};
export function LightPresetsMenu({ label = 'Presets', onPick }: LightPresetsMenuProps) {
    return (<DropdownMenu>
      <DropdownMenuTrigger render={<button type="button" className="flex h-5 items-center gap-1 rounded-sm border border-border px-1.5 text-3xs font-medium text-muted-foreground transition-colors hover:bg-highlight hover:text-foreground [&_svg]:size-3"/>}>
        <WandSparkles aria-hidden/>
        {label}
        <ChevronDown aria-hidden className="text-muted-foreground"/>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={`${MENU_CONTENT_CLASS} w-72`}>
        <DropdownMenuGroup>
          <DropdownMenuLabel className={MENU_LABEL_CLASS}>Presets de luz</DropdownMenuLabel>
          {LIGHT_PRESETS.map((preset) => {
            const Icon = LIGHT_ICON[preset.type];
            return (<DropdownMenuItem key={preset.id} className={`${MENU_ITEM_CLASS} items-start py-1.5`} onClick={() => onPick(preset.id)}>
                <Icon aria-hidden className="mt-0.5"/>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span>
                    {preset.label} <span className="text-muted-foreground">· {LOCAL_LIGHT_LABEL[preset.type].toLowerCase()}</span>
                  </span>
                  <span className="text-3xs leading-relaxed text-pretty text-muted-foreground">{preset.description}</span>
                </span>
              </DropdownMenuItem>);
        })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>);
}
