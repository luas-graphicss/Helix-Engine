import type { TransformTool } from '@/engine/editor/session/editor-session';
import type { ShortcutActionId } from '@/engine/editor/shortcuts/shortcut-actions';
export interface ViewportToolDefinition {
    readonly id: TransformTool;
    readonly label: string;
    readonly shortcut: ShortcutActionId;
}
export const VIEWPORT_TOOL_GROUPS: readonly (readonly ViewportToolDefinition[])[] = [
    [{ id: 'select', label: 'Selecionar', shortcut: 'tool.select' }],
    [
        { id: 'translate', label: 'Mover', shortcut: 'tool.translate' },
        { id: 'rotate', label: 'Rotacionar', shortcut: 'tool.rotate' },
        { id: 'scale', label: 'Escalar', shortcut: 'tool.scale' },
    ],
    [
        { id: 'transform', label: 'Transformar', shortcut: 'tool.transform' },
        { id: 'universal', label: 'Universal', shortcut: 'tool.universal' },
        { id: 'rect', label: 'Retângulo', shortcut: 'tool.rect' },
    ],
    [{ id: 'terrain', label: 'Terreno', shortcut: 'tool.terrain' }],
];
export const VIEWPORT_TOOLS: readonly ViewportToolDefinition[] = VIEWPORT_TOOL_GROUPS.flat();
