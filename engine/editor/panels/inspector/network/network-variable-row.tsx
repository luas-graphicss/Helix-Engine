'use client';
import { Trash2 } from 'lucide-react';
import type { Entity } from '@/engine/core/scene/entity';
import { removeNetworkVariable, setNetworkVariableKind, updateNetworkVariable } from '@/engine/editor/operations/multiplayer/network-object-operations';
import { blurOnEnter } from '@/engine/editor/panels/input/shared/blur-on-enter';
import { CommitField } from '@/engine/editor/panels/multiplayer/shared/fields';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { MAX_VARIABLE_TEXT_LENGTH, VARIABLE_KINDS, VARIABLE_KIND_LABEL, VARIABLE_WRITERS, VARIABLE_WRITER_LABEL, variableKindOf, type NetworkVariableSettings, type NetworkVariableValue } from '@/engine/net/scene/network-object-settings';
import { CheckBox } from '@/engine/ui/check-box';
import { FieldInput } from '@/engine/ui/field-input';
import { IconButton } from '@/engine/ui/icon-button';
import { SelectField } from '@/engine/ui/select-field';
import { ScalarField } from '../number-fields';
type Props = {
    entity: Entity;
    variable: NetworkVariableSettings;
    index: number;
};
type InitialValueProps = {
    variable: NetworkVariableSettings;
    onCommit: (initial: NetworkVariableValue) => void;
};
const KIND_OPTIONS = VARIABLE_KINDS.map((kind) => ({ value: kind, label: VARIABLE_KIND_LABEL[kind] }));
const WRITER_OPTIONS = VARIABLE_WRITERS.map((writer) => ({ value: writer, label: VARIABLE_WRITER_LABEL[writer] }));
function InitialValueField({ variable, onCommit }: InitialValueProps) {
    const { name, initial } = variable;
    const label = `Valor inicial de ${name}`;
    if (typeof initial === 'boolean') {
        return (<span className="flex h-control min-w-0 items-center gap-1.5 text-2xs text-foreground/80">
        <CheckBox checked={initial} label={label} onChange={onCommit}/>
        <span aria-hidden>{initial ? 'sim' : 'não'}</span>
      </span>);
    }
    if (typeof initial === 'number') {
        return (<ScalarField label={label} value={initial} onCommit={(value) => {
                if (Number.isFinite(value))
                    onCommit(value);
            }}/>);
    }
    return (<FieldInput key={initial} defaultValue={initial} maxLength={MAX_VARIABLE_TEXT_LENGTH} placeholder="vazio" aria-label={label} spellCheck={false} onKeyDown={blurOnEnter} onBlur={(event) => {
            if (event.currentTarget.value !== initial)
                onCommit(event.currentTarget.value);
        }}/>);
}
export function NetworkVariableRow({ entity, variable, index }: Props) {
    const session = useEditorSession();
    const { name } = variable;
    return (<li className="flex flex-col gap-1 px-2 py-1 odd:bg-surface-sunken/40">
      <div className="flex items-center gap-1">
        <CommitField label={`Nome da variável ${name}`} value={name} onCommit={(next) => updateNetworkVariable(session, entity, index, { name: next })}/>
        <IconButton label={`Excluir a variável ${name}`} size="xs" className="hover:text-destructive" onClick={() => removeNetworkVariable(session, entity, index)}>
          <Trash2 />
        </IconButton>
      </div>
      <div className="grid grid-cols-3 items-center gap-1">
        <SelectField label={`Tipo de ${name}`} options={KIND_OPTIONS} value={variableKindOf(variable.initial)} onChange={(kind) => setNetworkVariableKind(session, entity, index, kind)}/>
        <InitialValueField variable={variable} onCommit={(initial) => updateNetworkVariable(session, entity, index, { initial })}/>
        <SelectField label={`Quem escreve ${name}`} options={WRITER_OPTIONS} value={variable.writer} onChange={(writer) => updateNetworkVariable(session, entity, index, { writer })}/>
      </div>
    </li>);
}
