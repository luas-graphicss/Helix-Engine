'use client';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { AudioLibraryAsset } from '@/engine/assets/library/audio-asset';
import { EFFECT_LABELS, EFFECT_ORDER, FILTER_KINDS, type AudioEffectKey, type AudioEffectsSettings } from '@/engine/audio/clip/audio-effects';
import { formatDb, formatHertz, formatMilliseconds, formatPercent } from '@/engine/audio/core/decibels';
import { patchAudioEffect, toggleAudioEffect } from '@/engine/editor/operations/audio-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { PropertyRow } from '@/engine/ui/property-row';
import { SelectField } from '@/engine/ui/select-field';
import { SliderField } from '@/engine/ui/slider-field';
import { ToggleField, ToggleSwitch } from '@/engine/ui/toggle-field';
type NumericParam<K extends AudioEffectKey> = {
    [P in keyof AudioEffectsSettings[K]]: AudioEffectsSettings[K][P] extends number ? P : never;
}[keyof AudioEffectsSettings[K]];
type EffectSliderProps<K extends AudioEffectKey> = {
    asset: AudioLibraryAsset;
    effect: K;
    param: NumericParam<K>;
    label: string;
    min: number;
    max: number;
    step?: number;
    scale?: 'linear' | 'log';
    format: (value: number) => string;
};
function EffectSlider<K extends AudioEffectKey>({ asset, effect, param, label, min, max, step, scale, format }: EffectSliderProps<K>) {
    const session = useEditorSession();
    const value = asset.details.clip.effects[effect][param] as number;
    return (<SliderField label={label} value={value} min={min} max={max} step={step} scale={scale} format={format} onChange={(next) => patchAudioEffect(session, asset, effect, { [param]: next } as Partial<AudioEffectsSettings[K]>, `${label} (${EFFECT_LABELS[effect].toLowerCase()}) de ${asset.name}`, `clip:${asset.id}:${effect}.${String(param)}`)}/>);
}
function EffectSection({ asset, effect, children }: {
    asset: AudioLibraryAsset;
    effect: AudioEffectKey;
    children: ReactNode;
}) {
    const session = useEditorSession();
    const enabled = asset.details.clip.effects[effect].enabled;
    const label = EFFECT_LABELS[effect];
    return (<CollapsibleSection title={label} defaultOpen={enabled} trailing={<ToggleSwitch label={`${enabled ? 'Desligar' : 'Ligar'} ${label.toLowerCase()}`} on={enabled} onToggle={() => toggleAudioEffect(session, asset, effect)} className="mr-1"/>}>
      <div className={cn('flex flex-col gap-0.5', !enabled && 'opacity-60')}>{children}</div>
    </CollapsibleSection>);
}
const formatSeconds = (value: number) => `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} s`;
const formatRatio = (value: number) => `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}:1`;
const formatQ = (value: number) => `Q ${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}`;
export function EffectsSections({ asset }: {
    asset: AudioLibraryAsset;
}) {
    const session = useEditorSession();
    const { effects } = asset.details.clip;
    return (<>
      {EFFECT_ORDER.map((effect) => {
            switch (effect) {
                case 'eq':
                    return (<EffectSection key={effect} asset={asset} effect="eq">
                <EffectSlider asset={asset} effect="eq" param="lowGainDb" label="Graves" min={-24} max={24} step={0.5} format={formatDb}/>
                <EffectSlider asset={asset} effect="eq" param="lowFrequency" label="Corte graves" min={40} max={1000} scale="log" format={formatHertz}/>
                <EffectSlider asset={asset} effect="eq" param="midGainDb" label="Médios" min={-24} max={24} step={0.5} format={formatDb}/>
                <EffectSlider asset={asset} effect="eq" param="midFrequency" label="Freq. médios" min={200} max={8000} scale="log" format={formatHertz}/>
                <EffectSlider asset={asset} effect="eq" param="midQ" label="Largura" min={0.1} max={10} scale="log" format={formatQ}/>
                <EffectSlider asset={asset} effect="eq" param="highGainDb" label="Agudos" min={-24} max={24} step={0.5} format={formatDb}/>
                <EffectSlider asset={asset} effect="eq" param="highFrequency" label="Corte agudos" min={1000} max={16000} scale="log" format={formatHertz}/>
              </EffectSection>);
                case 'filter':
                    return (<EffectSection key={effect} asset={asset} effect="filter">
                <PropertyRow label="Tipo">
                  <SelectField label="Tipo de filtro" options={FILTER_KINDS} value={effects.filter.type} onChange={(type) => patchAudioEffect(session, asset, 'filter', { type }, `Tipo de filtro de ${asset.name}`)}/>
                </PropertyRow>
                <EffectSlider asset={asset} effect="filter" param="frequency" label="Frequência" min={20} max={20000} scale="log" format={formatHertz}/>
                <EffectSlider asset={asset} effect="filter" param="q" label="Ressonância" min={0.1} max={20} scale="log" format={formatQ}/>
              </EffectSection>);
                case 'distortion':
                    return (<EffectSection key={effect} asset={asset} effect="distortion">
                <EffectSlider asset={asset} effect="distortion" param="drive" label="Saturação" min={0} max={1} step={0.01} format={formatPercent}/>
                <EffectSlider asset={asset} effect="distortion" param="mix" label="Mistura" min={0} max={1} step={0.01} format={formatPercent}/>
                <ToggleField label="Sobreamostrar" on={effects.distortion.oversample} onToggle={() => patchAudioEffect(session, asset, 'distortion', { oversample: !effects.distortion.oversample }, `Sobreamostragem da distorção de ${asset.name}`)}/>
              </EffectSection>);
                case 'compressor':
                    return (<EffectSection key={effect} asset={asset} effect="compressor">
                <EffectSlider asset={asset} effect="compressor" param="thresholdDb" label="Limiar" min={-60} max={0} step={0.5} format={formatDb}/>
                <EffectSlider asset={asset} effect="compressor" param="ratio" label="Razão" min={1} max={20} step={0.1} format={formatRatio}/>
                <EffectSlider asset={asset} effect="compressor" param="knee" label="Joelho" min={0} max={40} step={0.5} format={(value) => formatDb(value, 0)}/>
                <EffectSlider asset={asset} effect="compressor" param="attack" label="Ataque" min={0.001} max={1} scale="log" format={formatMilliseconds}/>
                <EffectSlider asset={asset} effect="compressor" param="release" label="Soltura" min={0.01} max={2} scale="log" format={formatMilliseconds}/>
                <EffectSlider asset={asset} effect="compressor" param="makeupDb" label="Compensação" min={0} max={24} step={0.5} format={formatDb}/>
              </EffectSection>);
                case 'delay':
                    return (<EffectSection key={effect} asset={asset} effect="delay">
                <EffectSlider asset={asset} effect="delay" param="time" label="Intervalo" min={0.01} max={2} scale="log" format={formatMilliseconds}/>
                <EffectSlider asset={asset} effect="delay" param="feedback" label="Repetições" min={0} max={0.95} step={0.01} format={formatPercent}/>
                <EffectSlider asset={asset} effect="delay" param="damping" label="Abafamento" min={200} max={20000} scale="log" format={formatHertz}/>
                <EffectSlider asset={asset} effect="delay" param="mix" label="Mistura" min={0} max={1} step={0.01} format={formatPercent}/>
              </EffectSection>);
                case 'reverb':
                    return (<EffectSection key={effect} asset={asset} effect="reverb">
                <EffectSlider asset={asset} effect="reverb" param="size" label="Tamanho" min={0.1} max={10} step={0.1} format={formatSeconds}/>
                <EffectSlider asset={asset} effect="reverb" param="decay" label="Absorção" min={0.2} max={10} step={0.1} format={(value) => value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}/>
                <EffectSlider asset={asset} effect="reverb" param="damping" label="Abafamento" min={200} max={20000} scale="log" format={formatHertz}/>
                <EffectSlider asset={asset} effect="reverb" param="preDelay" label="Pré-atraso" min={0} max={0.2} step={0.001} format={formatMilliseconds}/>
                <EffectSlider asset={asset} effect="reverb" param="mix" label="Mistura" min={0} max={1} step={0.01} format={formatPercent}/>
              </EffectSection>);
            }
        })}
    </>);
}
