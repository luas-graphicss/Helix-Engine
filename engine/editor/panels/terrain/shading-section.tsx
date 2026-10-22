'use client';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { SliderField } from '@/engine/ui/slider-field';
import { useEditorState } from '@/engine/editor/session/editor-session-context';
import { updateTerrainShading } from '@/engine/editor/operations/terrain-operations';
import type { TerrainShading } from '@/engine/terrain/core/terrain-shading';
import type { TerrainTarget } from '../terrain-panel';
import { meters, percent, times } from './formatters';
export function ShadingSection({ target }: {
    target: TerrainTarget;
}) {
    const session = useEditorState();
    const { entity, terrain } = target;
    const { shading } = terrain;
    const set = <K extends keyof TerrainShading>(key: K) => (value: TerrainShading[K]) => updateTerrainShading(session, entity, { [key]: value });
    return (<CollapsibleSection title="Sombreamento" defaultOpen={false}>
      <SliderField label="Mistura" value={shading.heightBlendDepth} min={0.01} max={1} format={percent} onChange={set('heightBlendDepth')}/>
      <SliderField label="Triplanar" value={shading.triplanarStart} min={0} max={1} format={percent} onChange={set('triplanarStart')}/>
      <SliderField label="Transição" value={shading.triplanarRange} min={0.05} max={1} format={percent} onChange={set('triplanarRange')}/>
      <SliderField label="Variação" value={shading.macroVariation} min={0} max={1} format={percent} onChange={set('macroVariation')}/>
      <SliderField label="Escala var." value={shading.macroScale} min={4} max={200} scale="log" format={meters} onChange={set('macroScale')}/>
      <SliderField label="Rep. distante" value={shading.distanceTiling} min={1} max={16} step={0.5} format={times} onChange={set('distanceTiling')}/>
      <SliderField label="Início" value={shading.distanceBlendStart} min={1} max={100} scale="log" format={meters} onChange={set('distanceBlendStart')}/>
      <SliderField label="Fim" value={shading.distanceBlendEnd} min={5} max={400} scale="log" format={meters} onChange={set('distanceBlendEnd')}/>
    </CollapsibleSection>);
}
