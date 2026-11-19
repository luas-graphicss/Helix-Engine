import type { EditorSession } from '@/engine/editor/session/editor-session';
import type { EditorEventName, EditorEvents } from './editor-events';
import { EventQueue } from './event-queue';
function payloadOf(session: EditorSession, name: EditorEventName): unknown {
    switch (name) {
        case 'selectionChanged':
            return session.selectedEntities();
        case 'toolChanged':
            return session.extensions.toolController.active?.id ?? session.tool;
        case 'playModeChanged':
            return session.playtest.state;
        case 'projectSaved':
            return session.autosave.lastSavedAt;
        default:
            return undefined;
    }
}
export function connectEditorEvents(session: EditorSession, events: EditorEvents): () => void {
    const queue = new EventQueue<EditorEventName>((name) => events.emit(name, payloadOf(session, name)));
    let playState = session.playtest.state;
    let savedAt = session.autosave.lastSavedAt;
    const unsubscribes = [
        session.subscribeTopic('selection', () => queue.push('selectionChanged')),
        session.subscribeTopic('scene', () => queue.push('sceneChanged')),
        session.subscribeTopic('assets', () => queue.push('assetsChanged')),
        session.subscribeTopic('history', () => queue.push('historyChanged')),
        session.subscribeTopic('tool', () => queue.push('toolChanged')),
        session.subscribeTopic('playtest', () => {
            if (session.playtest.state === playState)
                return;
            playState = session.playtest.state;
            queue.push('playModeChanged');
        }),
        session.subscribeTopic('project', () => {
            const { lastSavedAt } = session.autosave;
            if (lastSavedAt === savedAt)
                return;
            savedAt = lastSavedAt;
            queue.push('projectSaved');
        }),
    ];
    return () => {
        queue.clear();
        for (const unsubscribe of unsubscribes)
            unsubscribe();
    };
}
