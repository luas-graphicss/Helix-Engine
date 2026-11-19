'use client';
import type { ClothSettings } from '@/engine/cloth/cloth-settings';
import type { Entity } from '@/engine/core/scene/entity';
import { setClothScalar } from '@/engine/editor/operations/cloth-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { PropertyRow } from '@/engine/ui/property-row';
import { SliderField } from '@/engine/ui/slider-field';
import { ScalarField } from '../number-fields';
import { CLOTH_HINT_CLASS } from './cloth-field-styles';
export function ClothFabricSection({ entity, settings }: {
    entity: Entity;
    settings: ClothSettings;
}) {
    const session = useEditorSession();
    return (<CollapsibleSection title="Deformação">
      <SliderField label="Firmeza" value={settings.stretchStiffness} min={0} max={1} onChange={(value) => setClothScalar(session, entity, 'stretchStiffness', value)}/>
      <SliderField label="Rigidez" value={settings.bendStiffness} min={0} max={1} onChange={(value) => setClothScalar(session, entity, 'bendStiffness', value)}/>
      <SliderField label="Amortecimento" value={settings.damping} min={0} max={1} onChange={(value) => setClothScalar(session, entity, 'damping', value)}/>
      <p className={CLOTH_HINT_CLASS}>Firmeza baixa deixa o pano elástico. Rigidez baixa dá seda e panos leves; alta, lona e couro.</p>
      <PropertyRow label="Densidade">
        <ScalarField label="Densidade do tecido" value={settings.density} suffix=" kg/m²" onCommit={(value) => setClothScalar(session, entity, 'density', value)}/>
      </PropertyRow>
      <PropertyRow label="Gravidade">
        <ScalarField label="Escala de gravidade do tecido" value={settings.gravityScale} suffix="×" onCommit={(value) => setClothScalar(session, entity, 'gravityScale', value)}/>
      </PropertyRow>
    </CollapsibleSection>);
}
