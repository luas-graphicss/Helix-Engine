import { physicalSizeCm, type GuiEmulatedScreen } from '@/engine/gui/devices/device-geometry';
import { formatDpr, GUI_DEVICE_INPUT_LABELS, GUI_DEVICE_ORIENTATION_LABELS, GUI_DEVICE_PLATFORM_LABELS, type GuiDeviceSpec } from '@/engine/gui/devices/device-model';
import { hasGuiInsets, type GuiInsets } from '@/engine/gui/document/gui-document';
const UNIT_BY_PLATFORM: Partial<Record<GuiDeviceSpec['platform'], string>> = { ios: 'pt', ipados: 'pt', android: 'dp' };
export function logicalUnit(spec: GuiDeviceSpec | null): string {
    return (spec && UNIT_BY_PLATFORM[spec.platform]) ?? 'px';
}
export function formatSize(width: number, height: number): string {
    return `${width} × ${height}`;
}
export function formatViewport(screen: GuiEmulatedScreen): string {
    return formatSize(screen.width, screen.height);
}
export function formatLogicalScreen(screen: GuiEmulatedScreen): string {
    return `${formatViewport(screen)} ${logicalUnit(screen.spec)} ${formatDpr(screen.dpr)}`;
}
export function formatPhysicalPixels(screen: GuiEmulatedScreen): string {
    return `${screen.physical.x} × ${screen.physical.y} px`;
}
const centimeters = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
export function formatPhysicalSize(screen: GuiEmulatedScreen): string | null {
    const size = physicalSizeCm(screen);
    return size ? `${centimeters.format(size.x)} × ${centimeters.format(size.y)} cm` : null;
}
export function formatDiagonal(spec: GuiDeviceSpec): string | null {
    return spec.screen.diagonal > 0 ? `${centimeters.format(spec.screen.diagonal)}″` : null;
}
export function screenTitle(screen: GuiEmulatedScreen): string {
    return screen.spec ? screen.spec.name : 'Resolução de referência';
}
export function screenTraits(screen: GuiEmulatedScreen): string {
    const parts = screen.spec ? [GUI_DEVICE_PLATFORM_LABELS[screen.spec.platform], GUI_DEVICE_INPUT_LABELS[screen.spec.input]] : [];
    parts.push(GUI_DEVICE_ORIENTATION_LABELS[screen.orientation]);
    return parts.join(' · ');
}
export function formatSafeArea(insets: GuiInsets): string | null {
    if (!hasGuiInsets(insets))
        return null;
    const { top, right, bottom, left } = insets;
    return `↑${top} →${right} ↓${bottom} ←${left}`;
}
