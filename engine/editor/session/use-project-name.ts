'use client';
import { useSyncExternalStore } from 'react';
import { useEditorSession } from './editor-session-context';
export function useProjectName(): string {
    const session = useEditorSession();
    const { registry } = session.project;
    return useSyncExternalStore(registry.subscribe, () => session.projectName, () => session.projectName);
}
