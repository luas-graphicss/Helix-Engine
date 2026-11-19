'use client';
import { useState } from 'react';
import type { Entity } from '@/engine/core/scene/entity';
import { setWheelFriction } from '@/engine/editor/operations/wheel-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { PropertyRow } from '@/engine/ui/property-row';
import { SegmentedControl } from '@/engine/ui/segmented-control';
import { SliderField } from '@/engine/ui/slider-field';
import type { WheelFrictionField } from '@/engine/vehicle/wheel/wheel-friction';
import type { WheelFrictionAxis, WheelSettings } from '@/engine/vehicle/wheel/wheel-settings';
import { VEHICLE_HINT_CLASS } from './vehicle-field-styles';
const AXIS_OPTIONS: ReadonlyArray<{
    value: WheelFrictionAxis;
    label: string;
}> = [
    { value: 'forwardFriction', label: 'Longitudinal' },
    { value: 'sidewaysFriction', label: 'Lateral' },
];
const CURVE_FIELDS: ReadonlyArray<{
    field: WheelFrictionField;
    label: string;
    min: number;
    max: number;
}> = [
    { field: 'stiffness', label: 'Aderência', min: 0, max: 4 },
    { field: 'extremumValue', label: 'Pico', min: 0, max: 4 },
    { field: 'asymptoteValue', label: 'Deslizando', min: 0, max: 4 },
    { field: 'extremumSlip', label: 'Limite', min: 0.01, max: 2 },
    { field: 'asymptoteSlip', label: 'Deslize total', min: 0.02, max: 4 },
];
const AXIS_HINT: Record<WheelFrictionAxis, string> = {
    forwardFriction: 'Longitudinal vale para acelerar e frear: o escorregamento é a diferença entre o giro da roda e a velocidade do chão.',
    sidewaysFriction: 'Lateral vale para curvas: o escorregamento é o quanto a roda anda de lado em relação ao quanto anda para frente.',
};
export function WheelFrictionSection({ entity, settings }: {
    entity: Entity;
    settings: WheelSettings;
}) {
    const session = useEditorSession();
    const [axis, setAxis] = useState<WheelFrictionAxis>('forwardFriction');
    const curve = settings[axis];
    return (<CollapsibleSection title="Fricção">
      <PropertyRow label="Direção">
        <SegmentedControl label="Direção da curva de fricção" options={AXIS_OPTIONS} value={axis} onChange={setAxis}/>
      </PropertyRow>
      {CURVE_FIELDS.map(({ field, label, min, max }) => (<SliderField key={`${axis}-${field}`} label={label} value={curve[field]} min={min} max={max} step={0.01} onChange={(value) => setWheelFriction(session, entity, axis, field, value)}/>))}
      <p className={VEHICLE_HINT_CLASS}>
        Até o Limite o pneu segura com a aderência de Pico; daí até o Deslize total ela cai para a de Deslizando. Aderência multiplica a curva inteira, e o atrito do chão multiplica o resultado. {AXIS_HINT[axis]}
      </p>
    </CollapsibleSection>);
}
