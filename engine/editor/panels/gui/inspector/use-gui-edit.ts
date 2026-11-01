'use client';
import { useCallback } from 'react';
import { endGuiEdit } from '@/engine/editor/operations/gui-property-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
export function useGuiEdit() {
    const session = useEditorSession();
    const end = useCallback(() => endGuiEdit(session), [session]);
    return { session, end };
}
