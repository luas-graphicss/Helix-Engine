'use client';
import { useDeviceFrames } from '@/engine/editor/input/live-devices-context';
import { KBD_CLASS } from '@/engine/editor/shortcuts/ui/key-chips';
import { resolveControl } from '@/engine/input/controls/control-descriptor';
import type { InputDevice } from '@/engine/input/devices/input-device';
import { cn } from '@/lib/utils';
import { ColumnNote } from '../shared/column';
const IDLE = 0.01;
const DECIMALS = 2;
interface Reading {
    readonly id: string;
    readonly label: string;
    readonly value: string;
}
function readingsOf(device: InputDevice): Reading[] {
    const readings: Reading[] = [];
    for (const control of device.controls) {
        if (control.kind !== 'vector2') {
            const value = device.read(control.id);
            if (Math.abs(value) >= IDLE)
                readings.push({ id: control.id, label: control.label, value: value.toFixed(DECIMALS) });
            continue;
        }
        const x = device.read(`${control.id}/x`);
        const y = device.read(`${control.id}/y`);
        if (Math.abs(x) >= IDLE || Math.abs(y) >= IDLE)
            readings.push({ id: control.id, label: control.label, value: `${x.toFixed(DECIMALS)}, ${y.toFixed(DECIMALS)}` });
    }
    for (const [id, value] of device.values) {
        if (Math.abs(value) < IDLE || resolveControl(device.controls, id))
            continue;
        readings.push({ id, label: id, value: value.toFixed(DECIMALS) });
    }
    return readings;
}
type DeviceReadoutProps = {
    deviceId: string;
};
export function DeviceReadout({ deviceId }: DeviceReadoutProps) {
    const device = useDeviceFrames().registry.find(deviceId);
    if (!device)
        return <ColumnNote>Este dispositivo foi desconectado.</ColumnNote>;
    const readings = readingsOf(device);
    if (readings.length === 0)
        return <ColumnNote>Acione um controle de {device.name} para ver o valor.</ColumnNote>;
    return (<ul className="flex flex-col">
      {readings.map((reading) => (<li key={reading.id} className="flex min-h-row items-center gap-2 px-2 text-2xs">
          <kbd className={cn(KBD_CLASS, 'min-w-0 truncate')}>{reading.label}</kbd>
          <span className="min-w-0 flex-1 truncate font-mono text-3xs text-muted-foreground/70">{reading.id}</span>
          <span className="shrink-0 font-mono text-foreground tabular-nums">{reading.value}</span>
        </li>))}
    </ul>);
}
