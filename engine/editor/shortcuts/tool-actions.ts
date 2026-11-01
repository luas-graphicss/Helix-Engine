import type { GuiTool } from '@/engine/editor/gui/gui-designer';
import { TERRAIN_TOOLS, type TerrainToolId } from '@/engine/editor/terrain/terrain-editor';
import { GUI_ELEMENT_KINDS } from '@/engine/gui/document/gui-document';
import type { ShortcutActionId } from './shortcut-actions';
export function terrainToolAction(tool: TerrainToolId): ShortcutActionId {
    return `terrain.tool.${tool}`;
}
export function guiToolAction(tool: GuiTool): ShortcutActionId {
    switch (tool) {
        case 'select':
        case 'hand':
        case 'frame':
        case 'text':
        case 'image':
        case 'icon':
        case 'button':
            return `gui.tool.${tool}`;
        default:
            return `gui.element.${tool}`;
    }
}
const TERRAIN_TOOL_BY_ACTION = new Map<ShortcutActionId, TerrainToolId>(TERRAIN_TOOLS.map((tool) => [terrainToolAction(tool.id), tool.id]));
const GUI_TOOLS: readonly GuiTool[] = ['select', 'hand', ...GUI_ELEMENT_KINDS];
const GUI_TOOL_BY_ACTION = new Map<ShortcutActionId, GuiTool>(GUI_TOOLS.map((tool) => [guiToolAction(tool), tool]));
export function terrainToolForAction(action: ShortcutActionId): TerrainToolId | null {
    return TERRAIN_TOOL_BY_ACTION.get(action) ?? null;
}
export function guiToolForAction(action: ShortcutActionId): GuiTool | null {
    return GUI_TOOL_BY_ACTION.get(action) ?? null;
}
