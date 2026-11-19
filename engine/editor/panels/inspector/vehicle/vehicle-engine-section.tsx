'use client';
import type { Entity } from '@/engine/core/scene/entity';
import { setVehicleScalar } from '@/engine/editor/operations/vehicle-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { PropertyRow } from '@/engine/ui/property-row';
import { SliderField } from '@/engine/ui/slider-field';
import type { VehicleScalar, VehicleSettings } from '@/engine/vehicle/vehicle-settings';
import { ScalarField } from '../number-fields';
import { VEHICLE_HINT_CLASS } from './vehicle-field-styles';
import { formatWhole } from './vehicle-formats';
interface EngineField {
    readonly key: VehicleScalar;
    readonly label: string;
    readonly title: string;
    readonly suffix: string;
}
const ENGINE_FIELDS: readonly EngineField[] = [
    { key: 'maxTorque', label: 'Torque máximo', title: 'Torque máximo do motor', suffix: ' N·m' },
    { key: 'idleRpm', label: 'Marcha lenta', title: 'Rotação de marcha lenta', suffix: ' rpm' },
    { key: 'peakRpm', label: 'Pico de torque', title: 'Rotação do pico de torque', suffix: ' rpm' },
    { key: 'maxRpm', label: 'Corte de giro', title: 'Rotação de corte do motor', suffix: ' rpm' },
    { key: 'engineBraking', label: 'Freio-motor', title: 'Torque de freio-motor', suffix: ' N·m' },
];
const SINGLE_GEAR_FIELDS: readonly EngineField[] = [
    { key: 'firstGearRatio', label: 'Marcha', title: 'Relação da marcha', suffix: ':1' },
    { key: 'reverseGearRatio', label: 'Ré', title: 'Relação da ré', suffix: ':1' },
    { key: 'finalDriveRatio', label: 'Diferencial', title: 'Relação do diferencial', suffix: ':1' },
];
const GEARBOX_FIELDS: readonly EngineField[] = [
    { key: 'firstGearRatio', label: '1ª marcha', title: 'Relação da primeira marcha', suffix: ':1' },
    { key: 'topGearRatio', label: 'Última marcha', title: 'Relação da última marcha', suffix: ':1' },
    ...SINGLE_GEAR_FIELDS.slice(1),
];
export function VehicleEngineSection({ entity, settings }: {
    entity: Entity;
    settings: VehicleSettings;
}) {
    const session = useEditorSession();
    const renderField = ({ key, label, title, suffix }: EngineField) => (<PropertyRow key={key} label={label}>
      <ScalarField label={title} value={settings[key]} suffix={suffix} onCommit={(value) => setVehicleScalar(session, entity, key, value)}/>
    </PropertyRow>);
    return (<CollapsibleSection title="Motor e câmbio">
      {ENGINE_FIELDS.map(renderField)}
      <p className={VEHICLE_HINT_CLASS}>O torque sobe da marcha lenta até o pico e cai até o corte de giro. O freio-motor desacelera as rodas de tração com o acelerador solto.</p>
      <SliderField label="Marchas" value={settings.gearCount} min={1} max={10} step={1} format={formatWhole} onChange={(value) => setVehicleScalar(session, entity, 'gearCount', value)}/>
      {(settings.gearCount > 1 ? GEARBOX_FIELDS : SINGLE_GEAR_FIELDS).map(renderField)}
      <p className={VEHICLE_HINT_CLASS}>As marchas do meio são distribuídas entre a primeira e a última, e o câmbio troca sozinho. O torque na roda é o do motor vezes a marcha vezes o diferencial.</p>
    </CollapsibleSection>);
}
