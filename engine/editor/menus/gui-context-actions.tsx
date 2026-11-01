'use client';
import { LayoutTemplate, MousePointerClick, PenLine, WandSparkles } from 'lucide-react';
import { ContextMenuCheckboxItem, ContextMenuGroup, ContextMenuItem, ContextMenuSeparator, ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger } from '@/components/ui/context-menu';
import type { Entity } from '@/engine/core/scene/entity';
import { GUI_SURFACE_PRESETS } from '@/engine/gui/world/gui-surface-settings';
import { openGuiAssetInDesigner } from '@/engine/editor/operations/gui-operations';
import { applyGuiSurfacePreset, attachGuiSurface, canCarrySurface, patchGuiSurface } from '@/engine/editor/operations/gui-surface-operations';
import { useSessionTopic } from '@/engine/editor/session/editor-session-context';
import { MENU_CONTENT_CLASS, MENU_ITEM_CLASS } from './menu-styles';
type GuiContextActionsProps = {
    selection: readonly Entity[];
};
export function GuiContextActions({ selection }: GuiContextActionsProps) {
    const session = useSessionTopic('assets');
    const surfaces = selection.filter((entity) => entity.guiSurface !== null);
    const single = selection.length === 1 ? selection[0] : null;
    const singleSurface = single && single.guiSurface ? single : null;
    const attachable = single && single.kind !== 'gui' && !single.guiSurface && canCarrySurface(single) ? single : null;
    if (surfaces.length === 0 && !attachable)
        return null;
    const screenAsset = singleSurface?.guiSurface?.content.kind === 'screen' && singleSurface.guiSurface.content.assetId ? session.library.get(singleSurface.guiSurface.content.assetId) : null;
    const allInteractive = surfaces.length > 0 && surfaces.every((entity) => entity.guiSurface?.interactive);
    return (<>
      {surfaces.length > 0 && (<ContextMenuGroup>
          {screenAsset && (<ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => void openGuiAssetInDesigner(session, screenAsset)}>
              <PenLine aria-hidden/>
              Editar a tela no designer
            </ContextMenuItem>)}
          <ContextMenuCheckboxItem className={MENU_ITEM_CLASS} checked={allInteractive} onCheckedChange={(checked) => surfaces.forEach((entity) => patchGuiSurface(session, entity, { interactive: checked }, `Interface de ${entity.name} ${checked ? 'interativa' : 'só de leitura'}`))}>
            <MousePointerClick aria-hidden/>
            Interativa{surfaces.length > 1 ? ` (${surfaces.length} interfaces)` : ''}
          </ContextMenuCheckboxItem>
          {singleSurface && (<ContextMenuSub>
              <ContextMenuSubTrigger className={MENU_ITEM_CLASS}>
                <WandSparkles aria-hidden/>
                Preset da interface
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className={`${MENU_CONTENT_CLASS} w-64`}>
                {GUI_SURFACE_PRESETS.map((preset) => (<ContextMenuItem key={preset.id} className={`${MENU_ITEM_CLASS} flex-col items-start gap-0`} onClick={() => applyGuiSurfacePreset(session, singleSurface, preset.id)}>
                    <span>{preset.label}</span>
                    <span className="text-3xs text-muted-foreground">{preset.description}</span>
                  </ContextMenuItem>))}
              </ContextMenuSubContent>
            </ContextMenuSub>)}
        </ContextMenuGroup>)}
      {attachable && (<ContextMenuGroup>
          <ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => attachGuiSurface(session, attachable)}>
            <LayoutTemplate aria-hidden/>
            Anexar interface
          </ContextMenuItem>
          <ContextMenuSub>
            <ContextMenuSubTrigger className={MENU_ITEM_CLASS}>
              <WandSparkles aria-hidden/>
              Anexar interface com preset
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className={`${MENU_CONTENT_CLASS} w-64`}>
              {GUI_SURFACE_PRESETS.map((preset) => (<ContextMenuItem key={preset.id} className={`${MENU_ITEM_CLASS} flex-col items-start gap-0`} onClick={() => attachGuiSurface(session, attachable, preset.id)}>
                  <span>{preset.label}</span>
                  <span className="text-3xs text-muted-foreground">{preset.description}</span>
                </ContextMenuItem>))}
            </ContextMenuSubContent>
          </ContextMenuSub>
        </ContextMenuGroup>)}
      <ContextMenuSeparator />
    </>);
}
