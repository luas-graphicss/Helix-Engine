'use client';
import { RotateCcw } from 'lucide-react';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { PropertyRow } from '@/engine/ui/property-row';
import { IconButton } from '@/engine/ui/icon-button';
import { useEditorSession, useLiveEdits } from '@/engine/editor/session/editor-session-context';
import type { Entity } from '@/engine/core/scene/entity';
import { resetTransform, setTransformComponent, type TransformField } from '@/engine/editor/operations/transform-operations';
import { Vector3Input } from './number-fields';
function Vector3Fields({ entity, field, suffix, decimals }: {
    entity: Entity;
    field: TransformField;
    suffix?: string;
    decimals?: number;
}) {
    const session = useEditorSession();
    return (<>
      <Vector3Input label={field} values={entity.transform[field]} suffix={suffix} decimals={decimals} onCommit={(axis, value) => setTransformComponent(session, entity, field, axis, value)}/>
      <IconButton label={`Redefinir ${field}`} size="xs" onClick={() => resetTransform(session, entity, field)}>
        <RotateCcw />
      </IconButton>
    </>);
}
export function TransformSection({ entity }: {
    entity: Entity;
}) {
    const session = useLiveEdits();
    return (<CollapsibleSection title="Transformação" trailing={<IconButton label="Redefinir transformação" size="xs" onClick={() => resetTransform(session, entity)}>
          <RotateCcw />
        </IconButton>}>
      <PropertyRow label="Posição">
        <Vector3Fields entity={entity} field="position"/>
      </PropertyRow>
      <PropertyRow label="Rotação">
        <Vector3Fields entity={entity} field="rotation" suffix="°" decimals={2}/>
      </PropertyRow>
      <PropertyRow label="Escala">
        <Vector3Fields entity={entity} field="scale"/>
      </PropertyRow>
    </CollapsibleSection>);
}
