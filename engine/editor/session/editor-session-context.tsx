'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import type { EditorSession, ViewportStats } from './editor-session';
import type { SessionTopic } from './session-topics';
const EditorSessionContext = createContext<EditorSession | null>(null);
declare global {
    interface Window {
        __helix?: EditorSession;
    }
}
export function EditorSessionProvider({ session, children }: {
    session: EditorSession;
    children: ReactNode;
}) {
    useEffect(() => {
        if (process.env.NODE_ENV === 'production')
            return;
        window.__helix = session;
        return () => {
            if (window.__helix === session)
                delete window.__helix;
        };
    }, [session]);
    return <EditorSessionContext.Provider value={session}>{children}</EditorSessionContext.Provider>;
}
export function useEditorSession(): EditorSession {
    const session = useContext(EditorSessionContext);
    if (!session)
        throw new Error('useEditorSession deve ser usado dentro de EditorSessionProvider.');
    return session;
}
export function useSessionTopic(...topics: SessionTopic[]): EditorSession {
    const session = useEditorSession();
    const key = topics.join('|');
    const subscribe = useCallback((onChange: () => void) => session.subscribeTopic(topics, onChange), [session, key]);
    const getVersion = useCallback(() => session.getTopicVersion(topics), [session, key]);
    useSyncExternalStore(subscribe, getVersion, getVersion);
    return session;
}
export interface SessionSelectorOptions<T> {
    topics?: readonly SessionTopic[];
    isEqual?: (previous: T, next: T) => boolean;
}
interface SelectorCache<T> {
    version: number;
    selector: (session: EditorSession) => T;
    value: T;
}
export function useSessionSelector<T>(selector: (session: EditorSession) => T, options: SessionSelectorOptions<T> = {}): T {
    const session = useEditorSession();
    const { topics, isEqual = Object.is } = options;
    const scoped = topics !== undefined && topics.length > 0;
    const key = scoped ? topics.join('|') : '';
    const topicsRef = useRef(topics);
    topicsRef.current = topics;
    const subscribe = useCallback((onChange: () => void) => {
        const current = topicsRef.current;
        return current !== undefined && current.length > 0 ? session.subscribeTopic(current, onChange) : session.subscribe(onChange);
    }, [session, key]);
    const cache = useRef<SelectorCache<T> | null>(null);
    const getSnapshot = (): T => {
        const current = topicsRef.current;
        const version = current !== undefined && current.length > 0 ? session.getTopicVersion(current) : session.getVersion();
        const cached = cache.current;
        if (cached && cached.version === version && cached.selector === selector)
            return cached.value;
        const value = selector(session);
        if (cached && isEqual(cached.value, value)) {
            cached.version = version;
            cached.selector = selector;
            return cached.value;
        }
        cache.current = { version, selector, value };
        return value;
    };
    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
export function useLiveEdits(): EditorSession {
    const session = useEditorSession();
    useSyncExternalStore(session.subscribeLiveEdit, session.getLiveEditVersion, session.getLiveEditVersion);
    return session;
}
export function useViewportStats(): ViewportStats {
    const session = useEditorSession();
    useSyncExternalStore(session.subscribeStats, session.getStatsVersion, session.getStatsVersion);
    return session.stats;
}
export function shallowEqual<T>(a: T, b: T): boolean {
    if (Object.is(a, b))
        return true;
    if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null)
        return false;
    if (Array.isArray(a)) {
        if (!Array.isArray(b) || a.length !== b.length)
            return false;
        for (let i = 0; i < a.length; i++)
            if (!Object.is(a[i], b[i]))
                return false;
        return true;
    }
    if (Array.isArray(b))
        return false;
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length)
        return false;
    const recordB = b as Record<string, unknown>;
    for (const k of keysA) {
        if (!Object.prototype.hasOwnProperty.call(recordB, k) || !Object.is((a as Record<string, unknown>)[k], recordB[k]))
            return false;
    }
    return true;
}
