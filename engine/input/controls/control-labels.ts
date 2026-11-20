import { resolveControl, resolvedControlLabel } from './control-descriptor';
import { parseControlPath } from './control-path';
import type { CustomDeviceLayout } from './custom-layout';
import { layoutControls, layoutLabel, USAGE_LABELS } from './device-layouts';
export interface ControlPathLabel {
    readonly layout: string;
    readonly device: string;
    readonly control: string;
}
export function describeControlPath(path: string, customLayouts: readonly CustomDeviceLayout[]): ControlPathLabel | null {
    const parsed = parseControlPath(path);
    if (!parsed)
        return null;
    const resolved = resolveControl(layoutControls(parsed.layout, customLayouts), parsed.control);
    const usage = parsed.usage ? ` (${USAGE_LABELS[parsed.usage] ?? parsed.usage})` : '';
    return { layout: parsed.layout, device: `${layoutLabel(parsed.layout)}${usage}`, control: resolved ? resolvedControlLabel(resolved) : parsed.control };
}
