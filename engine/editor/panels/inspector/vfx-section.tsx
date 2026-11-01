'use client';
import { Dices, Pause, PenLine, Play, Plus, Square, Trash2 } from 'lucide-react';
import type { Entity } from '@/engine/core/scene/entity';
import { VFX_TEMPLATES } from '@/engine/vfx/document/vfx-templates';
import type { VfxInstanceState } from '@/engine/vfx/simulation/vfx-instance';
import { VFX_CULL_DISTANCE_MAX, VFX_SCALE_MAX, VFX_SCALE_MIN, VFX_TIME_SCALE_MAX, type VfxSettings } from '@/engine/vfx/vfx-settings';
import { StatusChip, type StatusTone } from '@/engine/editor/audio/ui/source-status';
import { createVfxEffect, openVfxAssetInEditor } from '@/engine/editor/operations/vfx-operations';
import { detachVfx, endVfxEdit, patchVfx, playVfx, setVfxAsset, setVfxScalar, stopVfx, toggleVfxPause } from '@/engine/editor/operations/vfx-world-operations';
import { useEditorSession, useViewportStats } from '@/engine/editor/session/editor-session-context';
import { ActionButton, ActionRow } from '@/engine/ui/action-button';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { FieldInput } from '@/engine/ui/field-input';
import { IconButton } from '@/engine/ui/icon-button';
import { PropertyRow } from '@/engine/ui/property-row';
import { SegmentedControl } from '@/engine/ui/segmented-control';
import { SelectField } from '@/engine/ui/select-field';
import { SliderField } from '@/engine/ui/slider-field';
import { ToggleField } from '@/engine/ui/toggle-field';
import { AudioPresetsMenu } from './audio/audio-presets-menu';
import { formatNumber, parseNumber } from './number-fields';
const NONE = '';
type LoopChoice = 'document' | 'on' | 'off';
const LOOP_OPTIONS: ReadonlyArray<{
    value: LoopChoice;
    label: string;
}> = [
    { value: 'document', label: 'Do efeito' },
    { value: 'on', label: 'Repetir' },
    { value: 'off', label: 'Uma vez' },
];
const STATE_LABEL: Record<VfxInstanceState, string> = { stopped: 'Parado', playing: 'Tocando', paused: 'Pausado', finished: 'Concluído' };
const STATE_TONE: Record<VfxInstanceState, StatusTone> = { stopped: 'muted', playing: 'ok', paused: 'info', finished: 'muted' };
const times = (value: number) => `${Number(value.toFixed(2))}×`;
const seconds = (value: number) => `${value.toFixed(1)} s`;
const orAlways = (value: number) => (value <= 0 ? 'sempre' : `${Math.round(value)} m`);
const TEMPLATE_PRESETS = VFX_TEMPLATES.map(({ id, label, description }) => ({ id, label, description }));
function Hint({ children }: {
    children: React.ReactNode;
}) {
    return <p className="px-2 py-0.5 text-3xs leading-relaxed text-pretty text-muted-foreground">{children}</p>;
}
function loopChoice(settings: VfxSettings): LoopChoice {
    return settings.loop === null ? 'document' : settings.loop ? 'on' : 'off';
}
function EffectPicker({ entity, settings }: {
    entity: Entity;
    settings: VfxSettings;
}) {
    const session = useEditorSession();
    const effects = session.library.byKind('vfx');
    const asset = settings.assetId ? (session.library.get(settings.assetId) ?? null) : null;
    const missing = settings.assetId !== null && asset === null;
    const live = asset !== null && session.vfx.assetId === asset.id && session.vfx.stageEntityId === entity.id;
    const options = [{ value: NONE, label: missing ? 'Efeito removido da biblioteca' : effects.length === 0 ? 'Nenhum (crie um efeito abaixo)' : '— nenhum —' }, ...effects.map((effect) => ({ value: effect.id, label: effect.name }))];
    return (<>
      <PropertyRow label="Efeito">
        <SelectField label="Efeito da biblioteca" options={options} value={asset?.id ?? NONE} onChange={(value) => setVfxAsset(session, entity, value === NONE ? null : value)}/>
        {asset && (<IconButton label="Abrir no editor de efeitos" size="sm" active={live} onClick={() => void openVfxAssetInEditor(session, asset)}>
            <PenLine />
          </IconButton>)}
      </PropertyRow>
      {effects.length === 0 && (<ActionRow>
          <ActionButton icon={Plus} variant="primary" title="Cria um efeito a partir de um modelo neste ator e o abre no editor" onClick={() => void createVfxEffect(session, 'campfire', { stage: entity })}>
            Criar efeito…
          </ActionButton>
          <AudioPresetsMenu title="Modelos de efeito" label="Modelos" presets={TEMPLATE_PRESETS} onPick={(templateId) => void createVfxEffect(session, templateId, { stage: entity })}/>
        </ActionRow>)}
    </>);
}
function LiveStatus({ entity, settings }: {
    entity: Entity;
    settings: VfxSettings;
}) {
    const session = useEditorSession();
    useViewportStats();
    const instance = session.vfxWorld.system.instanceOf(entity.id);
    const inGame = session.playtest.state === 'playing';
    if (!settings.assetId) {
        return (<PropertyRow label="Estado">
        <StatusChip tone="warn">Sem efeito</StatusChip>
      </PropertyRow>);
    }
    if (!instance) {
        const asset = session.library.get(settings.assetId);
        return (<PropertyRow label="Estado">
        <StatusChip tone={asset ? 'info' : 'danger'}>{asset ? (entity.visible ? 'Carregando' : 'Ator oculto') : 'Ativo ausente'}</StatusChip>
      </PropertyRow>);
    }
    const editorOnly = !inGame && !settings.playInEditor;
    return (<>
      <PropertyRow label="Estado">
        <StatusChip tone={editorOnly ? 'muted' : STATE_TONE[instance.state]}>{editorOnly ? 'Só no jogo' : STATE_LABEL[instance.state]}</StatusChip>
        {instance.state !== 'stopped' && !editorOnly && (<span className="truncate font-mono text-3xs tabular-nums text-muted-foreground">
            {instance.alive.toLocaleString('pt-BR')} partículas · {seconds(instance.time)}
            {instance.cycle > 0 ? ` · ciclo ${instance.cycle + 1}` : ''}
          </span>)}
      </PropertyRow>
    </>);
}
function Transport({ entity, settings }: {
    entity: Entity;
    settings: VfxSettings;
}) {
    const session = useEditorSession();
    useViewportStats();
    const instance = session.vfxWorld.system.instanceOf(entity.id);
    const playing = instance?.state === 'playing';
    const paused = instance?.state === 'paused';
    const disabled = !settings.assetId;
    return (<ActionRow>
      <ActionButton icon={Play} variant="primary" disabled={disabled} title={playing ? 'Reiniciar do começo' : 'Tocar agora'} onClick={() => playVfx(session, entity)}>
        {playing ? 'Reiniciar' : 'Tocar'}
      </ActionButton>
      <ActionButton icon={paused ? Play : Pause} disabled={disabled || !instance || instance.state === 'stopped'} title={paused ? 'Continuar de onde parou' : 'Congelar as partículas neste instante'} onClick={() => toggleVfxPause(session, entity)}>
        {paused ? 'Continuar' : 'Pausar'}
      </ActionButton>
      <ActionButton icon={Square} disabled={disabled || !instance || instance.state === 'stopped'} title="Parar e limpar as partículas" onClick={() => stopVfx(session, entity)}>
        Parar
      </ActionButton>
    </ActionRow>);
}
function SeedField({ entity, settings }: {
    entity: Entity;
    settings: VfxSettings;
}) {
    const session = useEditorSession();
    return (<PropertyRow label="Semente">
      <FieldInput key={`seed-${settings.seed}`} defaultValue={settings.seed === 0 ? '' : String(settings.seed)} placeholder="aleatória" aria-label="Semente da aleatoriedade" title="0 ou vazio sorteia a cada reprodução; um número fixo repete sempre o mesmo efeito" onBlur={(event) => {
            const text = event.currentTarget.value.trim();
            setVfxScalar(session, entity, 'seed', text === '' ? 0 : parseNumber(text));
        }} onKeyDown={(event) => {
            if (event.key === 'Enter')
                event.currentTarget.blur();
        }}/>
      <IconButton label="Sortear uma semente fixa" size="sm" onClick={() => setVfxScalar(session, entity, 'seed', Math.floor(Math.random() * 4294967295))}>
        <Dices />
      </IconButton>
      <IconButton label="Voltar à semente aleatória" size="sm" disabled={settings.seed === 0} onClick={() => setVfxScalar(session, entity, 'seed', 0)}>
        <Square />
      </IconButton>
    </PropertyRow>);
}
export function VfxSection({ entity }: {
    entity: Entity;
}) {
    const session = useEditorSession();
    const settings = entity.vfx;
    if (!settings)
        return null;
    const detachable = entity.kind !== 'vfx';
    return (<CollapsibleSection title="Efeito visual" trailing={detachable ? (<IconButton label="Remover efeito do ator" size="xs" className="hover:text-destructive" onClick={() => detachVfx(session, entity)}>
            <Trash2 />
          </IconButton>) : undefined}>
      <EffectPicker entity={entity} settings={settings}/>
      <LiveStatus entity={entity} settings={settings}/>
      <Transport entity={entity} settings={settings}/>
      <ToggleField label="Tocar sozinho" on={settings.autoPlay} onToggle={() => patchVfx(session, entity, { autoPlay: !settings.autoPlay }, `${entity.name} ${settings.autoPlay ? 'espera comando' : 'toca sozinho'}`)}/>
      <ToggleField label="Tocar no editor" on={settings.playInEditor} onToggle={() => patchVfx(session, entity, { playInEditor: !settings.playInEditor }, `${entity.name} ${settings.playInEditor ? 'só no jogo' : 'também no editor'}`)}/>
      <PropertyRow label="Laço">
        <SegmentedControl label="Laço" options={LOOP_OPTIONS} value={loopChoice(settings)} onChange={(choice) => patchVfx(session, entity, { loop: choice === 'document' ? null : choice === 'on' }, `Laço de ${entity.name}`)}/>
      </PropertyRow>
      <div onPointerUp={() => endVfxEdit(session)} onKeyUp={() => endVfxEdit(session)}>
        <SliderField label="Escala" value={settings.scale} min={VFX_SCALE_MIN} max={VFX_SCALE_MAX} scale="log" editable suffix="×" format={times} onChange={(value) => setVfxScalar(session, entity, 'scale', value)}/>
        <SliderField label="Velocidade" value={settings.timeScale} min={0} max={VFX_TIME_SCALE_MAX} step={0.05} editable suffix="×" format={times} onChange={(value) => setVfxScalar(session, entity, 'timeScale', value)}/>
        <SliderField label="Simular até" value={settings.cullDistance} min={0} max={Math.min(VFX_CULL_DISTANCE_MAX, 500)} step={1} editable suffix=" m" format={orAlways} onChange={(value) => setVfxScalar(session, entity, 'cullDistance', value)}/>
      </div>
      <SeedField entity={entity} settings={settings}/>
    </CollapsibleSection>);
}
