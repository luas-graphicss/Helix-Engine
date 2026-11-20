'use client';
import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { addCustomInputControl, removeCustomInputControl, removeCustomInputDevice } from '@/engine/editor/operations/input/input-device-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import type { CustomControlKind, CustomDeviceLayout } from '@/engine/input/controls/custom-layout';
import { ActionButton, ActionRow } from '@/engine/ui/action-button';
import { FieldInput } from '@/engine/ui/field-input';
import { IconButton } from '@/engine/ui/icon-button';
import { SegmentedControl } from '@/engine/ui/segmented-control';
import { blurOnEnter } from '../shared/blur-on-enter';
import { ColumnNote } from '../shared/column';
const KIND_OPTIONS: readonly {
    value: CustomControlKind;
    label: string;
}[] = [
    { value: 'button', label: 'Botão' },
    { value: 'axis', label: 'Eixo' },
];
const KIND_LABEL: Record<CustomControlKind, string> = { button: 'Botão', axis: 'Eixo' };
type CustomDeviceEditorProps = {
    layout: CustomDeviceLayout;
};
export function CustomDeviceEditor({ layout }: CustomDeviceEditorProps) {
    const session = useEditorSession();
    const [kind, setKind] = useState<CustomControlKind>('button');
    return (<>
      {layout.controls.length === 0 && <ColumnNote>Adicione os controles que o script vai alimentar com helix.input.devices.custom.</ColumnNote>}
      <ul className="flex flex-col">
        {layout.controls.map((control) => (<li key={control.id} className="group flex min-h-row items-center gap-2 px-2 text-2xs">
            <span className="min-w-0 flex-1 truncate font-mono text-foreground">{`<${layout.name}>/${control.id}`}</span>
            <span className="shrink-0 text-3xs text-muted-foreground">{KIND_LABEL[control.kind]}</span>
            <IconButton label={`Excluir o controle ${control.id}`} size="xs" className="hover:text-destructive" onClick={() => removeCustomInputControl(session, layout.name, control.id)}>
              <Trash2 />
            </IconButton>
          </li>))}
      </ul>
      <div className="flex min-h-row items-center gap-1.5 px-2">
        <Plus className="size-3.5 shrink-0 text-muted-foreground" aria-hidden/>
        <FieldInput placeholder="Novo controle" aria-label="Nome do novo controle" onKeyDown={blurOnEnter} onBlur={(event) => {
            addCustomInputControl(session, layout.name, event.currentTarget.value, kind);
            event.currentTarget.value = '';
        }}/>
        <span className="flex w-28 shrink-0">
          <SegmentedControl label="Tipo do novo controle" options={KIND_OPTIONS} value={kind} onChange={setKind}/>
        </span>
      </div>
      <ActionRow>
        <ActionButton icon={Trash2} variant="danger" onClick={() => removeCustomInputDevice(session, layout.name)}>
          Excluir dispositivo
        </ActionButton>
      </ActionRow>
    </>);
}
