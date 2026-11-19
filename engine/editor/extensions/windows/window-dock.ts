import { extensionPanelId, type DockLayoutStore } from '@/engine/editor/layout/dock-layout';
import type { WindowContribution } from './window-contribution';
export function isWindowOpen(dock: DockLayoutStore, windowId: string): boolean {
    return dock.isOpen(extensionPanelId(windowId));
}
export function openWindow(dock: DockLayoutStore, window: WindowContribution): void {
    const panelId = extensionPanelId(window.id);
    dock.open(panelId, dock.rememberedArea(panelId) ?? window.area);
}
export function closeWindow(dock: DockLayoutStore, windowId: string): void {
    dock.close(extensionPanelId(windowId));
}
export function toggleWindow(dock: DockLayoutStore, window: WindowContribution): void {
    if (isWindowOpen(dock, window.id))
        closeWindow(dock, window.id);
    else
        openWindow(dock, window);
}
