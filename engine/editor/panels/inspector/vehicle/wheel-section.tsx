'use client';
import { CircleDot } from 'lucide-react';
import type { Entity } from '@/engine/core/scene/entity';
import { addWheel, canBecomeWheel } from '@/engine/editor/operations/wheel-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { ActionButton, ActionRow } from '@/engine/ui/action-button';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { VEHICLE_HINT_CLASS } from './vehicle-field-styles';
import { WheelColliderSection } from './wheel-collider-section';
import { WheelFrictionSection } from './wheel-friction-section';
import { WheelSuspensionSection } from './wheel-suspension-section';
function AddWheelPrompt({ entity }: {
    entity: Entity;
}) {
    const session = useEditorSession();
    return (<CollapsibleSection title="Wheel Collider" defaultOpen={false}>
      <p className={VEHICLE_HINT_CLASS}>
        O ator vira uma roda do veículo acima dele: sustenta o chassi pela suspensão, gira, esterça e gera atrito com o chão. O raio vem do tamanho da malha.
      </p>
      <ActionRow>
        <ActionButton icon={CircleDot} variant="primary" onClick={() => addWheel(session, entity)}>
          Transformar em roda
        </ActionButton>
      </ActionRow>
    </CollapsibleSection>);
}
export function WheelSection({ entity }: {
    entity: Entity;
}) {
    const settings = entity.wheel;
    if (!settings)
        return canBecomeWheel(entity) ? <AddWheelPrompt entity={entity}/> : null;
    return (<>
      <WheelColliderSection entity={entity} settings={settings}/>
      <WheelSuspensionSection entity={entity} settings={settings}/>
      <WheelFrictionSection entity={entity} settings={settings}/>
    </>);
}
