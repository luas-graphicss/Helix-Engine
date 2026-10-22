'use client';
import { Dices, Minus, RefreshCw } from 'lucide-react';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { SliderField } from '@/engine/ui/slider-field';
import { SelectField } from '@/engine/ui/select-field';
import { PropertyRow } from '@/engine/ui/property-row';
import { FieldInput } from '@/engine/ui/field-input';
import { IconButton } from '@/engine/ui/icon-button';
import { ActionButton, ActionRow } from '@/engine/ui/action-button';
import { useEditorState } from '@/engine/editor/session/editor-session-context';
import { flattenTerrain, regenerateTerrain } from '@/engine/editor/operations/terrain-operations';
import { TERRAIN_PRESETS } from '@/engine/terrain/generation/terrain-generator';
import type { TerrainTarget } from '../terrain-panel';
import { meters, passes, percent } from './formatters';
const PRESET_OPTIONS = TERRAIN_PRESETS.map(({ value, label }) => ({ value, label }));
const MAX_SEED = 1000000;
export function GenerationSection({ target }: {
    target: TerrainTarget;
}) {
    const session = useEditorState();
    const editor = session.terrain;
    const params = editor.generation;
    const preset = TERRAIN_PRESETS.find((candidate) => candidate.value === params.preset);
    return (<CollapsibleSection title="Geração" defaultOpen={false}>
      <PropertyRow label="Preset">
        <SelectField label="Preset de relevo" options={PRESET_OPTIONS} value={params.preset} onChange={(value) => editor.updateGeneration({ preset: value })}/>
      </PropertyRow>
      <PropertyRow label="Semente">
        <FieldInput key={params.seed} defaultValue={String(params.seed)} inputMode="numeric" aria-label="Semente" onBlur={(event) => {
            const seed = Number.parseInt(event.currentTarget.value, 10);
            if (Number.isFinite(seed))
                editor.updateGeneration({ seed });
        }} onKeyDown={(event) => {
            if (event.key === 'Enter')
                event.currentTarget.blur();
        }}/>
        <IconButton label="Semente aleatória" size="sm" onClick={() => editor.updateGeneration({ seed: Math.floor(Math.random() * MAX_SEED) })}>
          <Dices />
        </IconButton>
      </PropertyRow>
      <SliderField label="Amplitude" value={params.amplitude} min={1} max={200} scale="log" format={meters} onChange={(amplitude) => editor.updateGeneration({ amplitude })}/>
      <SliderField label="Formas" value={params.featureSize} min={10} max={600} scale="log" format={meters} onChange={(featureSize) => editor.updateGeneration({ featureSize })}/>
      <SliderField label="Detalhe" value={params.detail} min={0} max={1} format={percent} onChange={(detail) => editor.updateGeneration({ detail })}/>
      <SliderField label="Erosão" value={params.erosion} min={0} max={20} step={1} format={passes} onChange={(erosion) => editor.updateGeneration({ erosion })}/>
      <ActionRow>
        <ActionButton icon={RefreshCw} variant="primary" onClick={() => regenerateTerrain(session, target.entity, params)}>
          Gerar relevo
        </ActionButton>
        <ActionButton icon={Minus} variant="danger" onClick={() => flattenTerrain(session, target.entity)} title="Zera todas as alturas">
          Aplainar
        </ActionButton>
      </ActionRow>
      {preset && <p className="px-2 pb-1 text-[10px] leading-relaxed text-pretty text-muted-foreground">{preset.description} Gerar substitui o relevo atual e repinta as camadas automáticas.</p>}
    </CollapsibleSection>);
}
