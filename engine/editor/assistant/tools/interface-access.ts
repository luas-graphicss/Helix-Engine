import type { GuiDocument, GuiNode } from '@/engine/gui/document/gui-document';
import { findGuiNode, walkGui } from '@/engine/gui/document/gui-tree';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { ToolFailure } from './tool-failure';
export function requireOpenScreen(session: EditorSession): GuiDocument {
    const { document } = session.gui;
    if (!document)
        throw new ToolFailure('No interface screen is open. Call create_interface_screen or open_interface_screen first.');
    return document;
}
export function requireElement(document: GuiDocument, id: string): GuiNode {
    const node = findGuiNode(document.root, id);
    if (!node)
        throw new ToolFailure(`No interface element with id "${id}". Call read_interface_screen for valid ids.`);
    return node;
}
export function describeElement(node: GuiNode): string {
    const { position, size } = node.rect;
    const content = node.text ? ` text=${JSON.stringify(node.text.content)}` : '';
    const hidden = node.visible ? '' : ' hidden';
    return `${node.id} ${node.kind} "${node.name}"${content} position=[${position.x.offset}, ${position.y.offset}] positionScale=[${position.x.scale}, ${position.y.scale}] size=[${size.x.offset}, ${size.y.offset}] sizeScale=[${size.x.scale}, ${size.y.scale}]${hidden}`;
}
export function describeScreen(document: GuiDocument): string {
    const lines = [`Screen "${document.name}", reference resolution ${document.referenceSize.x}x${document.referenceSize.y}.`];
    walkGui(document.root, (node, _parent, depth) => lines.push(`${'  '.repeat(depth)}${describeElement(node)}`));
    return lines.join('\n');
}
