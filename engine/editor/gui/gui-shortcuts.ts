import { alignSelectedGuiNodes, copySelectedGuiNodes, cutSelectedGuiNodes, deleteSelectedGuiNodes, distributeSelectedGuiNodes, duplicateSelectedGuiNodes, groupSelectedGuiNodes, nudgeSelectedGuiNodes, pasteGuiNodes, reorderSelectedGuiNodes, selectGuiChildren, selectGuiParent, setGuiNodesLocked, setGuiNodesVisible, ungroupSelectedGuiNodes, type GuiAlignment, } from '@/engine/editor/operations/gui-element-operations';
import { saveGuiDesignerDocument } from '@/engine/editor/operations/gui-operations';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { focusGuiElementName } from '@/engine/editor/shortcuts/focus-targets';
import type { ShortcutActionId } from '@/engine/editor/shortcuts/shortcut-actions';
import { shortcutBindings } from '@/engine/editor/shortcuts/shortcut-bindings';
import { guiToolForAction } from '@/engine/editor/shortcuts/tool-actions';
const NUDGE_STEP = 1;
const NUDGE_FAST_STEP = 10;
const ALIGN_ACTIONS: Partial<Record<ShortcutActionId, GuiAlignment>> = {
    'gui.alignLeft': 'left',
    'gui.alignHCenter': 'hcenter',
    'gui.alignRight': 'right',
    'gui.alignTop': 'top',
    'gui.alignVCenter': 'vcenter',
    'gui.alignBottom': 'bottom',
};
const NUDGE_ACTIONS: Partial<Record<ShortcutActionId, readonly [
    x: number,
    y: number
]>> = {
    'gui.nudgeLeft': [-1, 0],
    'gui.nudgeRight': [1, 0],
    'gui.nudgeUp': [0, -1],
    'gui.nudgeDown': [0, 1],
};
const PREVIEW_ACTIONS: ReadonlySet<ShortcutActionId> = new Set<ShortcutActionId>([
    'gui.save',
    'gui.togglePreview',
    'gui.zoomIn',
    'gui.zoomOut',
    'gui.zoomReset',
    'gui.fitAll',
    'gui.toggleGrid',
    'gui.toggleSnapGrid',
    'gui.toggleSafeArea',
    'gui.rotateDevice',
    'gui.toggleDeviceFrame',
    'gui.zoomDevicePixels',
    'gui.zoomPhysicalSize',
    'gui.escape',
]);
export function handleGuiShortcut(event: KeyboardEvent, session: EditorSession): boolean {
    const designer = session.gui;
    if (!designer.document)
        return false;
    const action = shortcutBindings.resolve(event, 'gui');
    if (!action)
        return false;
    if (designer.mode === 'preview' && !PREVIEW_ACTIONS.has(action))
        return false;
    const tool = guiToolForAction(action);
    if (tool) {
        designer.setTool(tool);
        return true;
    }
    const alignment = ALIGN_ACTIONS[action];
    if (alignment) {
        alignSelectedGuiNodes(session, alignment);
        return true;
    }
    const nudge = NUDGE_ACTIONS[action];
    if (nudge) {
        const step = event.shiftKey ? NUDGE_FAST_STEP : NUDGE_STEP;
        nudgeSelectedGuiNodes(session, nudge[0] * step, nudge[1] * step);
        return true;
    }
    const primary = designer.primaryNode;
    const selected = [...designer.selectedIds];
    switch (action) {
        case 'gui.save':
            void saveGuiDesignerDocument(session);
            return true;
        case 'gui.togglePreview':
            designer.togglePreview();
            return true;
        case 'gui.zoomIn':
            designer.zoomStepAtCenter(1);
            return true;
        case 'gui.zoomOut':
            designer.zoomStepAtCenter(-1);
            return true;
        case 'gui.zoomReset':
            designer.zoomAtCenter(1);
            return true;
        case 'gui.fitAll':
            designer.fitAll();
            return true;
        case 'gui.fitSelection':
            designer.fitSelectionInView();
            return true;
        case 'gui.toggleGrid':
            designer.toggleOption('grid');
            return true;
        case 'gui.toggleSnapGrid':
            designer.toggleOption('snapGrid');
            return true;
        case 'gui.toggleRulers':
            designer.toggleOption('rulers');
            return true;
        case 'gui.toggleOutlines':
            designer.toggleOption('outlines');
            return true;
        case 'gui.toggleSafeArea':
            designer.toggleOption('safeArea');
            return true;
        case 'gui.rotateDevice':
            designer.rotateDevice();
            return true;
        case 'gui.toggleDeviceFrame':
            designer.toggleOption('deviceFrame');
            return true;
        case 'gui.zoomDevicePixels':
            designer.zoomToDevicePixels();
            return true;
        case 'gui.zoomPhysicalSize':
            designer.zoomToPhysicalSize();
            return true;
        case 'gui.duplicate':
            duplicateSelectedGuiNodes(session);
            return true;
        case 'gui.copy':
            return copySelectedGuiNodes(session);
        case 'gui.cut':
            cutSelectedGuiNodes(session);
            return true;
        case 'gui.paste':
            pasteGuiNodes(session);
            return true;
        case 'gui.selectAll':
            designer.selectAll();
            return true;
        case 'gui.group':
            groupSelectedGuiNodes(session);
            return true;
        case 'gui.ungroup':
            ungroupSelectedGuiNodes(session);
            return true;
        case 'gui.bringForward':
            reorderSelectedGuiNodes(session, 'forward');
            return true;
        case 'gui.bringToFront':
            reorderSelectedGuiNodes(session, 'front');
            return true;
        case 'gui.sendBackward':
            reorderSelectedGuiNodes(session, 'backward');
            return true;
        case 'gui.sendToBack':
            reorderSelectedGuiNodes(session, 'back');
            return true;
        case 'gui.distributeH':
            distributeSelectedGuiNodes(session, 'x');
            return true;
        case 'gui.distributeV':
            distributeSelectedGuiNodes(session, 'y');
            return true;
        case 'gui.enter':
            if (primary && selected.length === 1 && primary.text)
                designer.beginTextEdit(primary.id);
            else
                selectGuiChildren(session);
            return true;
        case 'gui.selectParent':
            selectGuiParent(session);
            return true;
        case 'gui.rename':
            focusGuiElementName();
            return true;
        case 'gui.toggleVisibility':
            if (selected.length > 0)
                setGuiNodesVisible(session, selected, !designer.selectedNodes.every((node) => node.visible));
            return true;
        case 'gui.toggleLock':
            if (selected.length > 0)
                setGuiNodesLocked(session, selected, !designer.selectedNodes.every((node) => node.locked));
            return true;
        case 'gui.delete':
            deleteSelectedGuiNodes(session);
            return true;
        case 'gui.escape':
            if (designer.mode === 'preview')
                designer.setMode('design');
            else if (designer.editingTextId)
                designer.endTextEdit();
            else if (designer.tool !== 'select')
                designer.setTool('select');
            else if (designer.selectedIds.size > 0)
                designer.clearSelection();
            else
                return false;
            return true;
        default:
            return false;
    }
}
