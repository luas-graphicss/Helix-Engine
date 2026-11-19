'use client';
import { useSyncExternalStore } from 'react';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import type { DockPanelId } from './dock-layout';
import { resolveDockPanel, type DockPanelDefinition } from './dock-panels';
export function useDockPanelResolver(): (id: DockPanelId) => DockPanelDefinition | null {
    const { windows } = useEditorSession().extensions;
    useSyncExternalStore(windows.subscribe, windows.getVersion, windows.getVersion);
    return (id) => resolveDockPanel(id, windows);
}
