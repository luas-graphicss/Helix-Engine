'use client';
import type { Entity } from '@/engine/core/scene/entity';
import { setVehicleScalar } from '@/engine/editor/operations/vehicle-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { PropertyRow } from '@/engine/ui/property-row';
import { SliderField } from '@/engine/ui/slider-field';
import type { VehicleSettings } from '@/engine/vehicle/vehicle-settings';
import { ScalarField } from '../number-fields';
import { VEHICLE_HINT_CLASS } from './vehicle-field-styles';
import { formatPercent, fromPercent, toPercent } from './vehicle-formats';
export function VehicleBrakesSection({ entity, settings }: {
    entity: Entity;
    settings: VehicleSettings;
}) {
    const session = useEditorSession();
    return (<CollapsibleSection title="Freios e estabilidade">
      <PropertyRow label="Freio" hint="Torque por roda; age em todas sem travá-las">
        <ScalarField label="Torque do freio por roda" value={settings.brakeTorque} suffix=" N·m" onCommit={(value) => setVehicleScalar(session, entity, 'brakeTorque', value)}/>
      </PropertyRow>
      <PropertyRow label="Freio de mão" hint="Torque por roda; trava as rodas marcadas como Freio de mão">
        <ScalarField label="Torque do freio de mão por roda" value={settings.handbrakeTorque} suffix=" N·m" onCommit={(value) => setVehicleScalar(session, entity, 'handbrakeTorque', value)}/>
      </PropertyRow>
      <SliderField label="Inclinação" value={toPercent(settings.bodyRoll)} min={0} max={100} step={1} format={formatPercent} onChange={(value) => setVehicleScalar(session, entity, 'bodyRoll', fromPercent(value))}/>
      <PropertyRow label="Arrasto do ar" hint="Força contrária que cresce com o quadrado da velocidade">
        <ScalarField label="Coeficiente de arrasto do ar" value={settings.airDrag} onCommit={(value) => setVehicleScalar(session, entity, 'airDrag', value)}/>
      </PropertyRow>
      <p className={VEHICLE_HINT_CLASS}>Inclinação baixa mantém a carroceria plana em curvas e freadas; alta deixa o veículo rolar e pode capotar.</p>
    </CollapsibleSection>);
}
