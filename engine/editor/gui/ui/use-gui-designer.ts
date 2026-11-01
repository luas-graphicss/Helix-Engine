'use client';
import { useSyncExternalStore } from 'react';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import type { GuiDesigner } from '../gui-designer';
export function useGuiDesigner(): GuiDesigner {
    const { gui } = useEditorSession();
    useSyncExternalStore(gui.subscribe, gui.getVersion, gui.getVersion);
    return gui;
}
