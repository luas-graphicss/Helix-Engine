'use client';
import { Scissors, X } from 'lucide-react';
import type { AudioLibraryAsset } from '@/engine/assets/library/audio-asset';
import { countEnabledEffects } from '@/engine/audio/clip/audio-effects';
import { CLIP_PITCH_RANGE, CLIP_RANDOM_PITCH_MAX, CLIP_RANDOM_VOLUME_MAX_DB, CLIP_VOLUME_MAX_DB, CLIP_VOLUME_MIN_DB, FADE_CURVES, FADE_MAX_SECONDS, MIN_REGION_SECONDS, type AudioClipSettings, type ClipRegion, } from '@/engine/audio/clip/audio-clip-settings';
import { clamp, formatClipTime, formatDb, formatMilliseconds, formatSemitones } from '@/engine/audio/core/decibels';
import { busInfo, CLIP_BUSES } from '@/engine/audio/mixer/mixer-settings';
import { useAudioEditor } from '@/engine/editor/audio/ui/use-audio-editor';
import { patchAudioClip, trimSilenceAudioClip } from '@/engine/editor/operations/audio-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { ActionButton, ActionRow } from '@/engine/ui/action-button';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { PropertyRow } from '@/engine/ui/property-row';
import { SelectField } from '@/engine/ui/select-field';
import { SliderField } from '@/engine/ui/slider-field';
import { ToggleField } from '@/engine/ui/toggle-field';
import { EffectsSections } from './effects-sections';
import { LevelMeterBars } from './level-meter-bars';
const BUS_OPTIONS = CLIP_BUSES.flatMap((bus) => (bus.id === 'master' ? [] : [{ value: bus.id, label: bus.label }]));
function formatPan(pan: number): string {
    if (Math.abs(pan) < 0.005)
        return 'Centro';
    return pan < 0 ? `${Math.round(-pan * 100)}% E` : `${Math.round(pan * 100)}% D`;
}
const formatPlusMinusSemitones = (value: number) => (value === 0 ? 'Nenhuma' : `±${formatSemitones(value).replace(/^[+−]/, '')}`);
const formatPlusMinusDb = (value: number) => (value === 0 ? 'Nenhuma' : `±${formatDb(value).replace(/^[+−]/, '')}`);
type ClipProps = {
    asset: AudioLibraryAsset;
    settings: AudioClipSettings;
    region: ClipRegion;
    duration: number;
};
function PlaybackSection({ asset, settings }: Pick<ClipProps, 'asset' | 'settings'>) {
    const session = useEditorSession();
    const patch = (value: Partial<AudioClipSettings>, label: string, mergeKey?: string) => patchAudioClip(session, asset, value, `${label} de ${asset.name}`, mergeKey);
    return (<CollapsibleSection title="Reprodução">
      <PropertyRow label="Barramento">
        <SelectField label="Barramento" options={BUS_OPTIONS} value={settings.bus} onChange={(bus) => patch({ bus }, `Barramento ${busInfo(bus).label}`)}/>
      </PropertyRow>
      <SliderField label="Volume" value={settings.volumeDb} min={CLIP_VOLUME_MIN_DB} max={CLIP_VOLUME_MAX_DB} step={0.1} format={formatDb} onChange={(volumeDb) => patch({ volumeDb }, 'Volume', `clip:${asset.id}:volumeDb`)}/>
      <SliderField label="Tom" value={settings.pitch} min={-CLIP_PITCH_RANGE} max={CLIP_PITCH_RANGE} step={0.5} format={formatSemitones} onChange={(pitch) => patch({ pitch }, 'Tom', `clip:${asset.id}:pitch`)}/>
      <SliderField label="Pan" value={settings.pan} min={-1} max={1} step={0.01} format={formatPan} onChange={(pan) => patch({ pan }, 'Pan', `clip:${asset.id}:pan`)}/>
      <ToggleField label="Laço" on={settings.loop} onToggle={() => patch({ loop: !settings.loop }, `${settings.loop ? 'Desligar' : 'Ligar'} laço`)}/>
    </CollapsibleSection>);
}
function RegionSection({ asset, settings, region, duration }: ClipProps) {
    const session = useEditorSession();
    const editor = useAudioEditor();
    const loop = editor.loopRange;
    const trimmed = settings.trimStart > 0 || settings.trimEnd !== null;
    const analyzed = asset.details.analysis !== null;
    const patch = (value: Partial<AudioClipSettings>, label: string, mergeKey?: string) => patchAudioClip(session, asset, value, `${label} de ${asset.name}`, mergeKey);
    return (<CollapsibleSection title="Recorte e laço">
      <SliderField label="Início" value={region.start} min={0} max={duration} step={0.001} format={formatClipTime} onChange={(value) => patch({ trimStart: clamp(value, 0, region.end - MIN_REGION_SECONDS) }, 'Início do recorte', `clip:${asset.id}:trimStart`)}/>
      <SliderField label="Fim" value={region.end} min={0} max={duration} step={0.001} format={formatClipTime} onChange={(value) => {
            const end = clamp(value, region.start + MIN_REGION_SECONDS, duration);
            patch({ trimEnd: end >= duration - 1e-3 ? null : end }, 'Fim do recorte', `clip:${asset.id}:trimEnd`);
        }}/>
      {settings.loop && loop && (<>
          <SliderField label="Laço de" value={loop.start} min={region.start} max={region.end} step={0.001} format={formatClipTime} onChange={(value) => patch({ loopStart: clamp(value, region.start, loop.end - MIN_REGION_SECONDS) }, 'Início do laço', `clip:${asset.id}:loopStart`)}/>
          <SliderField label="Laço até" value={loop.end} min={region.start} max={region.end} step={0.001} format={formatClipTime} onChange={(value) => patch({ loopEnd: clamp(value, loop.start + MIN_REGION_SECONDS, region.end) }, 'Fim do laço', `clip:${asset.id}:loopEnd`)}/>
        </>)}
      <ActionRow>
        <ActionButton icon={Scissors} className="flex-1" disabled={!analyzed} title={analyzed ? 'Move o recorte para onde o som começa e termina (acima de −60 dBFS)' : 'Analise o áudio para detectar os silêncios'} onClick={() => trimSilenceAudioClip(session, asset)}>
          Recortar silêncio
        </ActionButton>
        <ActionButton icon={X} disabled={!trimmed && !settings.loopStart && !settings.loopEnd} title="Voltar ao arquivo inteiro" onClick={() => patch({ trimStart: 0, trimEnd: null, loopStart: null, loopEnd: null }, 'Limpar recorte')}/>
      </ActionRow>
    </CollapsibleSection>);
}
function FadesSection({ asset, settings, region }: Pick<ClipProps, 'asset' | 'settings' | 'region'>) {
    const session = useEditorSession();
    const maxFade = Math.min(FADE_MAX_SECONDS, Math.max(MIN_REGION_SECONDS, region.end - region.start));
    const patch = (value: Partial<AudioClipSettings>, label: string, mergeKey?: string) => patchAudioClip(session, asset, value, `${label} de ${asset.name}`, mergeKey);
    return (<CollapsibleSection title="Fades" defaultOpen={settings.fadeIn.duration > 0 || settings.fadeOut.duration > 0}>
      <SliderField label="Entrada" value={settings.fadeIn.duration} min={0} max={maxFade} step={0.01} format={formatMilliseconds} onChange={(duration) => patch({ fadeIn: { ...settings.fadeIn, duration } }, 'Fade de entrada', `clip:${asset.id}:fadeIn`)}/>
      <PropertyRow label="Curva">
        <SelectField label="Curva do fade de entrada" options={FADE_CURVES} value={settings.fadeIn.curve} onChange={(curve) => patch({ fadeIn: { ...settings.fadeIn, curve } }, 'Curva do fade de entrada')}/>
      </PropertyRow>
      <SliderField label="Saída" value={settings.fadeOut.duration} min={0} max={maxFade} step={0.01} disabled={settings.loop} format={formatMilliseconds} onChange={(duration) => patch({ fadeOut: { ...settings.fadeOut, duration } }, 'Fade de saída', `clip:${asset.id}:fadeOut`)}/>
      <PropertyRow label="Curva">
        <SelectField label="Curva do fade de saída" options={FADE_CURVES} value={settings.fadeOut.curve} disabled={settings.loop} onChange={(curve) => patch({ fadeOut: { ...settings.fadeOut, curve } }, 'Curva do fade de saída')}/>
      </PropertyRow>
      {settings.loop && <p className="px-2 text-3xs leading-relaxed text-muted-foreground">Em laço o clipe só termina quando é parado, então o fade de saída não se aplica.</p>}
    </CollapsibleSection>);
}
function VariationSection({ asset, settings }: Pick<ClipProps, 'asset' | 'settings'>) {
    const session = useEditorSession();
    const patch = (value: Partial<AudioClipSettings>, label: string, mergeKey?: string) => patchAudioClip(session, asset, value, `${label} de ${asset.name}`, mergeKey);
    return (<CollapsibleSection title="Variação por disparo" defaultOpen={settings.randomPitch > 0 || settings.randomVolumeDb > 0}>
      <SliderField label="Tom" value={settings.randomPitch} min={0} max={CLIP_RANDOM_PITCH_MAX} step={0.5} format={formatPlusMinusSemitones} onChange={(randomPitch) => patch({ randomPitch }, 'Variação de tom', `clip:${asset.id}:randomPitch`)}/>
      <SliderField label="Volume" value={settings.randomVolumeDb} min={0} max={CLIP_RANDOM_VOLUME_MAX_DB} step={0.5} format={formatPlusMinusDb} onChange={(randomVolumeDb) => patch({ randomVolumeDb }, 'Variação de volume', `clip:${asset.id}:randomVolumeDb`)}/>
      <p className="px-2 text-3xs leading-relaxed text-pretty text-muted-foreground">Cada disparo no jogo sorteia tom e volume dentro da faixa; passos e impactos repetidos deixam de soar iguais. A prévia rápida nos Ativos já sorteia.</p>
    </CollapsibleSection>);
}
export function ClipInspector() {
    const editor = useAudioEditor();
    const asset = editor.asset;
    const settings = editor.settings;
    const region = editor.region;
    if (!asset || !settings)
        return null;
    const active = editor.playing;
    const effects = countEnabledEffects(settings.effects);
    const duration = editor.duration;
    return (<aside aria-label="Ajustes do clipe" className="flex max-h-[50%] w-full min-w-0 shrink-0 flex-col border-t border-border bg-surface @2xl/panel:max-h-none @2xl/panel:w-72 @2xl/panel:border-t-0 @2xl/panel:border-l">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <PropertyRow label={busInfo(settings.bus).label}>
          <LevelMeterBars meter={editor.engine.meter(settings.bus)} active={active} label={`Nível de ${busInfo(settings.bus).label}`} orientation="horizontal" className="py-1"/>
        </PropertyRow>
        <PlaybackSection asset={asset} settings={settings}/>
        {region && duration > 0 && (<>
            <RegionSection asset={asset} settings={settings} region={region} duration={duration}/>
            <FadesSection asset={asset} settings={settings} region={region}/>
          </>)}
        <VariationSection asset={asset} settings={settings}/>
        <div className="flex h-7 items-center border-y border-border bg-surface-raised/60 pl-1.5 text-2xs font-semibold tracking-wide text-foreground uppercase">
          <span className="truncate">Efeitos</span>
          <span className="ml-1.5 font-mono text-3xs font-normal tracking-normal text-muted-foreground">{effects === 0 ? 'nenhum ativo' : `${effects} ${effects === 1 ? 'ativo' : 'ativos'}`}</span>
        </div>
        <EffectsSections asset={asset}/>
      </div>
    </aside>);
}
