'use client';
import { Car } from 'lucide-react';
import type { Entity } from '@/engine/core/scene/entity';
import { addVehicle, canBecomeVehicle } from '@/engine/editor/operations/vehicle-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { ActionButton, ActionRow } from '@/engine/ui/action-button';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { VehicleBrakesSection } from './vehicle-brakes-section';
import { VehicleEngineSection } from './vehicle-engine-section';
import { VEHICLE_HINT_CLASS } from './vehicle-field-styles';
import { VehicleSetupSection } from './vehicle-setup-section';
import { VehicleSteeringSection } from './vehicle-steering-section';
function AddVehiclePrompt({ entity }: {
    entity: Entity;
}) {
    const session = useEditorSession();
    return (<CollapsibleSection title="Veículo" defaultOpen={false}>
      <p className={VEHICLE_HINT_CLASS}>
        O ator vira o chassi: ganha motor, câmbio, direção e freios, e um corpo rígido dinâmico se ainda não tiver. As rodas são atores filhos com Wheel Collider.
      </p>
      <ActionRow>
        <ActionButton icon={Car} variant="primary" onClick={() => addVehicle(session, entity)}>
          Transformar em veículo
        </ActionButton>
      </ActionRow>
    </CollapsibleSection>);
}
export function VehicleSection({ entity }: {
    entity: Entity;
}) {
    const settings = entity.vehicle;
    if (!settings)
        return canBecomeVehicle(entity) ? <AddVehiclePrompt entity={entity}/> : null;
    return (<>
      <VehicleSetupSection entity={entity} settings={settings}/>
      <VehicleEngineSection entity={entity} settings={settings}/>
      <VehicleSteeringSection entity={entity} settings={settings}/>
      <VehicleBrakesSection entity={entity} settings={settings}/>
    </>);
}
