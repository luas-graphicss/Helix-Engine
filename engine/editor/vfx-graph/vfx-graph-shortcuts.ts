import type { EditorSession } from '@/engine/editor/session/editor-session';
import { shortcutBindings } from '@/engine/editor/shortcuts/shortcut-bindings';
export function handleVfxGraphShortcut(event: KeyboardEvent, session: EditorSession): boolean {
    const action = shortcutBindings.resolve(event, 'editor');
    if (action === 'edit.delete') {
        session.vfxGraph.removeSelected();
        return true;
    }
    if (action === 'edit.selectAll') {
        session.vfxGraph.selectAll();
        return true;
    }
    return false;
}
