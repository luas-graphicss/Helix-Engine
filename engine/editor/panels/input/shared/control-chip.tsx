import { KBD_CLASS } from '@/engine/editor/shortcuts/ui/key-chips';
import { describeControlPath } from '@/engine/input/controls/control-labels';
import type { CustomDeviceLayout } from '@/engine/input/controls/custom-layout';
import { cn } from '@/lib/utils';
import { DeviceIcon } from './device-icon';
type ControlChipProps = {
    path: string;
    customLayouts: readonly CustomDeviceLayout[];
};
export function ControlChip({ path, customLayouts }: ControlChipProps) {
    const label = describeControlPath(path, customLayouts);
    if (!label)
        return <span className="min-w-0 truncate text-muted-foreground/70 italic">{path === '' ? 'Sem controle' : path}</span>;
    return (<span className="flex min-w-0 items-center gap-1.5">
      <DeviceIcon layout={label.layout} className="text-muted-foreground"/>
      <span className="shrink-0 text-muted-foreground">{label.device}</span>
      <kbd className={cn(KBD_CLASS, 'min-w-0 truncate')}>{label.control}</kbd>
    </span>);
}
