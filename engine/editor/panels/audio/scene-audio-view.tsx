'use client';
import { Headphones, Locate, Play, Plus, Radio, Square, SquareDashed, Unlock, Volume2, VolumeX } from 'lucide-react';
import type { Entity } from '@/engine/core/scene/entity';
import { formatDb, formatPercent } from '@/engine/audio/core/decibels';
import { AUDIO_SOURCE_TRIGGER_LABEL } from '@/engine/audio/world/audio-source-settings';
import { zoneWeightAt } from '@/engine/audio/world/audio-zone-settings';
import { SourceStatusChip, StatusChip } from '@/engine/editor/audio/ui/source-status';
import { TestSignalMenu } from '@/engine/editor/audio/ui/test-signal-menu';
import { useAudioEditor } from '@/engine/editor/audio/ui/use-audio-editor';
import { useAudioWorld } from '@/engine/editor/audio/ui/use-audio-world';
import { addAudioZone, addSoundSource, patchAudioZone, setAudioAudition, setAudioSourceMuted, soloAudioSource, stopAllAudioSources, toggleAudioSource, } from '@/engine/editor/operations/audio-world-operations';
import { useEditorSession, useSessionTopic } from '@/engine/editor/session/editor-session-context';
import { ActionButton } from '@/engine/ui/action-button';
import { IconButton } from '@/engine/ui/icon-button';
import { ToggleSwitch } from '@/engine/ui/toggle-field';
import { cn } from '@/lib/utils';
const meters = (value: number) => `${Number(value.toFixed(1))} m`;
interface SceneAudio {
    readonly sources: Entity[];
    readonly zones: Entity[];
}
function collectSceneAudio(root: Entity): SceneAudio {
    const sources: Entity[] = [];
    const zones: Entity[] = [];
    const walk = (entity: Entity) => {
        if (entity.audioSource)
            sources.push(entity);
        if (entity.audioZone)
            zones.push(entity);
        for (const child of entity.children)
            walk(child);
    };
    walk(root);
    return { sources, zones };
}
const ROW_CLASS = 'group flex h-7 cursor-default items-center gap-1.5 rounded-sm px-1.5 text-2xs select-none';
function useRowHandlers(entity: Entity) {
    const session = useEditorSession();
    return {
        onClick: () => session.select(entity),
        onDoubleClick: () => {
            session.select(entity);
            session.focusEntity(entity);
        },
    };
}
function SourceRow({ entity }: {
    entity: Entity;
}) {
    const session = useEditorSession();
    const world = useAudioWorld();
    const settings = entity.audioSource;
    const handlers = useRowHandlers(entity);
    if (!settings)
        return null;
    const runtime = world.runtime(entity.id);
    const status = runtime?.status ?? (entity.visible ? 'stopped' : 'off');
    const active = world.isLatched(entity.id) || world.isPlaying(entity.id);
    const solo = world.soloSourceId === entity.id;
    const selected = session.isSelected(entity);
    const asset = settings.assetId ? session.library.get(settings.assetId) : null;
    return (<div role="row" aria-selected={selected} {...handlers} className={cn(ROW_CLASS, selected ? 'bg-primary/15 text-foreground' : 'text-foreground/90 hover:bg-highlight', !entity.visible && 'opacity-60')}>
      <Volume2 className={cn('size-3.5 shrink-0', status === 'playing' ? 'text-axis-y' : 'text-muted-foreground')} aria-hidden/>
      <span className="min-w-0 flex-1 truncate" title={entity.name}>
        {entity.name}
      </span>
      <span className="hidden min-w-0 max-w-32 truncate text-3xs text-muted-foreground @4xl/panel:inline" title={asset ? asset.name : 'Sem áudio'}>
        {asset ? asset.name : '— sem áudio —'}
      </span>
      <span className="hidden shrink-0 text-3xs text-muted-foreground @5xl/panel:inline">{AUDIO_SOURCE_TRIGGER_LABEL[settings.trigger]}</span>
      {runtime && (<span className="hidden w-28 shrink-0 truncate text-right font-mono text-3xs tabular-nums text-muted-foreground @2xl/panel:inline" title="Distância ao ouvinte · atenuação por distância">
          {meters(runtime.distance)}
          {settings.spatial && ` · ${formatDb(runtime.distanceDb, 0)}`}
        </span>)}
      <SourceStatusChip status={status} className="w-28 justify-center"/>
      <IconButton label={active ? 'Parar' : 'Tocar'} size="sm" disabled={!settings.assetId} active={active} onClick={(event) => { event.stopPropagation(); toggleAudioSource(session, entity); }}>
        {active ? <Square /> : <Play />}
      </IconButton>
      <IconButton label={solo ? 'Sair do solo' : 'Solo'} size="sm" className={cn(solo && 'bg-warning/15 text-warning hover:bg-warning/20 hover:text-warning')} onClick={(event) => { event.stopPropagation(); soloAudioSource(session, entity); }}>
        <Headphones />
      </IconButton>
      <IconButton label={settings.muted ? 'Ativar o som' : 'Silenciar'} size="sm" className={cn(settings.muted && 'bg-destructive/15 text-destructive hover:bg-destructive/20 hover:text-destructive')} onClick={(event) => { event.stopPropagation(); setAudioSourceMuted(session, entity, !settings.muted); }}>
        {settings.muted ? <VolumeX /> : <Volume2 />}
      </IconButton>
      <IconButton label="Enquadrar" size="sm" className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100" onClick={(event) => { event.stopPropagation(); session.select(entity); session.focusEntity(entity); }}>
        <Locate />
      </IconButton>
    </div>);
}
function ZoneRow({ entity }: {
    entity: Entity;
}) {
    const session = useEditorSession();
    const world = useAudioWorld();
    const settings = entity.audioZone;
    const handlers = useRowHandlers(entity);
    if (!settings)
        return null;
    const weight = settings.enabled ? zoneWeightAt(settings, entity.worldMatrix, session.camera.position) : 0;
    const dominant = world.activeZone?.entity.id === entity.id;
    const selected = session.isSelected(entity);
    const features = [settings.reverb.enabled && 'reverb', settings.echo.enabled && 'eco', settings.filter.enabled && 'filtro', settings.ambience.assetId && 'cama'].filter(Boolean).join(' · ');
    return (<div role="row" aria-selected={selected} {...handlers} className={cn(ROW_CLASS, selected ? 'bg-primary/15 text-foreground' : 'text-foreground/90 hover:bg-highlight', !entity.visible && 'opacity-60')}>
      <Radio className={cn('size-3.5 shrink-0', dominant ? 'text-axis-y' : 'text-muted-foreground')} aria-hidden/>
      <span className="min-w-0 flex-1 truncate" title={entity.name}>
        {entity.name}
      </span>
      <span className="hidden min-w-0 truncate text-3xs text-muted-foreground @4xl/panel:inline">{features || 'sem acústica'}</span>
      <StatusChip tone={!settings.enabled ? 'muted' : weight >= 0.999 ? (dominant ? 'ok' : 'info') : weight > 0 ? 'info' : 'muted'} className="w-28 justify-center">
        {!settings.enabled ? 'Desligada' : weight >= 0.999 ? (dominant ? 'Ativa' : 'Dentro') : weight > 0 ? `Transição ${formatPercent(weight)}` : 'Fora'}
      </StatusChip>
      <ToggleSwitch label={`Zona ${entity.name} ativa`} on={settings.enabled} onToggle={() => patchAudioZone(session, entity, { enabled: !settings.enabled }, `${settings.enabled ? 'Desligar' : 'Ligar'} zona ${entity.name}`)}/>
      <IconButton label="Enquadrar" size="sm" className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100" onClick={(event) => { event.stopPropagation(); session.select(entity); session.focusEntity(entity); }}>
        <Locate />
      </IconButton>
    </div>);
}
function ListHeader({ title, count, children }: {
    title: string;
    count: number;
    children?: React.ReactNode;
}) {
    return (<div className="flex min-h-7 shrink-0 flex-wrap items-center gap-x-2 gap-y-1 px-1.5 py-0.5">
      <span className="truncate text-2xs font-semibold tracking-wide text-foreground uppercase">{title}</span>
      <span className="shrink-0 font-mono text-3xs text-muted-foreground">{count}</span>
      <div className="ml-auto flex shrink-0 items-center gap-1">{children}</div>
    </div>);
}
function UnlockBanner() {
    const editor = useAudioEditor();
    return (<button type="button" onClick={() => void editor.engine.unlock()} className="flex h-7 shrink-0 items-center gap-2 border-b border-warning/40 bg-warning/10 px-2 text-left text-2xs text-warning transition-colors hover:bg-warning/15">
      <Unlock className="size-3.5 shrink-0" aria-hidden/>
      <span className="truncate">O navegador só libera o som depois de um gesto seu: clique aqui (ou em qualquer lugar) para ouvir a cena.</span>
    </button>);
}
function Summary() {
    const world = useAudioWorld();
    const { snapshot } = world;
    const zone = snapshot.activeZone;
    return (<div className="flex min-w-0 flex-1 basis-40 items-center gap-2 font-mono text-3xs tabular-nums text-muted-foreground">
      <span className="shrink-0 whitespace-nowrap" title="Vozes espaciais tocando agora">
        <span className={cn(snapshot.playing > 0 && 'text-axis-y')}>{snapshot.playing}</span> tocando
      </span>
      <span className="shrink-0 whitespace-nowrap" title="Fontes fora do alcance ou sem voz livre: sem custo">
        {snapshot.virtual} virtuais
      </span>
      {snapshot.loading > 0 && <span className="shrink-0 whitespace-nowrap">{snapshot.loading} carregando</span>}
      <span className="min-w-0 truncate" title="Zona acústica onde o ouvinte está">
        {zone ? `zona ${zone.name} (${formatPercent(zone.weight)})` : 'ao ar livre'}
      </span>
    </div>);
}
export function SceneAudioView() {
    const session = useSessionTopic('scene', 'selection', 'assets', 'playtest', 'view');
    const world = useAudioWorld();
    const { sources, zones } = collectSceneAudio(session.scene.root);
    const playing = sources.some((entity) => world.isLatched(entity.id) || world.isPlaying(entity.id));
    const inGame = session.playtest.state !== 'stopped';
    return (<div className="flex h-full min-h-0 flex-col">
      {world.snapshot.locked && <UnlockBanner />}
      <div className="flex min-h-panelbar shrink-0 flex-wrap items-center gap-x-2 gap-y-0.5 border-b border-border px-2 py-0.5">
        <label className="flex shrink-0 items-center gap-1.5 text-2xs text-foreground" title="Ouvir fontes automáticas e de proximidade enquanto edita, com a câmera como ouvinte">
          <ToggleSwitch label="Audição no editor" on={world.audition} onToggle={() => setAudioAudition(session, !world.audition)}/>
          Audição
        </label>
        {inGame && (<StatusChip tone="info" className="shrink-0">
            em jogo
          </StatusChip>)}
        <Summary />
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <ActionButton icon={SquareDashed} disabled={!playing && world.snapshot.playing === 0} title="Cala todas as fontes e camas, com rampa" onClick={() => stopAllAudioSources(session)}>
            Parar tudo
          </ActionButton>
        </div>
      </div>

      
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-2 @3xl/panel:flex-row">
        <section aria-label="Fontes de som" className="flex min-h-0 min-w-0 flex-[3] flex-col rounded-sm border border-border bg-surface">
          <ListHeader title="Fontes" count={sources.length}>
            <TestSignalMenu className="h-6" onGenerated={(asset) => addSoundSource(session, { assetId: asset.id })}/>
            <ActionButton icon={Plus} className="h-6" title="Fonte de som sobre o alvo da câmera, com o áudio aberto no editor (ou o primeiro da biblioteca)" onClick={() => addSoundSource(session)}>
              Fonte
            </ActionButton>
          </ListHeader>
          <div role="grid" aria-label="Fontes de som da cena" className="min-h-0 flex-1 overflow-y-auto px-1 pb-1 [scrollbar-width:thin]">
            {sources.length === 0 ? (<p className="px-1.5 py-2 text-3xs leading-relaxed text-pretty text-muted-foreground">
                Nenhuma fonte na cena. Adicione uma aqui ou pelo menu Adicionar · Som; qualquer ator também pode receber uma fonte pela seção Áudio do inspetor.
              </p>) : (sources.map((entity) => <SourceRow key={entity.id} entity={entity}/>))}
          </div>
        </section>

        <section aria-label="Zonas acústicas" className="flex min-h-0 min-w-0 flex-[2] flex-col rounded-sm border border-border bg-surface">
          <ListHeader title="Zonas" count={zones.length}>
            <ActionButton icon={Plus} className="h-6" title="Zona acústica (caixa) apoiada no alvo da câmera" onClick={() => addAudioZone(session)}>
              Zona
            </ActionButton>
          </ListHeader>
          <div role="grid" aria-label="Zonas acústicas da cena" className="min-h-0 flex-1 overflow-y-auto px-1 pb-1 [scrollbar-width:thin]">
            {zones.length === 0 ? (<p className="px-1.5 py-2 text-3xs leading-relaxed text-pretty text-muted-foreground">
                Sem zonas: o mundo soa seco. Uma zona dá reverberação, eco, filtro e cama ambiente a onde o ouvinte estiver dentro dela.
              </p>) : (zones.map((entity) => <ZoneRow key={entity.id} entity={entity}/>))}
          </div>
        </section>
      </div>
    </div>);
}
