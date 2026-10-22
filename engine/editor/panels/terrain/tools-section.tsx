'use client';
import { Activity, Blend, Eraser, Minus, MoveVertical, Paintbrush, PaintBucket, Rows3, Sprout, Wind } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { SliderField } from '@/engine/ui/slider-field';
import { SegmentedControl } from '@/engine/ui/segmented-control';
import { PropertyRow } from '@/engine/ui/property-row';
import { FieldInput } from '@/engine/ui/field-input';
import { ActionButton, ActionRow } from '@/engine/ui/action-button';
import { useEditorState } from '@/engine/editor/session/editor-session-context';
import { TERRAIN_TOOLS, type TerrainToolId, type TerrainToolSettings } from '@/engine/editor/terrain/terrain-editor';
import { fillGrass, terrainSupportsGrass } from '@/engine/editor/operations/terrain-operations';
import { BRUSH_FALLOFFS, MAX_BRUSH_RADIUS, MIN_BRUSH_RADIUS } from '@/engine/terrain/sculpt/brush';
import { ScalarField } from '../inspector/number-fields';
import type { TerrainTarget } from '../terrain-panel';
import { degrees, meters, percent } from './formatters';
const TOOL_ICON: Record<TerrainToolId, LucideIcon> = {
    raise: MoveVertical,
    smooth: Blend,
    flatten: Minus,
    noise: Activity,
    terrace: Rows3,
    erode: Wind,
    paint: Paintbrush,
    grass: Sprout,
};
const FALLOFF_OPTIONS = BRUSH_FALLOFFS.map(({ value, label }) => ({ value, label }));
const FLATTEN_MODES: ReadonlyArray<{
    value: TerrainToolSettings['flattenMode'];
    label: string;
}> = [
    { value: 'sample', label: 'Ao tocar' },
    { value: 'fixed', label: 'Fixa' },
];
function Hint({ children }: {
    children: React.ReactNode;
}) {
    return <p className="px-2 py-1 text-[10px] leading-relaxed text-pretty text-muted-foreground">{children}</p>;
}
function ActiveToolSettings({ target }: {
    target: TerrainTarget;
}) {
    const session = useEditorState();
    const editor = session.terrain;
    const { settings } = editor;
    switch (editor.tool) {
        case 'flatten':
            return (<>
          <PropertyRow label="Altura">
            <SegmentedControl label="Altura do achatar" options={FLATTEN_MODES} value={settings.flattenMode} onChange={(flattenMode) => editor.updateSettings({ flattenMode })}/>
          </PropertyRow>
          {settings.flattenMode === 'fixed' && (<PropertyRow label="Altura fixa">
              <ScalarField label="Altura fixa" value={settings.flattenHeight} suffix=" m" onCommit={(flattenHeight) => editor.updateSettings({ flattenHeight })}/>
            </PropertyRow>)}
          <Hint>Com o cursor sobre o terreno, a tecla C copia a altura tocada para a altura fixa.</Hint>
        </>);
        case 'noise':
            return <SliderField label="Escala" value={settings.noiseScale} min={2} max={80} scale="log" format={meters} onChange={(noiseScale) => editor.updateSettings({ noiseScale })}/>;
        case 'terrace':
            return <SliderField label="Degrau" value={settings.terraceStep} min={0.25} max={25} scale="log" format={meters} onChange={(terraceStep) => editor.updateSettings({ terraceStep })}/>;
        case 'erode':
            return <SliderField label="Talude" value={settings.erodeTalus} min={5} max={75} step={1} format={degrees} onChange={(erodeTalus) => editor.updateSettings({ erodeTalus })}/>;
        case 'paint': {
            const layer = target.terrain.layers[editor.activeLayerIndex];
            return (<PropertyRow label="Camada ativa">
          <FieldInput readOnly value={layer ? layer.name : 'Adicione uma camada abaixo'} aria-label="Camada ativa"/>
        </PropertyRow>);
        }
        case 'grass': {
            const supported = terrainSupportsGrass(target.terrain);
            return (<>
          <ActionRow>
            <ActionButton icon={PaintBucket} variant="primary" disabled={!supported} onClick={() => fillGrass(session, target.entity, 1)}>
              Cobrir tudo
            </ActionButton>
            <ActionButton icon={Eraser} variant="danger" onClick={() => fillGrass(session, target.entity, 0)}>
              Limpar
            </ActionButton>
          </ActionRow>
          {!supported && <Hint>Nenhuma camada aceita grama. Adicione uma camada de vegetação ou de solo.</Hint>}
        </>);
        }
        default:
            return null;
    }
}
export function ToolsSection({ target }: {
    target: TerrainTarget;
}) {
    const session = useEditorState();
    const editor = session.terrain;
    const active = TERRAIN_TOOLS.find((tool) => tool.id === editor.tool) ?? TERRAIN_TOOLS[0];
    return (<CollapsibleSection title="Ferramentas">
      <div role="radiogroup" aria-label="Ferramenta de terreno" className="grid grid-cols-4 gap-1 px-2 pb-1">
        {TERRAIN_TOOLS.map((tool) => {
            const Icon = TOOL_ICON[tool.id];
            const selected = tool.id === editor.tool;
            return (<button key={tool.id} type="button" role="radio" aria-checked={selected} title={`${tool.description} Tecla ${tool.key}.`} onClick={() => {
                    editor.setTool(tool.id);
                    session.setTool('terrain');
                }} className={cn('relative flex h-12 flex-col items-center justify-center gap-1 rounded-sm border text-[10px] transition-colors', 'focus-visible:outline-1 focus-visible:outline-offset-[-1px] focus-visible:outline-primary', selected
                    ? 'border-primary/60 bg-primary/15 text-primary'
                    : 'border-border bg-surface-sunken text-muted-foreground hover:border-border-strong hover:bg-highlight hover:text-foreground')}>
              <Icon className="size-4" aria-hidden/>
              <span>{tool.label}</span>
              <kbd className="absolute top-0.5 right-1 font-mono text-[9px] text-muted-foreground/70">{tool.key}</kbd>
            </button>);
        })}
      </div>
      <Hint>{active.description}</Hint>

      <SliderField label="Raio" value={editor.brush.radius} min={MIN_BRUSH_RADIUS} max={MAX_BRUSH_RADIUS} scale="log" format={meters} onChange={(radius) => editor.updateBrush({ radius })}/>
      <SliderField label="Intensidade" value={editor.brush.strength} min={0.01} max={1} format={percent} onChange={(strength) => editor.updateBrush({ strength })}/>
      <PropertyRow label="Suavização">
        <SegmentedControl label="Suavização do pincel" options={FALLOFF_OPTIONS} value={editor.brush.falloff} onChange={(falloff) => editor.updateBrush({ falloff })}/>
      </PropertyRow>

      <ActiveToolSettings target={target}/>
    </CollapsibleSection>);
}
