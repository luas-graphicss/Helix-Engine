'use client';
import { useSyncExternalStore } from 'react';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import type { VfxGraphEditor } from '../vfx-graph-editor';
export function useVfxGraph(): VfxGraphEditor {
    const { vfxGraph } = useEditorSession();
    useSyncExternalStore(vfxGraph.subscribe, vfxGraph.getVersion, vfxGraph.getVersion);
    return vfxGraph;
}
