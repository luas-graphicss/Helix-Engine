import { isGuiContainer } from '@/engine/editor/operations/gui-element-operations';
import { saveGuiDesignerDocument } from '@/engine/editor/operations/gui-operations';
import { createGuiNode, GUI_ELEMENT_KINDS, GUI_ELEMENT_LABELS, GUI_ROOT_ID } from '@/engine/gui/document/gui-document';
import { insertGuiNode, removeGuiNodes, uniqueGuiName } from '@/engine/gui/document/gui-tree';
import type { AssistantTool } from './assistant-tool';
import { describeElement, requireElement, requireOpenScreen } from './interface-access';
import { ELEMENT_PATCH_PARAMETERS, patchElement } from './interface-element-patch';
import { ToolFailure } from './tool-failure';
import { choice, parameters, text, textList } from './tool-parameters';
const addInterfaceElement: AssistantTool = {
    name: 'add_interface_element',
    title: 'Adicionar elemento de interface',
    access: 'scene',
    description: 'Adds an element to the screen open in the interface designer. Without a rectangle the element keeps its default size at the top-left corner of the parent.',
    parameters: parameters({
        kind: choice('Element type. frame and scroll can hold children.', GUI_ELEMENT_KINDS),
        parentId: text(`Id of the frame or scroll element that receives it. Default "${GUI_ROOT_ID}", the screen itself.`),
        ...ELEMENT_PATCH_PARAMETERS,
    }, ['kind']),
    async run(session, input) {
        const document = requireOpenScreen(session);
        const kind = input.choice('kind', GUI_ELEMENT_KINDS);
        const parent = requireElement(document, input.optionalText('parentId') ?? GUI_ROOT_ID);
        if (!isGuiContainer(parent))
            throw new ToolFailure(`"${parent.name}" is a ${parent.kind} and cannot hold children. Use a frame or scroll element as parent.`);
        const name = uniqueGuiName(document.root, input.optionalText('name')?.trim() || GUI_ELEMENT_LABELS[kind]);
        const element = patchElement(createGuiNode(kind, { name }), input);
        session.gui.apply(`Adicionar ${GUI_ELEMENT_LABELS[kind].toLowerCase()}`, (current) => ({ ...current, root: insertGuiNode(current.root, parent.id, element) }));
        session.gui.select([element.id]);
        await saveGuiDesignerDocument(session, { silent: true });
        return describeElement(element);
    },
};
const updateInterfaceElement: AssistantTool = {
    name: 'update_interface_element',
    title: 'Alterar elemento de interface',
    access: 'scene',
    description: 'Changes an element of the screen open in the interface designer. Only the given fields change.',
    parameters: parameters({ id: text('Element id.'), ...ELEMENT_PATCH_PARAMETERS }, ['id']),
    async run(session, input) {
        const document = requireOpenScreen(session);
        const current = requireElement(document, input.text('id'));
        const name = input.optionalText('name')?.trim();
        const renamed = name ? { ...current, name: uniqueGuiName(document.root, name, current.id) } : current;
        const next = patchElement(renamed, input);
        session.gui.updateNodes(`Alterar ${current.name}`, [current.id], () => next);
        await saveGuiDesignerDocument(session, { silent: true });
        return describeElement(next);
    },
};
const deleteInterfaceElements: AssistantTool = {
    name: 'delete_interface_elements',
    title: 'Excluir elementos de interface',
    access: 'destructive',
    description: 'Deletes elements and their children from the screen open in the interface designer.',
    parameters: parameters({ ids: textList('Element ids to delete.') }, ['ids']),
    async run(session, input) {
        const document = requireOpenScreen(session);
        const ids = input.texts('ids');
        if (ids.includes(GUI_ROOT_ID))
            throw new ToolFailure('The screen root cannot be deleted.');
        const names = ids.map((id) => requireElement(document, id).name).join(', ');
        session.gui.apply('Excluir elementos', (current) => ({ ...current, root: removeGuiNodes(current.root, new Set(ids)) }));
        session.gui.clearSelection();
        await saveGuiDesignerDocument(session, { silent: true });
        return `Deleted ${names}.`;
    },
};
export const INTERFACE_ELEMENT_TOOLS: readonly AssistantTool[] = [addInterfaceElement, updateInterfaceElement, deleteInterfaceElements];
