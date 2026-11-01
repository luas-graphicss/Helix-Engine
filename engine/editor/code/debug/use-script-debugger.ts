'use client';
import { useRef, useSyncExternalStore } from 'react';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import type { ScriptDebugger } from '@/engine/scripting/debug/script-debugger';
export function useScriptDebugger(): ScriptDebugger {
    const { scriptDebugger } = useEditorSession().scripts;
    useSyncExternalStore(scriptDebugger.subscribe, scriptDebugger.getVersion, scriptDebugger.getVersion);
    return scriptDebugger;
}
export function useDebuggerActions(): ScriptDebugger {
    return useEditorSession().scripts.scriptDebugger;
}
interface SelectorCache<T> {
    version: number;
    selector: (scriptDebugger: ScriptDebugger) => T;
    value: T;
}
export function useDebuggerSelector<T>(selector: (scriptDebugger: ScriptDebugger) => T, isEqual: (previous: T, next: T) => boolean = Object.is): T {
    const { scriptDebugger } = useEditorSession().scripts;
    const cache = useRef<SelectorCache<T> | null>(null);
    const getSnapshot = (): T => {
        const version = scriptDebugger.getVersion();
        const cached = cache.current;
        if (cached && cached.version === version && cached.selector === selector)
            return cached.value;
        const value = selector(scriptDebugger);
        if (cached && isEqual(cached.value, value)) {
            cached.version = version;
            cached.selector = selector;
            return cached.value;
        }
        cache.current = { version, selector, value };
        return value;
    };
    return useSyncExternalStore(scriptDebugger.subscribe, getSnapshot, getSnapshot);
}
