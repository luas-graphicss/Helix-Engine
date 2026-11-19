import { GuiSurface } from '@/engine/editor/extensions/gui/gui-surface';
import type { WindowContribution } from '@/engine/editor/extensions/windows/window-contribution';
import { closeWindow, isWindowOpen, openWindow, toggleWindow } from '@/engine/editor/extensions/windows/window-dock';
import { DOCK_AREAS, type DockLayoutStore } from '@/engine/editor/layout/dock-layout';
import { dockLayoutRegistry } from '@/engine/editor/layout/dock-layout-context';
import { HelixError } from '../../runtime/script-errors';
import { requireFunction, requireObject, requireOneOf, requireString } from '../../runtime/values';
import { requireContributionId, type ExtensionApiContext } from './extension-api-context';
import { createGuiBuilder, type EditorGui } from './gui-api';
function dockLayout(): DockLayoutStore {
    const store = dockLayoutRegistry.current;
    if (!store)
        throw new HelixError('helix.editor.windows: o layout do editor não está montado nesta aba.');
    return store;
}
export function createWindowsApi(context: ExtensionApiContext) {
    const { host, extensions } = context;
    const { windows } = extensions;
    const find = (id: unknown, member: string): WindowContribution => {
        const key = requireContributionId(id, member);
        const window = windows.get(key);
        if (!window)
            throw new HelixError(`${member}: a janela "${key}" não está registrada.`);
        return window;
    };
    return {
        register: (id: unknown, options: unknown) => {
            const member = 'helix.editor.windows.register';
            const key = requireContributionId(id, member);
            const settings = requireObject(options, member);
            const onGui = requireFunction<(ui: EditorGui) => void>(settings.onGui, member, 'onGui');
            const owner = host.current;
            const surface = new GuiSurface((frame) => onGui(createGuiBuilder(host, frame)), (render) => context.run(owner, `janela "${key}"`, render));
            const window: WindowContribution = {
                id: key,
                title: settings.title === undefined ? key : requireString(settings.title, member, 'o título'),
                icon: settings.icon === undefined ? null : requireString(settings.icon, member, 'o ícone'),
                area: settings.area === undefined ? 'right' : requireOneOf(settings.area, DOCK_AREAS, member, 'a área'),
                surface,
            };
            const unregister = context.own(windows.register(window, context.ownerAssetId()));
            return {
                id: key,
                get isOpen(): boolean {
                    return isWindowOpen(dockLayout(), key);
                },
                open: () => openWindow(dockLayout(), window),
                close: () => closeWindow(dockLayout(), key),
                repaint: () => surface.requestRepaint(),
                unregister,
            };
        },
        unregister: (id: unknown) => windows.unregister(requireContributionId(id, 'helix.editor.windows.unregister')),
        open: (id: unknown) => openWindow(dockLayout(), find(id, 'helix.editor.windows.open')),
        close: (id: unknown) => closeWindow(dockLayout(), requireContributionId(id, 'helix.editor.windows.close')),
        toggle: (id: unknown) => toggleWindow(dockLayout(), find(id, 'helix.editor.windows.toggle')),
        isOpen: (id: unknown) => isWindowOpen(dockLayout(), requireContributionId(id, 'helix.editor.windows.isOpen')),
        repaint: (id: unknown) => find(id, 'helix.editor.windows.repaint').surface.requestRepaint(),
        list: () => windows.list().map((window) => ({ id: window.id, title: window.title })),
    };
}
