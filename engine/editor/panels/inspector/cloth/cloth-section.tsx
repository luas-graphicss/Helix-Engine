'use client';
import { Shirt } from 'lucide-react';
import type { Entity } from '@/engine/core/scene/entity';
import { addCloth, canBecomeCloth } from '@/engine/editor/operations/cloth-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { ActionButton, ActionRow } from '@/engine/ui/action-button';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { ClothFabricSection } from './cloth-fabric-section';
import { CLOTH_HINT_CLASS } from './cloth-field-styles';
import { ClothSetupSection } from './cloth-setup-section';
import { ClothSurroundingsSection } from './cloth-surroundings-section';
function AddClothPrompt({ entity }: {
    entity: Entity;
}) {
    const session = useEditorSession();
    return (<CollapsibleSection title="Tecido" defaultOpen={false}>
      <p className={CLOTH_HINT_CLASS}>
        A malha passa a se deformar como pano durante a simulação: presa pela borda de cima, ela cai, dobra e reage a vento e colisores.
      </p>
      <ActionRow>
        <ActionButton icon={Shirt} variant="primary" onClick={() => addCloth(session, entity)}>
          Transformar em tecido
        </ActionButton>
      </ActionRow>
    </CollapsibleSection>);
}
export function ClothSection({ entity }: {
    entity: Entity;
}) {
    const settings = entity.cloth;
    if (!settings)
        return canBecomeCloth(entity) ? <AddClothPrompt entity={entity}/> : null;
    return (<>
      <ClothSetupSection entity={entity} settings={settings}/>
      <ClothFabricSection entity={entity} settings={settings}/>
      <ClothSurroundingsSection entity={entity} settings={settings}/>
    </>);
}
