'use client';
import { ChevronDown, Grid2x2, Snowflake } from 'lucide-react';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger, } from '@/components/ui/dropdown-menu';
import { useEditorState } from '@/engine/editor/session/editor-session-context';
import { MENU_CONTENT_CLASS, MENU_ITEM_CLASS, MENU_LABEL_CLASS } from '@/engine/editor/menus/menu-styles';
import { MYRIAD_DEBUG_VIEW_HINTS, MYRIAD_DEBUG_VIEW_LABELS, MYRIAD_DEBUG_VIEWS, type MyriadDebugView, } from '@/engine/renderer/myriad/runtime/myriad-settings';
const VISUALIZATIONS = MYRIAD_DEBUG_VIEWS.filter((view) => view !== 'none');
export function ViewModeMenu() {
    const session = useEditorState();
    const { myriad } = session.render;
    const current = myriad.debugView;
    const debugging = current !== 'none';
    return (<DropdownMenu>
      <DropdownMenuTrigger render={<button type="button" aria-label="Modo de visualização" className={`flex h-6 items-center gap-1 rounded-sm px-2 text-2xs font-medium transition-colors hover:bg-highlight ${debugging ? 'text-primary' : 'text-foreground/90'}`}/>}>
        <span>{MYRIAD_DEBUG_VIEW_LABELS[current]}</span>
        <ChevronDown className="size-3 text-muted-foreground" aria-hidden/>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className={`${MENU_CONTENT_CLASS} w-72`}>
        <DropdownMenuRadioGroup value={current} onValueChange={(value) => session.updateMyriad({ debugView: value as MyriadDebugView })}>
          <DropdownMenuGroup>
            <DropdownMenuRadioItem className={MENU_ITEM_CLASS} value="none">
              {MYRIAD_DEBUG_VIEW_LABELS.none}
            </DropdownMenuRadioItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel className={MENU_LABEL_CLASS}>Geometria virtual</DropdownMenuLabel>
            {VISUALIZATIONS.map((view) => (<DropdownMenuRadioItem key={view} className={`${MENU_ITEM_CLASS} items-start py-1.5`} value={view} disabled={!myriad.enabled}>
                <span className="flex flex-col gap-0.5">
                  <span>{MYRIAD_DEBUG_VIEW_LABELS[view]}</span>
                  <span className="text-[10px] leading-relaxed text-pretty text-muted-foreground">{MYRIAD_DEBUG_VIEW_HINTS[view]}</span>
                </span>
              </DropdownMenuRadioItem>))}
          </DropdownMenuGroup>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuCheckboxItem className={MENU_ITEM_CLASS} checked={myriad.wireframe} disabled={!myriad.enabled} onCheckedChange={() => session.updateMyriad({ wireframe: !myriad.wireframe })}>
            <Grid2x2 aria-hidden/>
            Arestas dos triângulos
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem className={MENU_ITEM_CLASS} checked={myriad.freeze} disabled={!myriad.enabled} onCheckedChange={() => session.updateMyriad({ freeze: !myriad.freeze })}>
            <Snowflake aria-hidden/>
            Congelar seleção e culling
          </DropdownMenuCheckboxItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>);
}
