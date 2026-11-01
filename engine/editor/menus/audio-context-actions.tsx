'use client';
import { Headphones, Play, Radio, Square, Volume2, VolumeX, WandSparkles } from 'lucide-react';
import { ContextMenuCheckboxItem, ContextMenuGroup, ContextMenuItem, ContextMenuSeparator, ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger } from '@/components/ui/context-menu';
import type { Entity } from '@/engine/core/scene/entity';
import { AUDIO_SOURCE_PRESETS } from '@/engine/audio/world/audio-source-settings';
import { AUDIO_ZONE_PRESETS } from '@/engine/audio/world/audio-zone-settings';
import { useAudioWorld } from '@/engine/editor/audio/ui/use-audio-world';
import { applyAudioSourcePreset, applyAudioZonePreset, attachAudioSource, attachAudioZone, canCarryAudio, setAudioSourceMuted, soloAudioSource, toggleAudioSource, } from '@/engine/editor/operations/audio-world-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { MENU_CONTENT_CLASS, MENU_ITEM_CLASS } from './menu-styles';
type AudioContextActionsProps = {
    selection: readonly Entity[];
};
export function AudioContextActions({ selection }: AudioContextActionsProps) {
    const session = useEditorSession();
    const world = useAudioWorld();
    const sources = selection.filter((entity) => entity.audioSource !== null);
    const single = selection.length === 1 ? selection[0] : null;
    const singleSource = single && single.audioSource ? single : null;
    const singleZone = single && single.audioZone ? single : null;
    const attachable = single && single.kind !== 'sound' && canCarryAudio(single) ? single : null;
    const canAttachSource = attachable !== null && attachable.audioSource === null;
    const canAttachZone = attachable !== null && attachable.audioZone === null;
    if (sources.length === 0 && !singleZone && !canAttachSource && !canAttachZone)
        return null;
    const allMuted = sources.length > 0 && sources.every((entity) => entity.audioSource?.muted);
    const active = singleSource !== null && (world.isLatched(singleSource.id) || world.isPlaying(singleSource.id));
    const solo = singleSource !== null && world.soloSourceId === singleSource.id;
    return (<>
      {(sources.length > 0 || singleZone) && (<ContextMenuGroup>
          {singleSource && (<ContextMenuItem className={MENU_ITEM_CLASS} disabled={!singleSource.audioSource?.assetId} onClick={() => toggleAudioSource(session, singleSource)}>
              {active ? <Square aria-hidden/> : <Play aria-hidden/>}
              {active ? 'Parar o som' : 'Tocar o som'}
            </ContextMenuItem>)}
          {singleSource && (<ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => soloAudioSource(session, singleSource)}>
              <Headphones aria-hidden/>
              {solo ? 'Sair do solo' : 'Solo (só esta fonte soa)'}
            </ContextMenuItem>)}
          {sources.length > 0 && (<ContextMenuCheckboxItem className={MENU_ITEM_CLASS} checked={allMuted} onCheckedChange={(checked) => sources.forEach((entity) => setAudioSourceMuted(session, entity, checked))}>
              {allMuted ? <VolumeX aria-hidden/> : <Volume2 aria-hidden/>}
              Silenciar{sources.length > 1 ? ` (${sources.length} fontes)` : ''}
            </ContextMenuCheckboxItem>)}
          {singleSource && (<ContextMenuSub>
              <ContextMenuSubTrigger className={MENU_ITEM_CLASS}>
                <WandSparkles aria-hidden/>
                Preset da fonte
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className={`${MENU_CONTENT_CLASS} w-64`}>
                {AUDIO_SOURCE_PRESETS.map((preset) => (<ContextMenuItem key={preset.id} className={`${MENU_ITEM_CLASS} flex-col items-start gap-0`} onClick={() => applyAudioSourcePreset(session, singleSource, preset.id)}>
                    <span>{preset.label}</span>
                    <span className="text-3xs text-muted-foreground">{preset.description}</span>
                  </ContextMenuItem>))}
              </ContextMenuSubContent>
            </ContextMenuSub>)}
          {singleZone && (<ContextMenuSub>
              <ContextMenuSubTrigger className={MENU_ITEM_CLASS}>
                <Radio aria-hidden/>
                Acústica da zona
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className={`${MENU_CONTENT_CLASS} w-64`}>
                {AUDIO_ZONE_PRESETS.map((preset) => (<ContextMenuItem key={preset.id} className={`${MENU_ITEM_CLASS} flex-col items-start gap-0`} onClick={() => applyAudioZonePreset(session, singleZone, preset.id)}>
                    <span>{preset.label}</span>
                    <span className="text-3xs text-muted-foreground">{preset.description}</span>
                  </ContextMenuItem>))}
              </ContextMenuSubContent>
            </ContextMenuSub>)}
        </ContextMenuGroup>)}
      {(canAttachSource || canAttachZone) && attachable && (<ContextMenuGroup>
          {canAttachSource && (<ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => attachAudioSource(session, attachable)}>
              <Volume2 aria-hidden/>
              Anexar fonte de som
            </ContextMenuItem>)}
          {canAttachZone && (<ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => attachAudioZone(session, attachable)}>
              <Radio aria-hidden/>
              Anexar zona acústica
            </ContextMenuItem>)}
        </ContextMenuGroup>)}
      <ContextMenuSeparator />
    </>);
}
