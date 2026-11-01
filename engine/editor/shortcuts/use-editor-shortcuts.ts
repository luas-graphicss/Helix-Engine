'use client';
import { useEffect } from 'react';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import type { DockLayoutStore } from '@/engine/editor/layout/dock-layout';
import { addFolder, copySelected, deleteSelected, duplicateSelected, groupSelected, isolateEntities, pasteClipboard, showAllEntities, toggleLockSelected, toggleVisibilitySelected, ungroupSelected, unlockAllEntities, } from '@/engine/editor/operations/entity-operations';
import { addCsgBrushToSelection, applyCsgToSelection, consolidateCsg, moveBrushSelected, toggleBrushEnabledSelected } from '@/engine/editor/operations/csg-operations';
import { TERRAIN_TOOLS } from '@/engine/editor/terrain/terrain-editor';
import { focusInspectorName } from './focus-targets';
import { openImportFilePicker } from '@/engine/editor/import/import-file-picker';
import { pickFilesForLibrary } from '@/engine/editor/operations/asset-library-operations';
import { openMaterialEditor } from '@/engine/editor/materials/material-editor-requests';
const BRUSH_RADIUS_STEP = 1.25;
function isTextEntryTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement))
        return false;
    const tag = target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable)
        return true;
    return target.closest('[role="dialog"], [role="menu"]') !== null;
}
export function useEditorShortcuts(session: EditorSession, dock: DockLayoutStore): void {
    const router = useRouter();
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.defaultPrevented || isTextEntryTarget(event.target))
                return;
            const context: ShortcutContext = { session, dock, router, event };
            const action = shortcutBindings.resolve(event, 'editor');
            if (action && isGlobalAction(action)) {
                if (runEditorAction(action, context))
                    event.preventDefault();
                return;
            }
            if (session.workspace === 'gui') {
                if (handleGuiShortcut(event, session))
                    event.preventDefault();
                return;
            }
            if (session.workspace === 'code') {
                if (handleCodeShortcut(event, session))
                    event.preventDefault();
                return;
            }
            if (session.code.windowOpen && session.code.presentation === 'window' && handleCodeShortcut(event, session)) {
                event.preventDefault();
                return;
            }
            if (action && runEditorAction(action, context))
                event.preventDefault();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [session, dock, router]);
}
