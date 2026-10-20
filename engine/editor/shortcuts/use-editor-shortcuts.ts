'use client';
import { useEffect } from 'react';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { copySelected, deleteSelected, duplicateSelected, groupEntity, pasteClipboard, setEntityVisibility, } from '@/engine/editor/operations/entity-operations';
import { TERRAIN_TOOLS } from '@/engine/editor/terrain/terrain-editor';
import { focusInspectorName } from './focus-targets';
import { openImportFilePicker } from '@/engine/editor/import/import-file-picker';
const BRUSH_RADIUS_STEP = 1.25;
function isTextEntryTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement))
        return false;
    const tag = target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable)
        return true;
    return target.closest('[role="dialog"], [role="menu"]') !== null;
}
export function useEditorShortcuts(session: EditorSession): void {
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.defaultPrevented || isTextEntryTarget(event.target))
                return;
            const key = event.key.toLowerCase();
            const modifier = event.ctrlKey || event.metaKey;
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
                    case 'g': {
                        const entity = session.selectedEntity;
                        if (entity)
                            groupEntity(session, entity);
                        break;
                    }
                    case 'i':
                        openImportFilePicker();
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
                case 'h': {
                    const entity = session.selectedEntity;
                    if (entity)
                        setEntityVisibility(session, entity, !entity.visible);
                    break;
                }
                case 'f2':
                    focusInspectorName();
                    break;
                case 'escape':
                    session.select(null);
                    break;
                case 'delete':
                case 'backspace':
                    deleteSelected(session);
                    break;
                default:
                    return;
            }
            event.preventDefault();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [session]);
}
