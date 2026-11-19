'use client';
import { Scan, Trash2 } from 'lucide-react';
import type { Entity } from '@/engine/core/scene/entity';
import { fitWheelToMesh, removeWheel, setWheelRole, setWheelScalar } from '@/engine/editor/operations/wheel-operations';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { ActionButton, ActionRow } from '@/engine/ui/action-button';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { FieldInput } from '@/engine/ui/field-input';
import { IconButton } from '@/engine/ui/icon-button';
import { PropertyRow } from '@/engine/ui/property-row';
import { ToggleField } from '@/engine/ui/toggle-field';
import { RPM_PER_RADIAN_PER_SECOND } from '@/engine/vehicle/drivetrain/engine-torque';
import { findVehicleAncestor } from '@/engine/vehicle/vehicle-hierarchy';
import type { WheelRole, WheelSettings } from '@/engine/vehicle/wheel/wheel-settings';
import { ScalarField } from '../number-fields';
import { useLiveReadout } from './use-live-readout';
import { VEHICLE_HINT_CLASS } from './vehicle-field-styles';
import { formatPercent, formatWhole, toPercent } from './vehicle-formats';
const ROLES: ReadonlyArray<{
    role: WheelRole;
    label: string;
    hint: string;
}> = [
    { role: 'steering', label: 'Direção', hint: 'Esterça com o volante' },
    { role: 'driven', label: 'Tração', hint: 'Recebe o torque do motor' },
    { role: 'handbrake', label: 'Freio de mão', hint: 'Trava quando o freio de mão é puxado' },
];
function describeContact(session: EditorSession, entity: Entity): string | null {
    const vehicle = findVehicleAncestor(entity);
    const wheel = vehicle ? session.playtest.vehicles?.system.instanceOf(vehicle)?.wheelOf(entity) : null;
    if (!wheel)
        return null;
    if (!wheel.grounded)
        return `No ar · ${formatWhole(Math.abs(wheel.angularVelocity) * RPM_PER_RADIAN_PER_SECOND)} rpm`;
    const slip = Math.max(wheel.longitudinalSlip, wheel.lateralSlip);
    return `No chão · ${formatWhole(wheel.load)} N · ${formatWhole(Math.abs(wheel.angularVelocity) * RPM_PER_RADIAN_PER_SECOND)} rpm · desliza ${formatPercent(toPercent(Math.min(slip, 1)))}`;
}
function ContactReadout({ entity }: {
    entity: Entity;
}) {
    const contact = useLiveReadout(entity, describeContact);
    if (!contact)
        return null;
    return (<PropertyRow label="Contato">
      <FieldInput readOnly value={contact} title={contact} aria-label="Contato da roda com o chão"/>
    </PropertyRow>);
}
export function WheelColliderSection({ entity, settings }: {
    entity: Entity;
    settings: WheelSettings;
}) {
    const session = useEditorSession();
    const vehicle = findVehicleAncestor(entity);
    return (<CollapsibleSection title="Wheel Collider" trailing={<IconButton label="Remover Wheel Collider" size="xs" className="hover:text-destructive" onClick={() => removeWheel(session, entity)}>
          <Trash2 />
        </IconButton>}>
      {vehicle ? (<PropertyRow label="Veículo">
          <FieldInput readOnly value={vehicle.name} aria-label="Veículo desta roda"/>
        </PropertyRow>) : (<p className={VEHICLE_HINT_CLASS}>Esta roda não está dentro de um veículo. Arraste-a para um ator com o componente Veículo.</p>)}
      <PropertyRow label="Raio">
        <ScalarField label="Raio da roda" value={settings.radius} suffix=" m" onCommit={(value) => setWheelScalar(session, entity, 'radius', value)}/>
      </PropertyRow>
      <PropertyRow label="Massa" hint="Define a inércia de giro da roda">
        <ScalarField label="Massa da roda" value={settings.mass} suffix=" kg" onCommit={(value) => setWheelScalar(session, entity, 'mass', value)}/>
      </PropertyRow>
      {ROLES.map(({ role, label, hint }) => (<ToggleField key={role} label={label} hint={hint} on={settings[role]} onToggle={() => setWheelRole(session, entity, role, !settings[role])}/>))}
      {entity.mesh && (<ActionRow>
          <ActionButton icon={Scan} onClick={() => fitWheelToMesh(session, entity)}>
            Ajustar raio à malha
          </ActionButton>
        </ActionRow>)}
      <ContactReadout entity={entity}/>
    </CollapsibleSection>);
}
