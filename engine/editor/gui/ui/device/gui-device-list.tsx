'use client';
import { Check, type LucideIcon } from 'lucide-react';
import { groupGuiDevices } from '@/engine/gui/devices/device-catalog';
import { formatDpr, GUI_DEVICE_CATEGORY_LABELS, type GuiDeviceSpec } from '@/engine/gui/devices/device-model';
import { FOCUS_RING_CLASS } from '@/engine/ui/surface-styles';
import { cn } from '@/lib/utils';
interface GuiDeviceOptionProps {
    readonly label: string;
    readonly detail: string;
    readonly active: boolean;
    readonly icon?: LucideIcon;
    readonly onPick: () => void;
}
export function GuiDeviceOption({ label, detail, active, icon: Icon, onPick }: GuiDeviceOptionProps) {
    return (<button type="button" role="option" aria-selected={active} onClick={onPick} className={cn('flex h-7 w-full items-center gap-2 rounded-xs px-1.5 text-left text-2xs transition-colors duration-100', FOCUS_RING_CLASS, active ? 'bg-primary/15 text-primary' : 'text-foreground hover:bg-highlight')}>
      <span className="flex size-3.5 shrink-0 items-center justify-center">{active ? <Check className="size-3" strokeWidth={3} aria-hidden/> : Icon ? <Icon className="size-3.5 text-muted-foreground" aria-hidden/> : null}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className={cn('shrink-0 font-mono text-3xs tabular-nums', active ? 'text-primary/80' : 'text-muted-foreground')}>{detail}</span>
    </button>);
}
interface GuiDeviceListProps {
    readonly devices: readonly GuiDeviceSpec[];
    readonly activeId: string | null;
    readonly onPick: (device: GuiDeviceSpec) => void;
}
export function GuiDeviceList({ devices, activeId, onPick }: GuiDeviceListProps) {
    const groups = groupGuiDevices(devices);
    if (groups.length === 0)
        return <p className="px-2 py-6 text-center text-2xs text-muted-foreground">Nenhum aparelho corresponde à busca.</p>;
    return (<>
      {groups.map((group) => (<section key={`${group.category}:${group.brand}`} aria-label={`${GUI_DEVICE_CATEGORY_LABELS[group.category]} · ${group.brand}`}>
          <h4 className="px-1.5 pt-2 pb-0.5 font-sans text-3xs font-medium tracking-wider text-muted-foreground uppercase">
            {GUI_DEVICE_CATEGORY_LABELS[group.category]} · {group.brand}
          </h4>
          {group.devices.map((device) => (<GuiDeviceOption key={device.id} label={device.name} detail={`${device.screen.width} × ${device.screen.height} ${formatDpr(device.screen.dpr)}`} active={device.id === activeId} onPick={() => onPick(device)}/>))}
        </section>))}
    </>);
}
