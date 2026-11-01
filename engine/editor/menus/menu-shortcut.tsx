'use client';
import { ContextMenuShortcut } from '@/components/ui/context-menu';
import { DropdownMenuShortcut } from '@/components/ui/dropdown-menu';
import { useShortcutLabel } from '@/engine/editor/shortcuts/shortcut-bindings';
import type { ShortcutActionId } from '@/engine/editor/shortcuts/shortcut-actions';
import { useEngineSetting } from '@/engine/settings/engine-settings-store';
import { MENU_SHORTCUT_CLASS } from './menu-styles';
interface MenuShortcutProps {
    action: ShortcutActionId;
    menu?: 'dropdown' | 'context';
}
export function MenuShortcut({ action, menu = 'dropdown' }: MenuShortcutProps) {
    const label = useShortcutLabel(action);
    const visible = useEngineSetting('editor.ui.menuShortcuts');
    if (!visible || !label)
        return null;
    const Shortcut = menu === 'context' ? ContextMenuShortcut : DropdownMenuShortcut;
    return <Shortcut className={MENU_SHORTCUT_CLASS}>{label}</Shortcut>;
}
