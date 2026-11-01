'use client';
import { Headphones, Play, Square, Trash2, Volume2, VolumeX } from 'lucide-react';
import type { Entity } from '@/engine/core/scene/entity';
import { formatDb, formatHertz, formatMilliseconds, formatPercent, formatSemitones } from '@/engine/audio/core/decibels';
import { AUDIO_DISTANCE_MODELS, AUDIO_PANNING_MODELS, AUDIO_SOURCE_LOOP_MODES, AUDIO_SOURCE_PRESETS, AUDIO_SOURCE_TRIGGERS, effectiveTriggerRadius, SOURCE_AIR_ABSORPTION_MAX, SOURCE_DOPPLER_MAX, SOURCE_PITCH_RANGE, SOURCE_PRIORITY_MAX, SOURCE_VOLUME_MAX_DB, SOURCE_VOLUME_MIN_DB, type AudioSourceSettings, } from '@/engine/audio/world/audio-source-settings';
import type { SourceRuntimeView } from '@/engine/audio/world/audio-world';
import { OPEN_FILTER_HZ } from '@/engine/audio/world/spatial-filter';
import { SOURCE_STATUS_HINT, SourceStatusChip } from '@/engine/editor/audio/ui/source-status';
import { useAudioWorld } from '@/engine/editor/audio/ui/use-audio-world';
import { applyAudioSourcePreset, detachAudioSource, patchAudioSource, setAudioSourceAsset, setAudioSourceCone, setAudioSourceMuted, setAudioSourceOcclusion, setAudioSourceScalar, soloAudioSource, toggleAudioSource, } from '@/engine/editor/operations/audio-world-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { ActionButton, ActionRow } from '@/engine/ui/action-button';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { FieldInput } from '@/engine/ui/field-input';
import { IconButton } from '@/engine/ui/icon-button';
import { PropertyRow } from '@/engine/ui/property-row';
import { SegmentedControl } from '@/engine/ui/segmented-control';
import { SelectField } from '@/engine/ui/select-field';
import { SliderField } from '@/engine/ui/slider-field';
import { ToggleField, ToggleSwitch } from '@/engine/ui/toggle-field';
import { cn } from '@/lib/utils';
import { AudioAssetPicker } from './audio/audio-asset-picker';
import { AudioPresetsMenu } from './audio/audio-presets-menu';
const meters = (value: number) => `${Number(value.toFixed(2))} m`;
const degrees = (value: number) => `${Number(value.toFixed(0))}°`;
const seconds = (value: number) => formatMilliseconds(value);
const times = (value: number) => (value <= 0 ? 'desligado' : `${Number(value.toFixed(2))}×`);
const absorption = (value: number) => (value <= 0 ? 'desligada' : Math.abs(value - 1) < 1e-3 ? '1 · natural' : `${Number(value.toFixed(2))}×`);
const rolloffLabel = (value: number) => (Math.abs(value - 1) < 1e-3 ? '1 · físico' : String(Number(value.toFixed(2))));
const TRIGGER_OPTIONS = AUDIO_SOURCE_TRIGGERS.map(({ value, label }) => ({ value, label }));
const LOOP_OPTIONS = AUDIO_SOURCE_LOOP_MODES.map(({ value, label }) => ({ value, label }));
const PANNING_OPTIONS = AUDIO_PANNING_MODELS.map(({ value, label }) => ({ value, label }));
const DISTANCE_OPTIONS = AUDIO_DISTANCE_MODELS.map(({ value, label }) => ({ value, label }));
function Hint({ children }: {
    children: React.ReactNode;
}) {
    return <p className="px-2 py-0.5 text-3xs leading-relaxed text-pretty text-muted-foreground">{children}</p>;
}
function listenerReadout(settings: AudioSourceSettings, runtime: SourceRuntimeView): string {
    const parts = [meters(runtime.distance)];
    if (settings.spatial)
        parts.push(formatDb(runtime.distanceDb));
    if (runtime.status === 'playing' && runtime.filterHz < OPEN_FILTER_HZ * 0.95)
        parts.push(`corte ${formatHertz(runtime.filterHz)}`);
    if (runtime.occlusion > 0.01)
        parts.push(`oclusão ${formatPercent(runtime.occlusion)}`);
    return parts.join(' · ');
}
function LiveStatus({ entity, settings }: {
    entity: Entity;
    settings: AudioSourceSettings;
}) {
    const world = useAudioWorld();
    const runtime = world.runtime(entity.id);
    if (!runtime) {
        return (<PropertyRow label="Estado">
        <SourceStatusChip status={entity.visible ? 'stopped' : 'off'}/>
        {!entity.visible && <span className="truncate text-3xs text-muted-foreground">ator oculto: não toca</span>}
      </PropertyRow>);
    }
    const hint = runtime.error ?? SOURCE_STATUS_HINT[runtime.status];
    return (<>
      <PropertyRow label="Estado">
        <SourceStatusChip status={runtime.status}/>
        {runtime.latched && <span className="truncate text-3xs text-muted-foreground">ligada por comando</span>}
        {world.soloSourceId === entity.id && <span className="truncate text-3xs text-warning">em solo</span>}
      </PropertyRow>
      <PropertyRow label="Ouvinte">
        <FieldInput readOnly value={listenerReadout(settings, runtime)} aria-label="Como o ouvinte percebe a fonte" title="Distância · atenuação por distância · corte do filtro · fração ocluída"/>
      </PropertyRow>
      {hint && <Hint>{hint}</Hint>}
    </>);
}
function Transport({ entity, settings }: {
    entity: Entity;
    settings: AudioSourceSettings;
}) {
    const session = useEditorSession();
    const world = useAudioWorld();
    const active = world.isLatched(entity.id) || world.isPlaying(entity.id);
    const solo = world.soloSourceId === entity.id;
    return (<ActionRow>
      <ActionButton icon={active ? Square : Play} variant="primary" disabled={!settings.assetId} title={active ? 'Cessar com a rampa de saída' : 'Tocar agora, em qualquer modo e gatilho'} onClick={() => toggleAudioSource(session, entity)}>
        {active ? 'Parar' : 'Tocar'}
      </ActionButton>
      <ActionButton icon={Headphones} title={solo ? 'Sair do solo' : 'Solo: só esta fonte soa no mundo'} className={cn(solo && 'border-warning/60 bg-warning/15 text-warning hover:bg-warning/20 hover:text-warning')} onClick={() => soloAudioSource(session, entity)}>
        Solo
      </ActionButton>
      <ActionButton icon={settings.muted ? VolumeX : Volume2} title={settings.muted ? 'Silenciada (clique para ativar)' : 'Silenciar esta fonte'} className={cn(settings.muted && 'border-destructive/60 bg-destructive/15 text-destructive hover:bg-destructive/20 hover:text-destructive')} onClick={() => setAudioSourceMuted(session, entity, !settings.muted)}>
        Mudo
      </ActionButton>
    </ActionRow>);
}
function MainSection({ entity, settings }: {
    entity: Entity;
    settings: AudioSourceSettings;
}) {
    const session = useEditorSession();
    const repeats = settings.repeatMin > 0 || settings.repeatMax > 0;
    const detachable = entity.kind !== 'sound' || entity.audioZone !== null;
    return (<CollapsibleSection title="Fonte de som" trailing={<div className="flex items-center gap-1">
          <AudioPresetsMenu title="Pontos de partida (mantêm o áudio e o mudo)" presets={AUDIO_SOURCE_PRESETS} onPick={(presetId) => applyAudioSourcePreset(session, entity, presetId)}/>
          {detachable && (<IconButton label="Remover fonte de som" size="xs" className="hover:text-destructive" onClick={() => detachAudioSource(session, entity)}>
              <Trash2 />
            </IconButton>)}
        </div>}>
      <LiveStatus entity={entity} settings={settings}/>
      <Transport entity={entity} settings={settings}/>
      <AudioAssetPicker label="Áudio" assetId={settings.assetId} onChange={(assetId) => setAudioSourceAsset(session, entity, assetId)}/>
      <SliderField label="Volume" value={settings.volumeDb} min={SOURCE_VOLUME_MIN_DB} max={SOURCE_VOLUME_MAX_DB} step={0.5} format={formatDb} onChange={(value) => setAudioSourceScalar(session, entity, 'volumeDb', value)}/>
      <SliderField label="Tom" value={settings.pitch} min={-SOURCE_PITCH_RANGE} max={SOURCE_PITCH_RANGE} step={0.5} format={formatSemitones} onChange={(value) => setAudioSourceScalar(session, entity, 'pitch', value)}/>
      <PropertyRow label="Laço">
        <SegmentedControl label="Laço" options={LOOP_OPTIONS} value={settings.loopMode} onChange={(loopMode) => patchAudioSource(session, entity, { loopMode }, `Laço de ${entity.name}`)}/>
      </PropertyRow>
      <PropertyRow label="Gatilho">
        <SegmentedControl label="Gatilho" options={TRIGGER_OPTIONS} value={settings.trigger} onChange={(trigger) => patchAudioSource(session, entity, { trigger }, `Gatilho de ${entity.name}`)}/>
      </PropertyRow>
      {settings.trigger === 'proximity' && (<>
          <SliderField label="Raio do gatilho" value={settings.triggerRadius} min={0} max={Math.max(settings.maxDistance, 1)} step={0.25} editable suffix=" m" format={(value) => (value <= 0 ? `alcance (${meters(effectiveTriggerRadius(settings))})` : meters(value))} onChange={(value) => setAudioSourceScalar(session, entity, 'triggerRadius', value)}/>
          <ToggleField label="Cessar ao sair" on={settings.stopOnExit} onToggle={() => patchAudioSource(session, entity, { stopOnExit: !settings.stopOnExit }, `${settings.stopOnExit ? 'Deixar terminar' : 'Cessar'} ao sair de ${entity.name}`)}/>
        </>)}
      <SliderField label="Entrada" value={settings.fadeIn} min={0} max={5} step={0.05} editable suffix=" s" format={seconds} onChange={(value) => setAudioSourceScalar(session, entity, 'fadeIn', value)}/>
      <SliderField label="Saída" value={settings.fadeOut} min={0} max={5} step={0.05} editable suffix=" s" format={seconds} onChange={(value) => setAudioSourceScalar(session, entity, 'fadeOut', value)}/>
      <SliderField label="Repetir após" value={settings.repeatMin} min={0} max={60} step={0.5} editable suffix=" s" format={(value) => (repeats ? seconds(value) : 'não repete')} onChange={(value) => setAudioSourceScalar(session, entity, 'repeatMin', value)}/>
      <SliderField label="Até" value={settings.repeatMax} min={0} max={60} step={0.5} editable suffix=" s" format={(value) => (repeats ? seconds(value) : 'não repete')} onChange={(value) => setAudioSourceScalar(session, entity, 'repeatMax', value)}/>
      <ToggleField label="Início aleatório" on={settings.randomStart} onToggle={() => patchAudioSource(session, entity, { randomStart: !settings.randomStart }, `Início aleatório de ${entity.name}`)}/>
      <SliderField label="Prioridade" value={settings.priority} min={0} max={SOURCE_PRIORITY_MAX} step={1} format={(value) => String(Math.round(value))} onChange={(value) => setAudioSourceScalar(session, entity, 'priority', value)}/>
    </CollapsibleSection>);
}
function SpatialSection({ entity, settings }: {
    entity: Entity;
    settings: AudioSourceSettings;
}) {
    const session = useEditorSession();
    return (<CollapsibleSection title="Espacialização" trailing={<ToggleSwitch label="Som espacial (3D)" on={settings.spatial} onToggle={() => patchAudioSource(session, entity, { spatial: !settings.spatial }, `${settings.spatial ? 'Som 2D' : 'Som 3D'} em ${entity.name}`)}/>}>
      {settings.spatial && (<>
          <PropertyRow label="Panorama">
            <SegmentedControl label="Modelo de panorama" options={PANNING_OPTIONS} value={settings.panningModel} onChange={(panningModel) => patchAudioSource(session, entity, { panningModel }, `Panorama ${panningModel === 'hrtf' ? 'HRTF' : 'estéreo'} em ${entity.name}`)}/>
          </PropertyRow>
          <PropertyRow label="Lei de queda">
            <SelectField label="Lei de distância" options={DISTANCE_OPTIONS} value={settings.distanceModel} onChange={(distanceModel) => patchAudioSource(session, entity, { distanceModel }, `Lei ${distanceModel} em ${entity.name}`)}/>
          </PropertyRow>
          <SliderField label="Pleno até" value={settings.minDistance} min={0.1} max={200} scale="log" editable suffix=" m" format={meters} onChange={(value) => setAudioSourceScalar(session, entity, 'minDistance', value)}/>
          <SliderField label="Alcance" value={settings.maxDistance} min={0.5} max={2000} scale="log" editable suffix=" m" format={meters} onChange={(value) => setAudioSourceScalar(session, entity, 'maxDistance', value)}/>
          <SliderField label="Queda" value={settings.rolloff} min={0} max={8} step={0.05} format={rolloffLabel} onChange={(value) => setAudioSourceScalar(session, entity, 'rolloff', value)}/>
          <SliderField label="Absorção do ar" value={settings.airAbsorption} min={0} max={SOURCE_AIR_ABSORPTION_MAX} step={0.05} format={absorption} onChange={(value) => setAudioSourceScalar(session, entity, 'airAbsorption', value)}/>
          <SliderField label="Doppler" value={settings.doppler} min={0} max={SOURCE_DOPPLER_MAX} step={0.05} format={times} onChange={(value) => setAudioSourceScalar(session, entity, 'doppler', value)}/>
          <SliderField label="Reverberação" value={settings.reverbSend} min={0} max={1} step={0.01} format={formatPercent} onChange={(value) => setAudioSourceScalar(session, entity, 'reverbSend', value)}/>
        </>)}
    </CollapsibleSection>);
}
function ConeSection({ entity, settings }: {
    entity: Entity;
    settings: AudioSourceSettings;
}) {
    const session = useEditorSession();
    const { cone } = settings;
    return (<CollapsibleSection title="Cone de emissão" defaultOpen={cone.enabled} trailing={<ToggleSwitch label="Cone de emissão" on={cone.enabled} onToggle={() => setAudioSourceCone(session, entity, { enabled: !cone.enabled })}/>}>
      {cone.enabled ? (<>
          <SliderField label="Ângulo interno" value={cone.innerAngle} min={0} max={360} step={1} format={degrees} onChange={(value) => setAudioSourceCone(session, entity, { innerAngle: value }, `audio-source:${entity.id}:cone:inner`)}/>
          <SliderField label="Ângulo externo" value={cone.outerAngle} min={1} max={360} step={1} format={degrees} onChange={(value) => setAudioSourceCone(session, entity, { outerAngle: value }, `audio-source:${entity.id}:cone:outer`)}/>
          <SliderField label="Fora do cone" value={cone.outerGainDb} min={-60} max={0} step={0.5} format={formatDb} onChange={(value) => setAudioSourceCone(session, entity, { outerGainDb: value }, `audio-source:${entity.id}:cone:gain`)}/>
        </>) : null}
    </CollapsibleSection>);
}
function OcclusionSection({ entity, settings }: {
    entity: Entity;
    settings: AudioSourceSettings;
}) {
    const session = useEditorSession();
    const { occlusion } = settings;
    return (<CollapsibleSection title="Oclusão" defaultOpen={false} trailing={<ToggleSwitch label="Oclusão por geometria" on={occlusion.enabled} onToggle={() => setAudioSourceOcclusion(session, entity, { enabled: !occlusion.enabled })}/>}>
      {occlusion.enabled ? (<>
          <SliderField label="Atenuação" value={occlusion.attenuationDb} min={-60} max={0} step={0.5} format={formatDb} onChange={(value) => setAudioSourceOcclusion(session, entity, { attenuationDb: value }, `audio-source:${entity.id}:occlusion:db`)}/>
          <SliderField label="Abafamento" value={occlusion.lowpass} min={100} max={20000} scale="log" format={formatHertz} onChange={(value) => setAudioSourceOcclusion(session, entity, { lowpass: value }, `audio-source:${entity.id}:occlusion:hz`)}/>
        </>) : null}
    </CollapsibleSection>);
}
export function AudioSourceSection({ entity }: {
    entity: Entity;
}) {
    const settings = entity.audioSource;
    if (!settings)
        return null;
    return (<>
      <MainSection entity={entity} settings={settings}/>
      <SpatialSection entity={entity} settings={settings}/>
      {settings.spatial && <ConeSection entity={entity} settings={settings}/>}
      {settings.spatial && <OcclusionSection entity={entity} settings={settings}/>}
    </>);
}
