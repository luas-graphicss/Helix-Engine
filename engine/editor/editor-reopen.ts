import { useSyncExternalStore } from 'react';
type Listener = () => void;
class EditorReopenStore {
    private version = 0;
    private readonly listeners = new Set<Listener>();
    readonly subscribe = (listener: Listener): (() => void) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    };
    readonly getVersion = (): number => this.version;
    request(): void {
        this.version++;
        for (const listener of this.listeners)
            listener();
    }
}
export const editorReopen = new EditorReopenStore();
export function useEditorReopenVersion(): number {
    return useSyncExternalStore(editorReopen.subscribe, editorReopen.getVersion, editorReopen.getVersion);
}
