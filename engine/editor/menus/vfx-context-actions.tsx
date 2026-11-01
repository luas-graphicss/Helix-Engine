'use client';
import { Eye, Pause, PenLine, Play, Sparkles, Square, WandSparkles } from 'lucide-react';
import { ContextMenuCheckboxItem, ContextMenuGroup, ContextMenuItem, ContextMenuSeparator, ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger } from '@/components/ui/context-menu';
import type { Entity } from '@/engine/core/scene/entity';
import { VFX_TEMPLATES } from '@/engine/vfx/document/vfx-templates';
import { createVfxEffect, openVfxAssetInEditor } from '@/engine/editor/operations/vfx-operations';
import { attachVfx, canCarryVfx, patchVfx, playVfx, stopVfx, toggleVfxPause } from '@/engine/editor/operations/vfx-world-operations';
import { useSessionTopic } from '@/engine/editor/session/editor-session-context';
import { MENU_CONTENT_CLASS, MENU_ITEM_CLASS } from './menu-styles';
type VfxContextActionsProps = {
    selection: readonly Entity[];
};
export function VfxContextActions({ selection }: VfxContextActionsProps) {
    const session = useSessionTopic('scene', 'assets');
    const effects = selection.filter((entity) => entity.vfx !== null);
    const single = selection.length === 1 ? selection[0] : null;
    const singleEffect = single && single.vfx ? single : null;
    const attachable = single && !single.vfx && canCarryVfx(single) ? single : null;
    if (effects.length === 0 && !attachable)
        return null;
    const asset = singleEffect?.vfx?.assetId ? session.library.get(singleEffect.vfx.assetId) : null;
    const paused = singleEffect ? session.vfxWorld.system.instanceOf(singleEffect.id)?.state === 'paused' : false;
    const allInEditor = effects.length > 0 && effects.every((entity) => entity.vfx?.playInEditor);
    const plural = effects.length > 1 ? ` (${effects.length} efeitos)` : '';
    const hasLibraryEffects = session.library.byKind('vfx').length > 0;
    return (<>
      {effects.length > 0 && (<ContextMenuGroup>
          {asset && (<ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => void openVfxAssetInEditor(session, asset)}>
              <PenLine aria-hidden/>
              Editar o efeito
            </ContextMenuItem>)}
          <ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => effects.forEach((entity) => playVfx(session, entity))}>
            <Play aria-hidden/>
            Tocar efeito{plural}
          </ContextMenuItem>
          {singleEffect && (<ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => toggleVfxPause(session, singleEffect)}>
              {paused ? <Play aria-hidden/> : <Pause aria-hidden/>}
              {paused ? 'Continuar efeito' : 'Pausar efeito'}
            </ContextMenuItem>)}
          <ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => effects.forEach((entity) => stopVfx(session, entity))}>
            <Square aria-hidden/>
            Parar efeito{plural}
          </ContextMenuItem>
          <ContextMenuCheckboxItem className={MENU_ITEM_CLASS} checked={allInEditor} onCheckedChange={(checked) => effects.forEach((entity) => patchVfx(session, entity, { playInEditor: checked }, `${entity.name} ${checked ? 'também no editor' : 'só no jogo'}`))}>
            <Eye aria-hidden/>
            Tocar no editor{plural}
          </ContextMenuCheckboxItem>
        </ContextMenuGroup>)}
      {attachable && (<ContextMenuGroup>
          {hasLibraryEffects && (<ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => attachVfx(session, attachable)}>
              <Sparkles aria-hidden/>
              Anexar efeito
            </ContextMenuItem>)}
          <ContextMenuSub>
            <ContextMenuSubTrigger className={MENU_ITEM_CLASS}>
              <WandSparkles aria-hidden/>
              Anexar efeito novo
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className={`${MENU_CONTENT_CLASS} w-64`}>
              {VFX_TEMPLATES.map((template) => (<ContextMenuItem key={template.id} className={`${MENU_ITEM_CLASS} flex-col items-start gap-0`} onClick={() => void createVfxEffect(session, template.id, { stage: null }).then((created) => created && attachVfx(session, attachable, created.id))}>
                  <span>{template.label}</span>
                  <span className="text-3xs text-muted-foreground">{template.description}</span>
                </ContextMenuItem>))}
            </ContextMenuSubContent>
          </ContextMenuSub>
        </ContextMenuGroup>)}
      <ContextMenuSeparator />
    </>);
}
