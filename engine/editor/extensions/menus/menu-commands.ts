import type { EditorSession } from '@/engine/editor/session/editor-session';
import type { MenuTarget } from './menu-contribution';
import { findMenuByShortcut } from './menu-shortcut';
export function selectionMenuTarget(session: EditorSession): MenuTarget {
    return { actors: session.selectedEntities(), asset: null };
}
export function runMenuShortcut(session: EditorSession, event: KeyboardEvent): boolean {
    const menus = session.extensions.menus.list();
    if (menus.length === 0)
        return false;
    const target = selectionMenuTarget(session);
    const menu = findMenuByShortcut(menus, event, target);
    menu?.run(target);
    return menu !== null;
}
