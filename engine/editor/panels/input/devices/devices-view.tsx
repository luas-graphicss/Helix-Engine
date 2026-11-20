'use client';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useDeviceFrames } from '@/engine/editor/input/live-devices-context';
import { addCustomInputDevice } from '@/engine/editor/operations/input/input-device-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { customDeviceId } from '@/engine/input/devices/custom-device';
import { layoutLabel } from '@/engine/input/controls/device-layouts';
import { IconButton } from '@/engine/ui/icon-button';
import { Column, ColumnNote } from '../shared/column';
import { DeviceIcon } from '../shared/device-icon';
import { ListRow } from '../shared/list-row';
import { CustomDeviceEditor } from './custom-device-editor';
import { DeviceReadout } from './device-readout';
export function DevicesView() {
    const session = useEditorSession();
    const { customDevices } = session.scene.input;
    const connected = useDeviceFrames().registry.all;
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const activeId = selectedId ?? connected[0]?.id ?? null;
    const custom = customDevices.find((layout) => customDeviceId(layout.name) === activeId);
    return (<div className="flex h-full min-h-0 flex-col @2xl/panel:flex-row">
      <Column title="Dispositivos" className="max-h-48 shrink-0 @2xl/panel:max-h-none @2xl/panel:w-64" actions={<IconButton label="Adicionar dispositivo customizado" size="xs" onClick={() => setSelectedId(customDeviceId(addCustomInputDevice(session)))}>
            <Plus />
          </IconButton>}>
        {connected.map((device) => (<ListRow key={device.id} selected={device.id === activeId} title={device.name} onSelect={() => setSelectedId(device.id)}>
            <DeviceIcon layout={device.layout} className="text-muted-foreground"/>
            <span className="min-w-0 flex-1 truncate">{device.name}</span>
            <span className="shrink-0 text-3xs text-muted-foreground/70">{layoutLabel(device.layout)}</span>
          </ListRow>))}
        {customDevices.map((layout) => (<ListRow key={layout.name} selected={customDeviceId(layout.name) === activeId} title={`${layout.name} · customizado`} onSelect={() => setSelectedId(customDeviceId(layout.name))}>
            <DeviceIcon layout={layout.name} className="text-muted-foreground"/>
            <span className="min-w-0 flex-1 truncate">{layout.name}</span>
            <span className="shrink-0 text-3xs text-muted-foreground/70">Customizado</span>
          </ListRow>))}
      </Column>
      <Column title={custom ? `Controles de ${custom.name}` : 'Leitura ao vivo'} className="min-h-24 flex-1 @2xl/panel:border-r-0">
        {custom ? <CustomDeviceEditor layout={custom}/> : activeId ? <DeviceReadout deviceId={activeId}/> : <ColumnNote>Conecte ou acione um dispositivo.</ColumnNote>}
      </Column>
    </div>);
}
