'use client';
import { Plus, Trash2 } from 'lucide-react';
import { removeInputAction, renameInputAction, setInputActionType } from '@/engine/editor/operations/input/input-action-operations';
import { addInputBinding, addInputComposite } from '@/engine/editor/operations/input/input-binding-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { findActionById } from '@/engine/input/actions/asset-queries';
import { COMPOSITE_FOR_TYPE, type InputAction, type InputActionMap } from '@/engine/input/actions/input-asset';
import { ActionButton, ActionRow } from '@/engine/ui/action-button';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { FieldInput } from '@/engine/ui/field-input';
import { PropertyRow } from '@/engine/ui/property-row';
import { SegmentedControl } from '@/engine/ui/segmented-control';
import { ACTION_TYPE_OPTIONS, COMPOSITE_LABEL } from '../input-labels';
import { blurOnEnter } from '../shared/blur-on-enter';
import type { InputSelection } from './input-selection';
type ActionPropertiesProps = {
    map: InputActionMap;
    action: InputAction;
    schemes: readonly string[];
    onSelect: (selection: InputSelection) => void;
};
export function ActionProperties({ map, action, schemes, onSelect }: ActionPropertiesProps) {
    const session = useEditorSession();
    const composite = COMPOSITE_FOR_TYPE[action.type];
    return (<>
      <CollapsibleSection title="Ação">
        <PropertyRow label="Nome">
          <FieldInput key={`${action.id}-${action.name}`} defaultValue={action.name} aria-label="Nome da ação" onKeyDown={blurOnEnter} onBlur={(event) => {
            renameInputAction(session, action.id, event.currentTarget.value);
            event.currentTarget.value = findActionById(session.scene.input, action.id)?.action.name ?? action.name;
        }}/>
        </PropertyRow>
        <PropertyRow label="Tipo">
          <SegmentedControl label="Tipo da ação" options={ACTION_TYPE_OPTIONS} value={action.type} onChange={(type) => setInputActionType(session, action.id, type)}/>
        </PropertyRow>
        <PropertyRow label="No script" hint="Caminho usado em helix.input.findAction">
          <FieldInput readOnly value={`${map.name}/${action.name}`} aria-label="Caminho da ação nos scripts" onFocus={(event) => event.currentTarget.select()}/>
        </PropertyRow>
      </CollapsibleSection>
      <ActionRow>
        <ActionButton icon={Plus} variant="primary" onClick={() => onSelect({ kind: 'binding', bindingId: addInputBinding(session, action.id, schemes), part: null })}>
          Adicionar vínculo
        </ActionButton>
        {composite && (<ActionButton icon={Plus} onClick={() => onSelect({ kind: 'binding', bindingId: addInputComposite(session, action.id, composite, schemes), part: null })}>
            {COMPOSITE_LABEL[composite]}
          </ActionButton>)}
        <ActionButton icon={Trash2} variant="danger" onClick={() => removeInputAction(session, action.id)}>
          Excluir ação
        </ActionButton>
      </ActionRow>
    </>);
}
