'use client';
import type { Entity } from '@/engine/core/scene/entity';
import { setVehicleScalar } from '@/engine/editor/operations/vehicle-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { SliderField } from '@/engine/ui/slider-field';
import type { VehicleSettings } from '@/engine/vehicle/vehicle-settings';
import { VEHICLE_HINT_CLASS } from './vehicle-field-styles';
import { formatDegrees, formatPercent, fromPercent, toPercent } from './vehicle-formats';
function formatTurnRate(degreesPerSecond: number): string {
    return `${Math.round(degreesPerSecond)}°/s`;
}
export function VehicleSteeringSection({ entity, settings }: {
    entity: Entity;
    settings: VehicleSettings;
}) {
    const session = useEditorSession();
    return (<CollapsibleSection title="Direção">
      <SliderField label="Ângulo máximo" value={settings.maxSteerAngle} min={0} max={60} step={1} format={formatDegrees} onChange={(value) => setVehicleScalar(session, entity, 'maxSteerAngle', value)}/>
      <SliderField label="Volante" value={settings.steerSpeed} min={10} max={720} step={10} format={formatTurnRate} onChange={(value) => setVehicleScalar(session, entity, 'steerSpeed', value)}/>
      <SliderField label="Em alta" value={toPercent(settings.highSpeedSteering)} min={5} max={100} step={1} format={formatPercent} onChange={(value) => setVehicleScalar(session, entity, 'highSpeedSteering', fromPercent(value))}/>
      <SliderField label="Ackermann" value={toPercent(settings.ackermann)} min={0} max={100} step={1} format={formatPercent} onChange={(value) => setVehicleScalar(session, entity, 'ackermann', fromPercent(value))}/>
      <p className={VEHICLE_HINT_CLASS}>Só as rodas marcadas como Direção esterçam. Em alta é quanto do ângulo máximo sobra a 144 km/h. Ackermann faz a roda de dentro da curva virar mais que a de fora.</p>
    </CollapsibleSection>);
}
