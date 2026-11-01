import { closeScriptTab, compileProject, createScript, runActiveScript, saveActiveScript, saveAllScripts } from '@/engine/editor/operations/script-operations';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { focusCommandBar } from '@/engine/editor/shortcuts/focus-targets';
import { shortcutBindings } from '@/engine/editor/shortcuts/shortcut-bindings';
export function handleCodeShortcut(event: KeyboardEvent, session: EditorSession): boolean {
    const { code } = session;
    const action = shortcutBindings.resolve(event, 'code');
    if (!action)
        return false;
    switch (action) {
        case 'code.newScript':
            void createScript(session);
            return true;
        case 'code.save':
            if (!code.activeTab)
                return false;
            void saveActiveScript(session);
            return true;
        case 'code.saveAll':
            if (!code.anyDirty)
                return false;
            void saveAllScripts(session);
            return true;
        case 'code.closeTab':
            if (!code.activeId)
                return false;
            void closeScriptTab(session, code.activeId);
            return true;
        case 'code.run':
            void runActiveScript(session);
            return true;
        case 'code.compile':
            void compileProject(session);
            return true;
        case 'code.find':
            if (!code.activeTab)
                return false;
            code.openFind({ replace: false });
            return true;
        case 'code.replace':
            if (!code.activeTab)
                return false;
            code.openFind({ replace: true });
            return true;
        case 'code.nextTab':
            if (code.tabs.length < 2)
                return false;
            code.cycle(1);
            return true;
        case 'code.previousTab':
            if (code.tabs.length < 2)
                return false;
            code.cycle(-1);
            return true;
        case 'code.focusCommandBar':
            if (!code.commandBarVisible)
                code.setCommandBarVisible(true);
            if (!focusCommandBar())
                requestAnimationFrame(() => focusCommandBar());
            return true;
        case 'code.toggleCommandBar':
            code.toggleCommandBar();
            return true;
        case 'code.escape':
            if (code.find.open) {
                code.closeFind();
                return true;
            }
            if (session.workspace === 'code') {
                session.setWorkspace('scene');
                return true;
            }
            return false;
        default:
            return false;
    }
}
