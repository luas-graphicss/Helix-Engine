'use client';
import { Plus, Trash2 } from 'lucide-react';
import { setInputSchemeDevices } from '@/engine/editor/operations/input/input-scheme-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import type { ControlScheme, InputAsset, SchemeDevice } from '@/engine/input/actions/input-asset';
import { BUILT_IN_LAYOUTS } from '@/engine/input/controls/control-path';
import { layoutLabel } from '@/engine/input/controls/device-layouts';
import { ActionButton, ActionRow } from '@/engine/ui/action-button';
import { IconButton } from '@/engine/ui/icon-button';
import { SegmentedControl } from '@/engine/ui/segmented-control';
import { SelectField } from '@/engine/ui/select-field';
import { ColumnNote } from '../shared/column';
import { DeviceIcon } from '../shared/device-icon';
const REQUIRED = 'required';
const OPTIONAL = 'optional';
const REQUIREMENT_OPTIONS = [
    { value: REQUIRED, label: 'Obrigatório' },
    { value: OPTIONAL, label: 'Opcional' },
] as const;
type SchemeDevicesProps = {
    asset: InputAsset;
    scheme: ControlScheme;
};
export function SchemeDevices({ asset, scheme }: SchemeDevicesProps) {
    const session = useEditorSession();
    const layouts = [...BUILT_IN_LAYOUTS, ...asset.customDevices.map((custom) => custom.name)];
    const replace = (index: number, device: SchemeDevice) => setInputSchemeDevices(session, scheme.id, scheme.devices.map((current, position) => (position === index ? device : current)));
    return (<>
      {scheme.devices.length === 0 && <ColumnNote>Sem dispositivos, este esquema não pareia jogadores.</ColumnNote>}
      {scheme.devices.map((device, index) => {
            const options = (layouts.includes(device.layout) ? layouts : [device.layout, ...layouts]).map((layout) => ({ value: layout, label: layoutLabel(layout) }));
            return (<div key={`${index}-${device.layout}`} className="flex min-h-row items-center gap-1.5 px-2">
            <DeviceIcon layout={device.layout} className="text-muted-foreground"/>
            <SelectField label={`Dispositivo ${index + 1} do esquema`} options={options} value={device.layout} onChange={(layout) => replace(index, { ...device, layout })}/>
            <span className="flex w-40 shrink-0">
              <SegmentedControl label={`Exigência do dispositivo ${index + 1}`} options={REQUIREMENT_OPTIONS} value={device.optional ? OPTIONAL : REQUIRED} onChange={(requirement) => replace(index, { ...device, optional: requirement === OPTIONAL })}/>
            </span>
            <IconButton label={`Remover ${layoutLabel(device.layout)} do esquema`} size="xs" className="hover:text-destructive" onClick={() => setInputSchemeDevices(session, scheme.id, scheme.devices.filter((_, position) => position !== index))}>
              <Trash2 />
            </IconButton>
          </div>);
        })}
      <ActionRow>
        <ActionButton icon={Plus} onClick={() => setInputSchemeDevices(session, scheme.id, [...scheme.devices, { layout: BUILT_IN_LAYOUTS[0], optional: false }])}>
          Adicionar dispositivo
        </ActionButton>
      </ActionRow>
    </>);
}
