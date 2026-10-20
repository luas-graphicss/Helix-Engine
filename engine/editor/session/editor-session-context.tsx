'use client';
import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { EditorSession } from './editor-session';
const EditorSessionContext = createContext<EditorSession | null>(null);
declare global {
    interface Window {
        __helix?: EditorSession;
    }
}
export function EditorSessionProvider({ children }: {
    children: ReactNode;
}) {
    const [session] = useState(() => new EditorSession());
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
export function useEditorState(): EditorSession {
    const session = useEditorSession();
    useSyncExternalStore(session.subscribe, session.getVersion, session.getVersion);
    return session;
}
