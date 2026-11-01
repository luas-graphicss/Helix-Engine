import { findGuiNode, findGuiParent, isGuiDescendant } from '@/engine/gui/document/gui-tree';
import type { GuiNode } from '@/engine/gui/document/gui-document';
import { isGuiContainer, moveGuiNodeTo } from '@/engine/editor/operations/gui-element-operations';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { layerInsertionIndex, type LayerDropTarget, type LayerRow } from './gui-layer-model';
export function canDropOnLayer(root: GuiNode, dragged: readonly string[], targetId: string): boolean {
    return dragged.length > 0 && !dragged.some((id) => id === targetId || isGuiDescendant(root, id, targetId));
}
let dropCounter = 0;
export function dropLayers(session: EditorSession, dragged: readonly string[], target: LayerDropTarget, rows: readonly LayerRow[]): void {
    const designer = session.gui;
    const document = designer.document;
    if (!document || !canDropOnLayer(document.root, dragged, target.id))
        return;
    const visualIndex = new Map(rows.map((row, index) => [row.node.id, index]));
    const ordered = [...dragged].sort((a, b) => (visualIndex.get(a) ?? 0) - (visualIndex.get(b) ?? 0));
    const mergeKey = `gui-layer-drop-${++dropCounter}`;
    if (target.zone === 'inside') {
        const container = findGuiNode(document.root, target.id);
        if (!container || !isGuiContainer(container))
            return;
        for (const id of [...ordered].reverse()) {
            const live = designer.document ? findGuiNode(designer.document.root, container.id) : null;
            if (!live)
                break;
            moveGuiNodeTo(session, id, live.id, live.children.length, true, mergeKey);
        }
    }
    else {
        const parent = findGuiParent(document.root, target.id);
        if (!parent)
            return;
        for (const id of ordered) {
            const live = designer.document ? findGuiNode(designer.document.root, parent.id) : null;
            if (!live)
                break;
            moveGuiNodeTo(session, id, live.id, layerInsertionIndex(live, target.id, target.zone), true, mergeKey);
        }
    }
    designer.endMerge();
}
