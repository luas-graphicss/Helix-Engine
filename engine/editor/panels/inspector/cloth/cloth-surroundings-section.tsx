'use client';
import type { ClothSettings } from '@/engine/cloth/cloth-settings';
import type { Entity } from '@/engine/core/scene/entity';
import { setClothBodyCollision, setClothScalar } from '@/engine/editor/operations/cloth-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { PropertyRow } from '@/engine/ui/property-row';
import { SliderField } from '@/engine/ui/slider-field';
import { ToggleField } from '@/engine/ui/toggle-field';
import { ScalarField } from '../number-fields';
function formatSpeed(value: number): string {
    return `${value.toFixed(1)} m/s`;
}
function formatDegrees(value: number): string {
    return `${Math.round(value)}°`;
}
export function ClothSurroundingsSection({ entity, settings }: {
    entity: Entity;
    settings: ClothSettings;
}) {
    const session = useEditorSession();
    return (<CollapsibleSection title="Vento e colisão">
      <SliderField label="Vento" value={settings.windSpeed} min={0} max={40} step={0.5} format={formatSpeed} onChange={(value) => setClothScalar(session, entity, 'windSpeed', value)}/>
      <SliderField label="Direção" value={settings.windDirection} min={0} max={360} step={1} format={formatDegrees} onChange={(value) => setClothScalar(session, entity, 'windDirection', value)}/>
      <SliderField label="Rajadas" value={settings.windTurbulence} min={0} max={1} onChange={(value) => setClothScalar(session, entity, 'windTurbulence', value)}/>
      <SliderField label="Arrasto do ar" value={settings.airDrag} min={0} max={4} onChange={(value) => setClothScalar(session, entity, 'airDrag', value)}/>
      <ToggleField label="Colisão" hint="Colide com corpos rígidos de caixa, esfera e cápsula, personagens e terreno" on={settings.collideWithBodies} onToggle={() => setClothBodyCollision(session, entity, !settings.collideWithBodies)}/>
      {settings.collideWithBodies && (<>
          <PropertyRow label="Espessura">
            <ScalarField label="Espessura do tecido" value={settings.thickness} suffix=" m" onCommit={(value) => setClothScalar(session, entity, 'thickness', value)}/>
          </PropertyRow>
          <SliderField label="Atrito" value={settings.friction} min={0} max={1} onChange={(value) => setClothScalar(session, entity, 'friction', value)}/>
        </>)}
    </CollapsibleSection>);
}
