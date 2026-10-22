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
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.defaultPrevented || isTextEntryTarget(event.target))
                return;
            const key = event.key.toLowerCase();
            const modifier = event.ctrlKey || event.metaKey;
            if (modifier && !event.altKey) {
                const panel = key === '`' ? 'console' : event.shiftKey && key === 'e' ? 'hierarchy' : event.shiftKey && key === 'a' ? 'assets' : event.shiftKey && key === 't' ? 'animation' : null;
                if (panel) {
                    dock.toggle(panel);
                    event.preventDefault();
                    return;
                }
                if (event.shiftKey && key === ' ') {
                    dock.toggleMaximized();
                    event.preventDefault();
                    return;
                }
            }
            if (modifier && event.altKey) {
                switch (key) {
                    case 's':
                        applyCsgToSelection(session, 'subtract');
                        break;
                    case 'u':
                        applyCsgToSelection(session, 'union');
                        break;
                    case 'i':
                        applyCsgToSelection(session, 'intersect');
                        break;
                    case 'b': {
                        const target = session.selectedEntity;
                        if (target?.csg)
                            consolidateCsg(session, target);
                        break;
                    }
                    case 'e':
                        toggleBrushEnabledSelected(session);
                        break;
                    case 'arrowup':
                        moveBrushSelected(session, -1);
                        break;
                    case 'arrowdown':
                        moveBrushSelected(session, 1);
                        break;
                    default:
                        return;
                }
                event.preventDefault();
                return;
            }
            if (event.altKey && !modifier) {
                switch (key) {
                    case 'h':
                        showAllEntities(session);
                        break;
                    case 'l':
                        unlockAllEntities(session);
                        break;
                    case 'n':
                        addFolder(session);
                        break;
                    default:
                        return;
                }
                event.preventDefault();
                return;
            }
            if (modifier) {
                switch (key) {
                    case 'z':
                        if (event.shiftKey)
                            session.history.redo();
                        else
                            session.history.undo();
                        break;
                    case 'y':
                        session.history.redo();
                        break;
                    case 'd':
                        duplicateSelected(session);
                        break;
                    case 'c':
                        copySelected(session);
                        break;
                    case 'v':
                        pasteClipboard(session);
                        break;
                    case 'g':
                        if (event.shiftKey)
                            ungroupSelected(session);
                        else
                            groupSelected(session);
                        break;
                    case 'a':
                        session.selectAll();
                        break;
                    case 'i':
                        openImportFilePicker();
                        break;
                    case 'b':
                        pickFilesForLibrary(session);
                        break;
                    case 'p':
                        if (event.shiftKey)
                            session.playtest.stop();
                        else
                            session.playtest.togglePlayPause();
                        break;
                    default:
                        return;
                }
                event.preventDefault();
                return;
            }
            if (session.tool === 'terrain') {
                const terrainTool = TERRAIN_TOOLS.find((tool) => tool.key === key);
                if (terrainTool) {
                    session.terrain.setTool(terrainTool.id);
                    event.preventDefault();
                    return;
                }
                if (key === 'c') {
                    session.terrain.sampleFlattenHeight();
                    event.preventDefault();
                    return;
                }
            }
            switch (key) {
                case 'q':
                    session.setTool('select');
                    break;
                case 'w':
                    session.setTool('translate');
                    break;
                case 'e':
                    session.setTool('rotate');
                    break;
                case 'r':
                    session.setTool('scale');
                    break;
                case 't':
                    session.setTool('terrain');
                    break;
                case '[':
                    session.terrain.scaleBrushRadius(event.shiftKey ? 0.5 : 1 / BRUSH_RADIUS_STEP);
                    break;
                case ']':
                    session.terrain.scaleBrushRadius(event.shiftKey ? 2 : BRUSH_RADIUS_STEP);
                    break;
                case 'f':
                    session.focusSelected();
                    break;
                case 'g':
                    session.toggleGrid();
                    break;
                case 'm':
                    openMaterialEditor();
                    break;
                case 'b':
                    addCsgBrushToSelection(session, event.shiftKey ? 'cylinder' : 'box');
                    break;
                case 'h':
                    if (event.shiftKey)
                        isolateEntities(session, session.selectedEntities());
                    else
                        toggleVisibilitySelected(session);
                    break;
                case 'l':
                    toggleLockSelected(session);
                    break;
                case 'f2':
                    focusInspectorName();
                    break;
                case 'escape':
                    session.select(null);
                    break;
                case 'delete':
                case 'backspace':
                    if (session.animation.active && session.animation.selectedBones.length > 0)
                        session.animation.deleteSelectedKeys();
                    else
                        deleteSelected(session);
                    break;
                default:
                    return;
            }
            event.preventDefault();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [session, dock]);
}
