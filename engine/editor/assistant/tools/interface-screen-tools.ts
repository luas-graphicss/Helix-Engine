import type { LibraryAsset } from '@/engine/assets/library/asset-types';
import { createGuiScreen, openGuiAssetInDesigner } from '@/engine/editor/operations/gui-operations';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { GUI_TEMPLATES } from '@/engine/gui/templates/gui-templates';
import type { AssistantTool } from './assistant-tool';
import { describeScreen, requireOpenScreen } from './interface-access';
import { ToolFailure } from './tool-failure';
import { choice, parameters, text } from './tool-parameters';
const BLANK_TEMPLATE_ID = 'blank';
const TEMPLATE_IDS = GUI_TEMPLATES.map((template) => template.id);
function requireScreenAsset(session: EditorSession, reference: string): LibraryAsset {
    const screens = session.library.byKind('gui');
    const wanted = reference.trim().toLowerCase();
    const match = screens.find((asset) => asset.id === reference) ?? screens.find((asset) => asset.name.toLowerCase() === wanted);
    if (!match)
        throw new ToolFailure(`No interface screen "${reference}". Call list_interface_screens for ids and names.`);
    return match;
}
const listInterfaceScreens: AssistantTool = {
    name: 'list_interface_screens',
    title: 'Listar telas',
    access: 'read',
    description: 'Lists the interface screens of the game, the screen open in the designer and the templates available for new screens.',
    parameters: parameters({}),
    run(session) {
        return {
            openScreenId: session.gui.assetId,
            screens: session.library.byKind('gui').map((asset) => ({ id: asset.id, name: asset.name })),
            templates: GUI_TEMPLATES.map((template) => ({ id: template.id, description: template.description })),
        };
    },
};
const readInterfaceScreen: AssistantTool = {
    name: 'read_interface_screen',
    title: 'Ler tela',
    access: 'read',
    description: 'Returns the element tree of the screen open in the interface designer. Each line reads `id kind "name"` followed by its text and rectangle.',
    parameters: parameters({}),
    run(session) {
        return describeScreen(requireOpenScreen(session));
    },
};
const createInterfaceScreen: AssistantTool = {
    name: 'create_interface_screen',
    title: 'Criar tela',
    access: 'scene',
    description: 'Creates an interface screen from a template, opens it in the designer and returns its element tree.',
    parameters: parameters({
        template: choice(`Starting layout. Default ${BLANK_TEMPLATE_ID}.`, TEMPLATE_IDS),
        name: text('Screen name.'),
    }),
    async run(session, input) {
        const asset = await createGuiScreen(session, input.optionalChoice('template', TEMPLATE_IDS) ?? BLANK_TEMPLATE_ID, input.optionalText('name'));
        if (!asset)
            throw new ToolFailure('The screen could not be created. Call read_console for the reason.');
        return describeScreen(requireOpenScreen(session));
    },
};
const openInterfaceScreen: AssistantTool = {
    name: 'open_interface_screen',
    title: 'Abrir tela',
    access: 'read',
    description: 'Opens an existing interface screen in the designer so its elements can be read and edited.',
    parameters: parameters({ screen: text('Screen id or exact screen name.') }, ['screen']),
    async run(session, input) {
        const asset = requireScreenAsset(session, input.text('screen'));
        if (!(await openGuiAssetInDesigner(session, asset)))
            throw new ToolFailure(`${asset.name} could not be opened. Call read_console for the reason.`);
        return describeScreen(requireOpenScreen(session));
    },
};
export const INTERFACE_SCREEN_TOOLS: readonly AssistantTool[] = [listInterfaceScreens, readInterfaceScreen, createInterfaceScreen, openInterfaceScreen];
