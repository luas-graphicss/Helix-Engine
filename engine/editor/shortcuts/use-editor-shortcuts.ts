'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { handleCodeShortcut } from '@/engine/editor/code/code-shortcuts';
import { editorDialogs } from '@/engine/editor/dialogs/editor-dialogs';
import { handleGuiShortcut } from '@/engine/editor/gui/gui-shortcuts';
import { openImportFilePicker } from '@/engine/editor/import/import-file-picker';
import type { DockLayoutStore } from '@/engine/editor/layout/dock-layout';
import { openMaterialEditor } from '@/engine/editor/materials/material-editor-requests';
import { pickFilesForLibrary } from '@/engine/editor/operations/asset-library-operations';
import { addCsgBrushToSelection, applyCsgToSelection, consolidateCsg, moveBrushSelected, toggleBrushEnabledSelected } from '@/engine/editor/operations/csg-operations';
import { closeProject, createProjectFromEditor } from '@/engine/editor/operations/engine-operations';
import { openDocumentation, openTutorial } from '@/engine/editor/operations/help-operations';
import { addFolder, copySelected, deleteSelected, duplicateSelected, groupSelected, isolateEntities, pasteClipboard, showAllEntities, toggleLockSelected, toggleVisibilitySelected, ungroupSelected, unlockAllEntities, } from '@/engine/editor/operations/entity-operations';
import { exportOpenProject, saveProjectNow } from '@/engine/editor/operations/project-operations';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { focusInspectorName } from './focus-targets';
import type { ShortcutActionId } from './shortcut-actions';
import { shortcutBindings } from './shortcut-bindings';
import { terrainToolForAction } from './tool-actions';
type Router = ReturnType<typeof useRouter>;
const BRUSH_RADIUS_STEP = 1.25;
interface ShortcutContext {
    readonly session: EditorSession;
    readonly dock: DockLayoutStore;
    readonly router: Router;
    readonly event: KeyboardEvent;
}
function isTextEntryTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement))
        return false;
    const tag = target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable)
        return true;
    return target.closest('[role="dialog"], [role="menu"]') !== null;
}
function isGlobalAction(action: ShortcutActionId): boolean {
    return action.startsWith('helix.') || action.startsWith('help.') || action.startsWith('panel.') || action === 'edit.undo' || action === 'edit.redo' || action === 'view.code';
}
function runEditorAction(action: ShortcutActionId, { session, dock, router, event }: ShortcutContext): boolean {
    const terrainTool = terrainToolForAction(action);
    if (terrainTool) {
        if (session.tool !== 'terrain')
            return false;
        session.terrain.setTool(terrainTool);
        return true;
    }
    switch (action) {
        case 'helix.newProject':
            void createProjectFromEditor(session, router);
            return true;
        case 'helix.closeProject':
            void closeProject(session, router);
            return true;
        case 'helix.download':
            void exportOpenProject(session);
            return true;
        case 'helix.build':
            editorDialogs.toggle('build');
            return true;
        case 'helix.autosaves':
            editorDialogs.toggle('autosaves');
            return true;
        case 'helix.shortcuts':
            editorDialogs.toggle('shortcuts');
            return true;
        case 'helix.settings':
            editorDialogs.toggle('settings');
            return true;
        case 'helix.beta':
            editorDialogs.toggle('beta');
            return true;
        case 'helix.about':
            editorDialogs.toggle('about');
            return true;
        case 'helix.exit':
            editorDialogs.open('exit');
            return true;
        case 'help.documentation':
            openDocumentation();
            return true;
        case 'help.tutorial':
            openTutorial();
            return true;
        case 'file.save':
            void saveProjectNow(session);
            return true;
        case 'file.import':
            openImportFilePicker();
            return true;
        case 'file.addToLibrary':
            pickFilesForLibrary(session);
            return true;
        case 'edit.undo':
            session.history.undo();
            return true;
        case 'edit.redo':
            session.history.redo();
            return true;
        case 'edit.duplicate':
            duplicateSelected(session);
            return true;
        case 'edit.copy':
            copySelected(session);
            return true;
        case 'edit.paste':
            pasteClipboard(session);
            return true;
        case 'edit.group':
            groupSelected(session);
            return true;
        case 'edit.ungroup':
            ungroupSelected(session);
            return true;
        case 'edit.selectAll':
            session.selectAll();
            return true;
        case 'edit.newFolder':
            addFolder(session);
            return true;
        case 'edit.rename':
            focusInspectorName();
            return true;
        case 'edit.delete':
            if (session.animation.active && session.animation.selectedBones.length > 0)
                session.animation.deleteSelectedKeys();
            else
                deleteSelected(session);
            return true;
        case 'selection.clear':
            session.select(null);
            return true;
        case 'selection.focus':
            session.focusSelected();
            return true;
        case 'selection.toggleVisibility':
            toggleVisibilitySelected(session);
            return true;
        case 'selection.isolate':
            isolateEntities(session, session.selectedEntities());
            return true;
        case 'selection.showAll':
            showAllEntities(session);
            return true;
        case 'selection.toggleLock':
            toggleLockSelected(session);
            return true;
        case 'selection.unlockAll':
            unlockAllEntities(session);
            return true;
        case 'tool.select':
            session.setTool('select');
            return true;
        case 'tool.translate':
            session.setTool('translate');
            return true;
        case 'tool.rotate':
            session.setTool('rotate');
            return true;
        case 'tool.scale':
            session.setTool('scale');
            return true;
        case 'tool.terrain':
            session.setTool('terrain');
            return true;
        case 'terrain.sampleHeight':
            if (session.tool !== 'terrain')
                return false;
            session.terrain.sampleFlattenHeight();
            return true;
        case 'terrain.brushSmaller':
            session.terrain.scaleBrushRadius(event.shiftKey ? 0.5 : 1 / BRUSH_RADIUS_STEP);
            return true;
        case 'terrain.brushLarger':
            session.terrain.scaleBrushRadius(event.shiftKey ? 2 : BRUSH_RADIUS_STEP);
            return true;
        case 'view.toggleGrid':
            session.toggleGrid();
            return true;
        case 'view.perfHud':
            session.togglePerfHud();
            return true;
        case 'view.materialEditor':
            openMaterialEditor();
            return true;
        case 'view.code':
            if (session.code.presentation === 'window' && session.workspace !== 'code') {
                if (session.code.windowOpen)
                    session.code.closeWindow();
                else
                    session.code.openWindow();
            }
            else {
                session.toggleCodeWorkspace();
            }
            return true;
        case 'csg.addBoxBrush':
            addCsgBrushToSelection(session, 'box');
            return true;
        case 'csg.addCylinderBrush':
            addCsgBrushToSelection(session, 'cylinder');
            return true;
        case 'csg.subtract':
            applyCsgToSelection(session, 'subtract');
            return true;
        case 'csg.union':
            applyCsgToSelection(session, 'union');
            return true;
        case 'csg.intersect':
            applyCsgToSelection(session, 'intersect');
            return true;
        case 'csg.consolidate': {
            const target = session.selectedEntity;
            if (!target?.csg)
                return false;
            consolidateCsg(session, target);
            return true;
        }
        case 'csg.toggleBrushes':
            toggleBrushEnabledSelected(session);
            return true;
        case 'csg.brushUp':
            moveBrushSelected(session, -1);
            return true;
        case 'csg.brushDown':
            moveBrushSelected(session, 1);
            return true;
        case 'simulation.playPause':
            session.playtest.togglePlayPause();
            return true;
        case 'simulation.stop':
            session.playtest.stop();
            return true;
        case 'panel.hierarchy':
            dock.toggle('hierarchy');
            return true;
        case 'panel.assets':
            dock.toggle('assets');
            return true;
        case 'panel.animation':
            dock.toggle('animation');
            return true;
        case 'panel.audio':
            dock.toggle('audio');
            return true;
        case 'panel.vfx':
            dock.toggle('vfx');
            return true;
        case 'panel.lights':
            dock.toggle('lights');
            return true;
        case 'panel.interface':
            dock.toggle('interface');
            return true;
        case 'panel.scripts':
            dock.toggle('scripts');
            return true;
        case 'panel.console':
            dock.toggle('console');
            return true;
        case 'panel.maximize':
            dock.toggleMaximized();
            return true;
        default:
            return false;
    }
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
