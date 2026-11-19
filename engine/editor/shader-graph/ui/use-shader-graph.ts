'use client';
import { useSyncExternalStore } from 'react';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import type { ShaderGraphEditor } from '../shader-graph-editor';
export function useShaderGraph(): ShaderGraphEditor {
    const { shaderGraph } = useEditorSession();
    useSyncExternalStore(shaderGraph.subscribe, shaderGraph.getVersion, shaderGraph.getVersion);
    return shaderGraph;
}
