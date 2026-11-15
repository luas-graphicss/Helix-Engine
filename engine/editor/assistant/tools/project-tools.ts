import { saveProjectNow } from '@/engine/editor/operations/project-operations';
import type { AssistantTool } from './assistant-tool';
import { ToolFailure } from './tool-failure';
import { parameters } from './tool-parameters';
const projectOverview: AssistantTool = {
    name: 'get_project_overview',
    title: 'Ler o projeto',
    access: 'read',
    description: 'Summarizes the open game: name, scripting language, entity count, scripts, interface screens, selection, playtest state and console counters. Call it first when you lack context.',
    parameters: parameters({}),
    run(session) {
        const { scripting } = session.scene;
        const { library } = session;
        return {
            project: session.projectName,
            workspace: session.workspace,
            playtest: session.playtest.state,
            baseLanguage: scripting.baseLanguage,
            entryScript: scripting.entryScriptId ? (library.get(scripting.entryScriptId)?.name ?? null) : null,
            entityCount: session.countEntities(),
            scripts: library.byKind('script').map((asset) => asset.name),
            interfaceScreens: library.byKind('gui').map((asset) => asset.name),
            selection: session.selectedEntities().map((entity) => ({ id: entity.id, name: entity.name, kind: entity.kind })),
            console: { errors: session.log.count('error'), warnings: session.log.count('warn') },
        };
    },
};
const saveProject: AssistantTool = {
    name: 'save_project',
    title: 'Salvar o projeto',
    access: 'scene',
    description: 'Saves the scene and the asset libraries of the open game.',
    parameters: parameters({}),
    async run(session) {
        if (!(await saveProjectNow(session)))
            throw new ToolFailure('The project could not be saved. Call read_console for the reason.');
        return 'Project saved.';
    },
};
const undoLastChange: AssistantTool = {
    name: 'undo_last_change',
    title: 'Desfazer',
    access: 'scene',
    description: 'Undoes the most recent change in the editor history, like Ctrl+Z.',
    parameters: parameters({}),
    run(session) {
        const label = session.history.undoLabel;
        if (!label)
            throw new ToolFailure('There is nothing to undo.');
        session.history.undo();
        return `Undid "${label}".`;
    },
};
export const PROJECT_TOOLS: readonly AssistantTool[] = [projectOverview, saveProject, undoLastChange];
