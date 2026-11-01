'use client';
import { Eclipse, Lightbulb, LightbulbOff, Plus } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { LIGHT_HELPER_MODE_LABEL, LIGHT_HELPER_MODES, type LightHelperMode } from '@/engine/renderer/passes/light-helper-pass';
import { IconButton } from '@/engine/ui/icon-button';
import { SearchField } from '@/engine/ui/search-field';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { MENU_CONTENT_CLASS, MENU_ITEM_CLASS, MENU_LABEL_CLASS } from '@/engine/editor/menus/menu-styles';
import { AddLightMenu } from './add-light-menu';
type LightsToolbarProps = {
    query: string;
    onQueryChange: (query: string) => void;
};
const TOOL_BUTTON_CLASS = 'size-6 [&_svg]:size-3.5';
export function LightsToolbar({ query, onQueryChange }: LightsToolbarProps) {
    const session = useEditorSession();
    const helpers = session.render.lightHelpers;
    return (<div className="flex h-8 shrink-0 items-center gap-1 border-b border-border px-1.5">
      <AddLightMenu trigger={<button type="button" aria-label="Adicionar luz" title="Adicionar luz (tipos e presets)" className="inline-flex size-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-highlight hover:text-foreground [&_svg]:size-3.5"/>}>
        <Plus />
      </AddLightMenu>
      <SearchField placeholder="Filtrar luzes" value={query} onChange={onQueryChange}/>
      <DropdownMenu>
        <DropdownMenuTrigger render={<IconButton label={`Luzes no viewport: ${LIGHT_HELPER_MODE_LABEL[helpers].toLowerCase()}`} size="sm" active={helpers !== 'off'} className={TOOL_BUTTON_CLASS}/>}>
          {helpers === 'off' ? <LightbulbOff /> : <Lightbulb />}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className={`${MENU_CONTENT_CLASS} w-56`}>
          <DropdownMenuRadioGroup value={helpers} onValueChange={(value) => session.setLightHelpers(value as LightHelperMode)}>
            <DropdownMenuGroup>
              <DropdownMenuLabel className={MENU_LABEL_CLASS}>Luzes desenhadas no viewport</DropdownMenuLabel>
              {LIGHT_HELPER_MODES.map((mode) => (<DropdownMenuRadioItem key={mode} className={MENU_ITEM_CLASS} value={mode}>
                  {LIGHT_HELPER_MODE_LABEL[mode]}
                </DropdownMenuRadioItem>))}
            </DropdownMenuGroup>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <IconButton label={session.shadowsEnabled ? 'Sombras ligadas no viewport' : 'Sombras desligadas no viewport'} size="sm" active={session.shadowsEnabled} className={TOOL_BUTTON_CLASS} onClick={() => session.toggleShadows()}>
        <Eclipse />
      </IconButton>
    </div>);
}
