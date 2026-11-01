import { useSyncExternalStore } from 'react';
export type EditorDialogId = 'settings' | 'shortcuts' | 'autosaves' | 'beta' | 'about' | 'exit' | 'renameProject' | 'baseLanguage' | 'gameServer' | 'build';
type Listener = () => void;
class EditorDialogsStore {
    private current: EditorDialogId | null = null;
    private readonly listeners = new Set<Listener>();
    readonly subscribe = (listener: Listener): (() => void) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    };
    readonly getSnapshot = (): EditorDialogId | null => this.current;
    readonly getServerSnapshot = (): EditorDialogId | null => null;
    open(dialog: EditorDialogId): void {
        this.set(dialog);
    }
    close(): void {
        this.set(null);
    }
    toggle(dialog: EditorDialogId): void {
        this.set(this.current === dialog ? null : dialog);
    }
    private set(next: EditorDialogId | null): void {
        if (this.current === next)
            return;
        this.current = next;
        for (const listener of this.listeners)
            listener();
    }
}
export const editorDialogs = new EditorDialogsStore();
export function useEditorDialog(): EditorDialogId | null {
    return useSyncExternalStore(editorDialogs.subscribe, editorDialogs.getSnapshot, editorDialogs.getServerSnapshot);
}
