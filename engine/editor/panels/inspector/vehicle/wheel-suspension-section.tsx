'use client';
import type { Entity } from '@/engine/core/scene/entity';
import { setWheelScalar } from '@/engine/editor/operations/wheel-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { PropertyRow } from '@/engine/ui/property-row';
import { SliderField } from '@/engine/ui/slider-field';
import type { WheelSettings } from '@/engine/vehicle/wheel/wheel-settings';
import { ScalarField } from '../number-fields';
import { VEHICLE_HINT_CLASS } from './vehicle-field-styles';
function formatHertz(hertz: number): string {
    return `${hertz.toFixed(1)} Hz`;
}
export function WheelSuspensionSection({ entity, settings }: {
    entity: Entity;
    settings: WheelSettings;
}) {
    const session = useEditorSession();
    return (<CollapsibleSection title="Suspensão">
      <PropertyRow label="Curso" hint="Distância total que a roda sobe e desce">
        <ScalarField label="Curso da suspensão" value={settings.suspensionTravel} suffix=" m" onCommit={(value) => setWheelScalar(session, entity, 'suspensionTravel', value)}/>
      </PropertyRow>
      <SliderField label="Rigidez" value={settings.suspensionFrequency} min={0.5} max={10} step={0.1} format={formatHertz} onChange={(value) => setWheelScalar(session, entity, 'suspensionFrequency', value)}/>
      <SliderField label="Amortecimento" value={settings.suspensionDamping} min={0} max={2} step={0.05} onChange={(value) => setWheelScalar(session, entity, 'suspensionDamping', value)}/>
      <p className={VEHICLE_HINT_CLASS}>A posição da roda no editor é o repouso: metade do curso fica para cima e metade para baixo. A rigidez é a frequência da mola e vale para qualquer massa; amortecimento 1 para de balançar sem oscilar.</p>
    </CollapsibleSection>);
}
