'use client';
import { Trash2 } from 'lucide-react';
import type { Entity } from '@/engine/core/scene/entity';
import { formatDb, formatHertz, formatMilliseconds, formatPercent } from '@/engine/audio/core/decibels';
import { AUDIO_ZONE_PRESETS, AUDIO_ZONE_SHAPES, ZONE_AMBIENCE_MAX_DB, ZONE_AMBIENCE_MIN_DB, ZONE_FALLOFF_MAX, ZONE_PRIORITY_MAX, zoneWeightAt, type AudioZoneSettings, } from '@/engine/audio/world/audio-zone-settings';
import { StatusChip, type StatusTone } from '@/engine/editor/audio/ui/source-status';
import { useAudioWorld } from '@/engine/editor/audio/ui/use-audio-world';
import { applyAudioZonePreset, detachAudioZone, patchAudioZone, setAudioZoneAmbience, setAudioZoneEcho, setAudioZoneFilter, setAudioZoneReverb, setAudioZoneScalar, setAudioZoneSizeComponent, } from '@/engine/editor/operations/audio-world-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { IconButton } from '@/engine/ui/icon-button';
import { PropertyRow } from '@/engine/ui/property-row';
import { SegmentedControl } from '@/engine/ui/segmented-control';
import { SliderField } from '@/engine/ui/slider-field';
import { ToggleSwitch } from '@/engine/ui/toggle-field';
import { AudioAssetPicker } from './audio/audio-asset-picker';
import { AudioPresetsMenu } from './audio/audio-presets-menu';
import { Vector3Input } from './number-fields';
const meters = (value: number) => `${Number(value.toFixed(2))} m`;
const seconds = (value: number) => `${Number(value.toFixed(2))} s`;
const SHAPE_OPTIONS = AUDIO_ZONE_SHAPES.map(({ value, label }) => ({ value, label }));
function ListenerStatus({ entity, settings }: {
    entity: Entity;
    settings: AudioZoneSettings;
}) {
    const session = useEditorSession();
    const world = useAudioWorld();
    const weight = zoneWeightAt(settings, entity.worldMatrix, session.camera.position);
    const dominant = world.activeZone?.entity.id === entity.id;
    let tone: StatusTone = 'muted';
    let label = 'Ouvinte fora';
    if (!settings.enabled)
        label = 'Desligada';
    else if (weight >= 0.999) {
        tone = dominant ? 'ok' : 'info';
        label = 'Ouvinte dentro';
    }
    else if (weight > 0) {
        tone = dominant ? 'ok' : 'info';
        label = `Na transição · ${formatPercent(weight)}`;
    }
    return (<PropertyRow label="Estado">
      <StatusChip tone={tone}>{label}</StatusChip>
      {weight > 0 && settings.enabled && <span className="truncate text-3xs text-muted-foreground">{dominant ? 'define a acústica agora' : 'outra zona tem prioridade'}</span>}
    </PropertyRow>);
}
function MainSection({ entity, settings }: {
    entity: Entity;
    settings: AudioZoneSettings;
}) {
    const session = useEditorSession();
    const detachable = entity.kind !== 'sound' || entity.audioSource !== null;
    return (<CollapsibleSection title="Zona acústica" trailing={<div className="flex items-center gap-1">
          <ToggleSwitch label="Zona ativa" on={settings.enabled} onToggle={() => patchAudioZone(session, entity, { enabled: !settings.enabled }, `${settings.enabled ? 'Desligar' : 'Ligar'} zona ${entity.name}`)}/>
          <AudioPresetsMenu title="Acústica do lugar (mantém forma, tamanho e cama ambiente)" presets={AUDIO_ZONE_PRESETS} onPick={(presetId) => applyAudioZonePreset(session, entity, presetId)}/>
          {detachable && (<IconButton label="Remover zona acústica" size="xs" className="hover:text-destructive" onClick={() => detachAudioZone(session, entity)}>
              <Trash2 />
            </IconButton>)}
        </div>}>
      <ListenerStatus entity={entity} settings={settings}/>
      <PropertyRow label="Forma">
        <SegmentedControl label="Forma da zona" options={SHAPE_OPTIONS} value={settings.shape} onChange={(shape) => patchAudioZone(session, entity, { shape }, `Zona ${entity.name} em ${shape === 'box' ? 'caixa' : 'esfera'}`)}/>
      </PropertyRow>
      {settings.shape === 'box' ? (<PropertyRow label="Tamanho">
          <Vector3Input label="Tamanho da zona" values={settings.size} suffix=" m" onCommit={(axis, value) => setAudioZoneSizeComponent(session, entity, axis, value)}/>
        </PropertyRow>) : (<SliderField label="Raio" value={settings.radius} min={0.25} max={200} scale="log" editable suffix=" m" format={meters} onChange={(value) => setAudioZoneScalar(session, entity, 'radius', value)}/>)}
      <SliderField label="Transição" value={settings.falloff} min={0} max={ZONE_FALLOFF_MAX} step={0.1} editable suffix=" m" format={meters} onChange={(value) => setAudioZoneScalar(session, entity, 'falloff', value)}/>
      <SliderField label="Prioridade" value={settings.priority} min={0} max={ZONE_PRIORITY_MAX} step={1} format={(value) => String(Math.round(value))} onChange={(value) => setAudioZoneScalar(session, entity, 'priority', value)}/>
    </CollapsibleSection>);
}
function ReverbSection({ entity, settings }: {
    entity: Entity;
    settings: AudioZoneSettings;
}) {
    const session = useEditorSession();
    const { reverb } = settings;
    const key = `audio-zone:${entity.id}:reverb`;
    return (<CollapsibleSection title="Reverberação" trailing={<ToggleSwitch label="Reverberação da zona" on={reverb.enabled} onToggle={() => setAudioZoneReverb(session, entity, { enabled: !reverb.enabled })}/>}>
      {reverb.enabled ? (<>
          <SliderField label="Cauda" value={reverb.size} min={0.1} max={10} scale="log" editable suffix=" s" format={seconds} onChange={(value) => setAudioZoneReverb(session, entity, { size: value }, `${key}:size`)}/>
          <SliderField label="Decaimento" value={reverb.decay} min={0.5} max={8} step={0.05} format={(value) => String(Number(value.toFixed(2)))} onChange={(value) => setAudioZoneReverb(session, entity, { decay: value }, `${key}:decay`)}/>
          <SliderField label="Abafamento" value={reverb.damping} min={200} max={20000} scale="log" format={formatHertz} onChange={(value) => setAudioZoneReverb(session, entity, { damping: value }, `${key}:damping`)}/>
          <SliderField label="Pré-atraso" value={reverb.preDelay} min={0} max={0.25} step={0.001} format={formatMilliseconds} onChange={(value) => setAudioZoneReverb(session, entity, { preDelay: value }, `${key}:predelay`)}/>
          <SliderField label="Mistura" value={reverb.mix} min={0} max={1} step={0.01} format={formatPercent} onChange={(value) => setAudioZoneReverb(session, entity, { mix: value }, `${key}:mix`)}/>
        </>) : null}
    </CollapsibleSection>);
}
function EchoSection({ entity, settings }: {
    entity: Entity;
    settings: AudioZoneSettings;
}) {
    const session = useEditorSession();
    const { echo } = settings;
    const key = `audio-zone:${entity.id}:echo`;
    return (<CollapsibleSection title="Eco" defaultOpen={echo.enabled} trailing={<ToggleSwitch label="Eco da zona" on={echo.enabled} onToggle={() => setAudioZoneEcho(session, entity, { enabled: !echo.enabled })}/>}>
      {echo.enabled ? (<>
          <SliderField label="Intervalo" value={echo.time} min={0.02} max={2} scale="log" editable suffix=" s" format={formatMilliseconds} onChange={(value) => setAudioZoneEcho(session, entity, { time: value }, `${key}:time`)}/>
          <SliderField label="Realimentação" value={echo.feedback} min={0} max={0.95} step={0.01} format={formatPercent} onChange={(value) => setAudioZoneEcho(session, entity, { feedback: value }, `${key}:feedback`)}/>
          <SliderField label="Abafamento" value={echo.damping} min={200} max={20000} scale="log" format={formatHertz} onChange={(value) => setAudioZoneEcho(session, entity, { damping: value }, `${key}:damping`)}/>
          <SliderField label="Mistura" value={echo.mix} min={0} max={1} step={0.01} format={formatPercent} onChange={(value) => setAudioZoneEcho(session, entity, { mix: value }, `${key}:mix`)}/>
        </>) : null}
    </CollapsibleSection>);
}
function FilterSection({ entity, settings }: {
    entity: Entity;
    settings: AudioZoneSettings;
}) {
    const session = useEditorSession();
    const { filter } = settings;
    return (<CollapsibleSection title="Filtro" defaultOpen={filter.enabled} trailing={<ToggleSwitch label="Filtro da zona" on={filter.enabled} onToggle={() => setAudioZoneFilter(session, entity, { enabled: !filter.enabled })}/>}>
      {filter.enabled ? (<>
          <SliderField label="Corte" value={filter.frequency} min={100} max={20000} scale="log" format={formatHertz} onChange={(value) => setAudioZoneFilter(session, entity, { frequency: value }, `audio-zone:${entity.id}:filter`)}/>
        </>) : null}
    </CollapsibleSection>);
}
function AmbienceSection({ entity, settings }: {
    entity: Entity;
    settings: AudioZoneSettings;
}) {
    const session = useEditorSession();
    const { ambience } = settings;
    return (<CollapsibleSection title="Cama ambiente" defaultOpen={ambience.assetId !== null}>
      <AudioAssetPicker label="Áudio" assetId={ambience.assetId} onChange={(assetId) => setAudioZoneAmbience(session, entity, { assetId })}/>
      <SliderField label="Volume" value={ambience.volumeDb} min={ZONE_AMBIENCE_MIN_DB} max={ZONE_AMBIENCE_MAX_DB} step={0.5} format={formatDb} disabled={ambience.assetId === null} onChange={(value) => setAudioZoneAmbience(session, entity, { volumeDb: value }, `audio-zone:${entity.id}:ambience:volume`)}/>
    </CollapsibleSection>);
}
export function AudioZoneSection({ entity }: {
    entity: Entity;
}) {
    const settings = entity.audioZone;
    if (!settings)
        return null;
    return (<>
      <MainSection entity={entity} settings={settings}/>
      <ReverbSection entity={entity} settings={settings}/>
      <EchoSection entity={entity} settings={settings}/>
      <FilterSection entity={entity} settings={settings}/>
      <AmbienceSection entity={entity} settings={settings}/>
    </>);
}
