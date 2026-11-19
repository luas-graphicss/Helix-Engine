import type { EditorSession } from '@/engine/editor/session/editor-session';
import { shortcutBindings } from '@/engine/editor/shortcuts/shortcut-bindings';
export function handleShaderGraphShortcut(event: KeyboardEvent, session: EditorSession): boolean {
    const action = shortcutBindings.resolve(event, 'editor');
    if (action === 'edit.delete') {
        session.shaderGraph.removeSelected();
        return true;
    }
    if (action === 'edit.selectAll') {
        session.shaderGraph.selectAll();
        return true;
    }
    return false;
}
