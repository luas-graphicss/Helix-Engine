'use client';
import { useRef, useSyncExternalStore } from 'react';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import type { CodeEditor } from '../code-editor';
export function useCodeEditor(): CodeEditor {
    const { code } = useEditorSession();
    useSyncExternalStore(code.subscribe, code.getVersion, code.getVersion);
    return code;
}
export function useCodeActions(): CodeEditor {
    return useEditorSession().code;
}
interface SelectorCache<T> {
    version: number;
    selector: (code: CodeEditor) => T;
    value: T;
}
export function useCodeSelector<T>(selector: (code: CodeEditor) => T, isEqual: (previous: T, next: T) => boolean = Object.is): T {
    const { code } = useEditorSession();
    const cache = useRef<SelectorCache<T> | null>(null);
    const getSnapshot = (): T => {
        const version = code.getVersion();
        const cached = cache.current;
        if (cached && cached.version === version && cached.selector === selector)
            return cached.value;
        const value = selector(code);
        if (cached && isEqual(cached.value, value)) {
            cached.version = version;
            cached.selector = selector;
            return cached.value;
        }
        cache.current = { version, selector, value };
        return value;
    };
    return useSyncExternalStore(code.subscribe, getSnapshot, getSnapshot);
}
