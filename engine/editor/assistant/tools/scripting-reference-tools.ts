import { compileProject } from '@/engine/editor/operations/script-operations';
import { buildScriptSource, SCRIPT_TEMPLATES } from '@/engine/scripting/script-templates';
import type { AssistantTool } from './assistant-tool';
import { LANGUAGE_PARAMETER, resolveScriptLanguage } from './script-access';
import { ToolFailure } from './tool-failure';
import { choice, parameters, text } from './tool-parameters';
const CONTEXT_LINES = 2;
const API_MATCH_LIMIT = 30;
const DIAGNOSTIC_LIMIT = 60;
const TEMPLATE_SCRIPT_NAME = 'Example';
const TEMPLATE_IDS = SCRIPT_TEMPLATES.map((template) => template.id);
function excerptAround(lines: readonly string[], matches: readonly number[]): string {
    const selected = new Set<number>();
    for (const match of matches) {
        for (let line = match - CONTEXT_LINES; line <= match + CONTEXT_LINES; line++)
            selected.add(line);
    }
    return Array.from(selected)
        .filter((line) => line >= 0 && line < lines.length && lines[line].trim() !== '')
        .sort((a, b) => a - b)
        .map((line) => lines[line])
        .join('\n');
}
const searchScriptingApi: AssistantTool = {
    name: 'search_scripting_api',
    title: 'Consultar a API de scripting',
    access: 'read',
    description: 'Searches the TypeScript declarations of the Helix scripting API, the `helix` module that every language binds to. Use one or two words such as a namespace or a method name: physics, raycast, scene find, input.',
    parameters: parameters({ query: text('Words that must all appear on the same declaration line.') }, ['query']),
    async run(_session, input) {
        const query = input.text('query');
        const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
        if (terms.length === 0)
            throw new ToolFailure('"query" cannot be empty.');
        const { HELIX_DECLARATIONS } = await import('@/engine/scripting/typings/helix-dts');
        const lines = HELIX_DECLARATIONS.split('\n');
        const matches: number[] = [];
        for (const [index, line] of lines.entries()) {
            const lowered = line.toLowerCase();
            if (terms.every((term) => lowered.includes(term)))
                matches.push(index);
        }
        if (matches.length === 0)
            return `No declaration matches "${query}". Try a single word such as a namespace: scene, physics, input, gui.`;
        const excerpt = excerptAround(lines, matches.slice(0, API_MATCH_LIMIT));
        return matches.length > API_MATCH_LIMIT ? `${excerpt}\nShowing ${API_MATCH_LIMIT} of ${matches.length} matches. Refine the query.` : excerpt;
    },
};
const readScriptTemplate: AssistantTool = {
    name: 'read_script_template',
    title: 'Ler modelo de script',
    access: 'read',
    description: 'Returns the starter source of a script template in a given language. Read it before writing a script to copy the lifecycle and import conventions of that language.',
    parameters: parameters({
        language: LANGUAGE_PARAMETER,
        template: choice('Template to read. actor shows the per-entity lifecycle, game the entry point, module a reusable library. Default actor.', TEMPLATE_IDS),
    }),
    run(session, input) {
        const language = resolveScriptLanguage(session, input.optionalText('language'));
        return buildScriptSource(language, input.optionalChoice('template', TEMPLATE_IDS) ?? 'actor', TEMPLATE_SCRIPT_NAME);
    },
};
const compileScripts: AssistantTool = {
    name: 'compile_scripts',
    title: 'Compilar scripts',
    access: 'run',
    description: 'Saves open scripts, compiles every script of the game and returns the compiler diagnostics.',
    parameters: parameters({}),
    async run(session) {
        await compileProject(session);
        const { code, library } = session;
        return {
            state: code.compileState,
            message: code.compileMessage,
            diagnostics: code.diagnostics.slice(0, DIAGNOSTIC_LIMIT).map((diagnostic) => ({
                script: library.get(diagnostic.assetId)?.name ?? diagnostic.assetId,
                severity: diagnostic.severity,
                line: diagnostic.line,
                column: diagnostic.column,
                message: diagnostic.message,
            })),
        };
    },
};
export const SCRIPTING_REFERENCE_TOOLS: readonly AssistantTool[] = [searchScriptingApi, readScriptTemplate, compileScripts];
