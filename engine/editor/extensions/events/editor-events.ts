export const EDITOR_EVENT_NAMES = ['selectionChanged', 'sceneChanged', 'assetsChanged', 'historyChanged', 'toolChanged', 'playModeChanged', 'projectSaved'] as const;
export type EditorEventName = (typeof EDITOR_EVENT_NAMES)[number];
export type EditorEventListener = (payload: unknown) => void;
export class EditorEvents {
    private readonly listeners = new Map<EditorEventName, Set<EditorEventListener>>();
    on(name: EditorEventName, listener: EditorEventListener): () => void {
        let listeners = this.listeners.get(name);
        if (!listeners) {
            listeners = new Set();
            this.listeners.set(name, listeners);
        }
        listeners.add(listener);
        return () => {
            this.listeners.get(name)?.delete(listener);
        };
    }
    emit(name: EditorEventName, payload: unknown): void {
        const listeners = this.listeners.get(name);
        if (!listeners)
            return;
        for (const listener of Array.from(listeners))
            listener(payload);
    }
}
