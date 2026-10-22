'use client';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { SelectField } from '@/engine/ui/select-field';
import { PropertyRow } from '@/engine/ui/property-row';
import { FieldInput } from '@/engine/ui/field-input';
import { useEditorState } from '@/engine/editor/session/editor-session-context';
import { resizeTerrain } from '@/engine/editor/operations/terrain-operations';
import { MAX_TERRAIN_SIZE, MIN_TERRAIN_SIZE, TERRAIN_RESOLUTIONS, TERRAIN_SPLAT_RESOLUTIONS } from '@/engine/terrain/core/terrain';
import { clamp } from '@/engine/core/math/scalar';
import type { TerrainTarget } from '../terrain-panel';
import { meters } from './formatters';
const RESOLUTION_OPTIONS = TERRAIN_RESOLUTIONS.map((value) => ({ value, label: `${value} × ${value}` }));
const SPLAT_OPTIONS = TERRAIN_SPLAT_RESOLUTIONS.map((value) => ({ value, label: `${value} × ${value}` }));
export function DimensionsSection({ target }: {
    target: TerrainTarget;
}) {
    const session = useEditorState();
    const { entity, terrain } = target;
    return (<CollapsibleSection title="Dimensões" defaultOpen={false}>
      <PropertyRow label="Tamanho">
        <FieldInput key={terrain.size} defaultValue={`${terrain.size} m`} inputMode="decimal" aria-label="Tamanho do terreno" onBlur={(event) => {
            const size = Number.parseFloat(event.currentTarget.value.replace(',', '.'));
            if (Number.isFinite(size))
                resizeTerrain(session, entity, { size: clamp(Math.round(size), MIN_TERRAIN_SIZE, MAX_TERRAIN_SIZE) });
        }} onKeyDown={(event) => {
            if (event.key === 'Enter')
                event.currentTarget.blur();
        }}/>
      </PropertyRow>
      <PropertyRow label="Relevo">
        <SelectField label="Resolução do relevo" options={RESOLUTION_OPTIONS} value={terrain.resolution} onChange={(resolution) => resizeTerrain(session, entity, { resolution })}/>
      </PropertyRow>
      <PropertyRow label="Controle">
        <SelectField label="Resolução dos mapas de controle" options={SPLAT_OPTIONS} value={terrain.splat.resolution} onChange={(splatResolution) => resizeTerrain(session, entity, { splatResolution })}/>
      </PropertyRow>
      <p className="px-2 pb-1 text-[10px] leading-relaxed text-pretty text-muted-foreground">
        Célula de {meters(terrain.cellSize)} entre vértices. Redimensionar reamostra relevo, camadas e grama.
      </p>
    </CollapsibleSection>);
}
