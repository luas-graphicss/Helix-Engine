'use client';
import type { GuiNode } from '@/engine/gui/document/gui-document';
import { renameGuiNode } from '@/engine/editor/operations/gui-element-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
export function GuiLayerRenameInput({ node, onDone }: {
    node: GuiNode;
    onDone: () => void;
}) {
    const session = useEditorSession();
    return (<input autoFocus defaultValue={node.name} aria-label="Novo nome do elemento" onFocus={(event) => event.currentTarget.select()} onBlur={(event) => {
            renameGuiNode(session, node.id, event.currentTarget.value);
            onDone();
        }} onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === 'Enter')
                event.currentTarget.blur();
            if (event.key === 'Escape') {
                event.currentTarget.value = node.name;
                event.currentTarget.blur();
            }
        }} onClick={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()} className="h-5 min-w-0 flex-1 rounded-xs border border-primary/70 bg-input px-1 text-2xs text-foreground shadow-well outline-none"/>);
}
