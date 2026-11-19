import type { EditorSession } from '@/engine/editor/session/editor-session';
import { eventChord } from '../shortcuts/shortcut-chord';
import type { ToolContribution } from './tool-contribution';
export function findToolByShortcut(tools: readonly ToolContribution[], event: KeyboardEvent): ToolContribution | null {
    const chord = eventChord(event);
    if (chord === null)
        return null;
    return tools.find((tool) => tool.shortcut === chord) ?? null;
}
export function releaseToolOnEscape(session: EditorSession, event: KeyboardEvent): boolean {
    return event.key === 'Escape' && session.extensions.toolController.deactivate();
}
export function runToolShortcut(session: EditorSession, event: KeyboardEvent): boolean {
    const { tools, toolController } = session.extensions;
    const tool = findToolByShortcut(tools.list(), event);
    if (!tool)
        return false;
    toolController.trigger(tool);
    return true;
}
