'use client';
import { useRef } from 'react';
import { RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDb } from '@/engine/audio/core/decibels';
import { AUDIO_BUSES, BUS_VOLUME_MAX_DB, BUS_VOLUME_MIN_DB, anyBusSoloed, type AudioBusInfo } from '@/engine/audio/mixer/mixer-settings';
import { useAudioEditor, useLimiterReductionFrames } from '@/engine/editor/audio/ui/use-audio-editor';
import { useAudioWorld } from '@/engine/editor/audio/ui/use-audio-world';
import { resetMixer, setBusVolume, toggleBusMute, toggleBusSolo } from '@/engine/editor/operations/audio-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { ActionButton } from '@/engine/ui/action-button';
import { LevelMeterBars } from './level-meter-bars';
import { VerticalFader } from './vertical-fader';
const STRIP_BUTTON_CLASS = 'h-5 min-w-0 flex-1 rounded-sm border text-3xs font-semibold leading-none transition-colors focus-visible:outline-1 focus-visible:outline-offset-[-1px] focus-visible:outline-primary';
const LIMITING_DB = -0.5;
function LimiterReadout({ active }: {
    active: boolean;
}) {
    const editor = useAudioEditor();
    const outputRef = useRef<HTMLOutputElement>(null);
    const valueRef = useRef<HTMLSpanElement>(null);
    useLimiterReductionFrames(editor.engine, active, (reduction) => {
        const limiting = reduction <= LIMITING_DB;
        if (outputRef.current)
            outputRef.current.dataset.limiting = limiting ? 'true' : 'false';
        if (valueRef.current)
            valueRef.current.textContent = limiting ? formatDb(reduction) : '—';
    });
    return (<output ref={outputRef} aria-live="off" data-limiting="false" title="Limitador de segurança: transparente até −1 dBFS; acima, segura os picos para a saída nunca estourar" className="flex items-center justify-center gap-1 font-mono text-[9px] text-muted-foreground/70 tabular-nums data-[limiting=true]:text-warning">
      <span className="tracking-wider">LIM</span>
      <span ref={valueRef}>—</span>
    </output>);
}
function BusStrip({ bus, active }: {
    bus: AudioBusInfo;
    active: boolean;
}) {
    const session = useEditorSession();
    const editor = useAudioEditor();
    const mixer = session.scene.audio;
    const settings = mixer.buses[bus.id];
    const master = bus.id === 'master';
    const silenced = settings.muted || (!master && anyBusSoloed(mixer) && !settings.solo);
    const openClipHere = !master && editor.settings?.bus === bus.id;
    return (<section aria-label={`Barramento ${bus.label}`} className={cn('flex w-[4.75rem] shrink-0 flex-col items-stretch gap-1.5 rounded-sm border bg-surface px-1.5 pt-1.5 pb-1.5', master ? 'border-border-strong' : 'border-border', openClipHere && 'ring-1 ring-primary/40')}>
      <header className="flex flex-col items-center leading-tight" title={bus.description}>
        <span className={cn('font-mono text-3xs font-semibold tracking-wider', silenced ? 'text-muted-foreground/60' : 'text-foreground')}>{bus.shortLabel}</span>
        <span className="truncate text-[9px] text-muted-foreground">{bus.label}</span>
      </header>

      <div className="flex min-h-0 flex-1 items-stretch justify-center gap-1.5">
        <LevelMeterBars meter={editor.engine.meter(bus.id)} active={active && !silenced} label={`Nível de ${bus.label}`}/>
        <VerticalFader label={`Volume de ${bus.label}`} value={settings.volumeDb} min={BUS_VOLUME_MIN_DB} max={BUS_VOLUME_MAX_DB} step={0.5} resetValue={0} valueText={formatDb(settings.volumeDb)} onChange={(value) => setBusVolume(session, bus.id, value)} onCommit={() => session.history.endMerge()}/>
      </div>

      <output aria-live="off" className={cn('text-center font-mono text-3xs tabular-nums', silenced ? 'text-muted-foreground/60 line-through' : 'text-foreground')}>
        {formatDb(settings.volumeDb)}
      </output>
      {master && <LimiterReadout active={active && !silenced}/>}

      <div className="flex gap-1">
        <button type="button" aria-pressed={settings.muted} title={settings.muted ? 'Silenciado (clique para ativar)' : 'Silenciar'} onClick={() => toggleBusMute(session, bus.id)} className={cn(STRIP_BUTTON_CLASS, settings.muted ? 'border-destructive/60 bg-destructive/20 text-destructive' : 'border-border text-muted-foreground hover:bg-highlight hover:text-foreground')}>
          M
        </button>
        {!master && (<button type="button" aria-pressed={settings.solo} title={settings.solo ? 'Em solo (clique para liberar os demais)' : 'Solo: só este barramento soa'} onClick={() => toggleBusSolo(session, bus.id)} className={cn(STRIP_BUTTON_CLASS, settings.solo ? 'border-warning/60 bg-warning/20 text-warning' : 'border-border text-muted-foreground hover:bg-highlight hover:text-foreground')}>
            S
          </button>)}
      </div>
    </section>);
}
export function MixerView() {
    const session = useEditorSession();
    const editor = useAudioEditor();
    const world = useAudioWorld();
    const active = editor.playing || editor.quickPreviewAssetId !== null || world.animating;
    const touched = AUDIO_BUSES.some((bus) => {
        const settings = session.scene.audio.buses[bus.id];
        return settings.volumeDb !== 0 || settings.muted || settings.solo;
    });
    return (<div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1 items-stretch gap-1.5 overflow-x-auto px-2 py-2 [scrollbar-width:thin]">
        {AUDIO_BUSES.map((bus) => (<BusStrip key={bus.id} bus={bus} active={active}/>))}
        <div className="ml-auto flex min-w-36 shrink-0 flex-col justify-between gap-2 py-0.5 pl-1">
          <p className="text-3xs leading-relaxed text-pretty text-muted-foreground">
            Cada clipe toca no barramento escolhido nele; o Master soma todos. Os faders ficam salvos com a cena.
            {!editor.engine.supported && ' Este navegador não oferece Web Audio: os medidores ficam parados.'}
          </p>
          <ActionButton icon={RotateCcw} disabled={!touched} className="self-start" title="Todos os faders a 0 dB, sem mudo nem solo" onClick={() => resetMixer(session)}>
            Restaurar a mesa
          </ActionButton>
        </div>
      </div>
    </div>);
}
