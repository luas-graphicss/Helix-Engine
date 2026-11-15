import type { LibraryAsset } from '@/engine/assets/library/asset-types';
import { clamp } from '@/engine/core/math/scalar';
import type { Entity } from '@/engine/core/scene/entity';
import { removeLibraryAsset } from '@/engine/editor/operations/asset-library-operations';
import { attachScriptToEntity, createScript, scriptActorsFor, setBaseLanguage, writeScriptSource } from '@/engine/editor/operations/script-operations';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { countScriptLines, SCRIPT_RUN_CONTEXTS } from '@/engine/scripting/script-document';
import { baseLanguageCandidates, isAssetLanguage, type ScriptLanguageId } from '@/engine/scripting/script-languages';
import { SCRIPT_TEMPLATES } from '@/engine/scripting/script-templates';
import type { AssistantTool } from './assistant-tool';
import { requireEntity } from './entity-access';
import { currentScriptDocument, LANGUAGE_PARAMETER, requireScript, resolveScriptLanguage, SCRIPT_PARAMETER } from './script-access';
import { ToolFailure } from './tool-failure';
import type { ToolInput } from './tool-input';
import { choice, flag, integer, parameters, text } from './tool-parameters';
const SEARCH_MATCH_LIMIT = 80;
const TEMPLATE_IDS = SCRIPT_TEMPLATES.map((template) => template.id);
function describeScript(session: EditorSession, asset: LibraryAsset): object {
    const details = asset.details.kind === 'script' ? asset.details : null;
    return {
        id: asset.id,
        name: asset.name,
        language: details?.language ?? null,
        lines: details?.lines ?? null,
        runContext: details?.runContext ?? null,
        entry: details?.entry ?? false,
        attachedTo: scriptActorsFor(session, asset.id).map((actor) => actor.parent?.name ?? actor.name),
    };
}
function adoptBaseLanguage(session: EditorSession, language: ScriptLanguageId): void {
    if (session.scene.scripting.baseLanguage !== null)
        return;
    if (baseLanguageCandidates().some((candidate) => candidate.id === language))
        setBaseLanguage(session, language);
}
function resolveAttachTarget(session: EditorSession, input: ToolInput, language: ScriptLanguageId): Entity | null {
    const attach = input.optionalFlag('attach') ?? !isAssetLanguage(language);
    if (!attach)
        return null;
    const targetId = input.optionalInteger('attachToEntityId');
    return targetId === undefined ? session.scene.root : requireEntity(session, targetId);
}
function countOccurrences(source: string, fragment: string): number {
    return source.split(fragment).length - 1;
}
const listScripts: AssistantTool = {
    name: 'list_scripts',
    title: 'Listar scripts',
    access: 'read',
    description: 'Lists every script of the game with id, name, language, line count, run context and the entities it is attached to.',
    parameters: parameters({}),
    run(session) {
        return { scripts: session.library.byKind('script').map((asset) => describeScript(session, asset)) };
    },
};
const readScript: AssistantTool = {
    name: 'read_script',
    title: 'Ler script',
    access: 'read',
    description: 'Returns the source of a script, including unsaved edits open in the code editor. Pass a line range for long scripts.',
    parameters: parameters({
        script: SCRIPT_PARAMETER,
        startLine: integer('First line to return, starting at 1.'),
        endLine: integer('Last line to return, inclusive.'),
    }, ['script']),
    async run(session, input) {
        const asset = requireScript(session, input.text('script'));
        const document = await currentScriptDocument(session, asset);
        const lines = document.source.split('\n');
        const startLine = clamp(input.optionalInteger('startLine') ?? 1, 1, lines.length);
        const endLine = clamp(input.optionalInteger('endLine') ?? lines.length, startLine, lines.length);
        return {
            id: asset.id,
            name: asset.name,
            language: document.language,
            runContext: document.runContext,
            totalLines: lines.length,
            startLine,
            endLine,
            source: lines.slice(startLine - 1, endLine).join('\n'),
        };
    },
};
const searchScripts: AssistantTool = {
    name: 'search_scripts',
    title: 'Buscar nos scripts',
    access: 'read',
    description: 'Searches plain text across all scripts. Each match reads `ScriptName:line: text`.',
    parameters: parameters({ query: text('Text to find.'), caseSensitive: flag('Match upper and lower case exactly. Default false.') }, ['query']),
    async run(session, input) {
        const query = input.text('query');
        if (query === '')
            throw new ToolFailure('"query" cannot be empty.');
        const caseSensitive = input.optionalFlag('caseSensitive') ?? false;
        const needle = caseSensitive ? query : query.toLowerCase();
        const matches: string[] = [];
        for (const asset of session.library.byKind('script')) {
            const document = await currentScriptDocument(session, asset);
            for (const [index, line] of document.source.split('\n').entries()) {
                if (!(caseSensitive ? line : line.toLowerCase()).includes(needle))
                    continue;
                matches.push(`${asset.name}:${index + 1}: ${line.trim()}`);
                if (matches.length >= SEARCH_MATCH_LIMIT)
                    return `${matches.join('\n')}\nStopped at ${SEARCH_MATCH_LIMIT} matches. Refine the query.`;
            }
        }
        return matches.length === 0 ? `No script contains "${query}".` : matches.join('\n');
    },
};
const createScriptTool: AssistantTool = {
    name: 'create_script',
    title: 'Criar script',
    access: 'code',
    description: 'Creates a script in the game library. Call read_script_template and search_scripting_api first so the source follows the Helix API of that language. By default the script is attached to the scene root so it runs when the game starts.',
    parameters: parameters({
        name: text('Script name without extension.'),
        source: text('Full source code. Omit to start from the template.'),
        language: LANGUAGE_PARAMETER,
        template: choice('Starting template when no source is given. Default blank.', TEMPLATE_IDS),
        runContext: choice('Where the script runs. shared lets the engine decide, client is per player, server holds authority.', SCRIPT_RUN_CONTEXTS),
        attach: flag('Attach the script to an entity so it runs. Pass false for modules that are only imported.'),
        attachToEntityId: integer('Entity the script controls. Omit to attach to the scene root.'),
    }, ['name']),
    async run(session, input) {
        const language = resolveScriptLanguage(session, input.optionalText('language'));
        const attachTo = resolveAttachTarget(session, input, language);
        adoptBaseLanguage(session, language);
        const asset = await createScript(session, {
            language,
            name: input.text('name'),
            source: input.optionalText('source'),
            templateId: input.optionalChoice('template', TEMPLATE_IDS),
            runContext: input.optionalChoice('runContext', SCRIPT_RUN_CONTEXTS),
            attachTo,
            open: false,
        });
        if (!asset)
            throw new ToolFailure('The script could not be created. Call read_console for the reason.');
        return describeScript(session, asset);
    },
};
const writeScript: AssistantTool = {
    name: 'write_script',
    title: 'Reescrever script',
    access: 'code',
    description: 'Replaces the whole source of a script and saves it. Prefer edit_script for small changes.',
    parameters: parameters({ script: SCRIPT_PARAMETER, source: text('New full source code.') }, ['script', 'source']),
    async run(session, input) {
        const source = input.text('source');
        const stored = await writeScriptSource(session, requireScript(session, input.text('script')), source);
        return `${stored.name} saved with ${countScriptLines(source)} lines.`;
    },
};
const editScript: AssistantTool = {
    name: 'edit_script',
    title: 'Editar script',
    access: 'code',
    description: 'Replaces an exact fragment of a script and saves it. The fragment must match the source character by character, including indentation.',
    parameters: parameters({
        script: SCRIPT_PARAMETER,
        find: text('Exact fragment to replace. Include enough surrounding lines to make it unique.'),
        replace: text('Replacement text. Empty removes the fragment.'),
        replaceAll: flag('Replace every occurrence instead of requiring a unique match.'),
    }, ['script', 'find', 'replace']),
    async run(session, input) {
        const asset = requireScript(session, input.text('script'));
        const fragment = input.text('find');
        const replacement = input.text('replace');
        if (fragment === '')
            throw new ToolFailure('"find" cannot be empty.');
        const { source } = await currentScriptDocument(session, asset);
        const occurrences = countOccurrences(source, fragment);
        if (occurrences === 0)
            throw new ToolFailure('The "find" fragment does not occur in the script. Read the script again and copy the exact text.');
        const replaceAll = input.optionalFlag('replaceAll') ?? false;
        if (occurrences > 1 && !replaceAll)
            throw new ToolFailure(`The "find" fragment occurs ${occurrences} times. Add surrounding lines to make it unique or set replaceAll.`);
        const edited = replaceAll ? source.split(fragment).join(replacement) : source.replace(fragment, () => replacement);
        const stored = await writeScriptSource(session, asset, edited);
        return `${stored.name} saved with ${occurrences} ${occurrences === 1 ? 'replacement' : 'replacements'}, ${countScriptLines(edited)} lines.`;
    },
};
const attachScript: AssistantTool = {
    name: 'attach_script',
    title: 'Anexar script',
    access: 'code',
    description: 'Attaches an existing script to an entity so the script controls it when the game runs.',
    parameters: parameters({ script: SCRIPT_PARAMETER, entityId: integer('Entity that the script controls.') }, ['script', 'entityId']),
    run(session, input) {
        const asset = requireScript(session, input.text('script'));
        const target = requireEntity(session, input.integer('entityId'));
        if (!attachScriptToEntity(session, target, asset.id, { silent: true }))
            throw new ToolFailure(`${target.name} cannot carry scripts.`);
        return `${asset.name} now controls ${target.name}.`;
    },
};
const deleteScript: AssistantTool = {
    name: 'delete_script',
    title: 'Excluir script',
    access: 'destructive',
    description: 'Removes a script from the game library.',
    parameters: parameters({ script: SCRIPT_PARAMETER }, ['script']),
    async run(session, input) {
        const asset = requireScript(session, input.text('script'));
        await removeLibraryAsset(session, asset);
        if (session.library.get(asset.id))
            throw new ToolFailure(`${asset.name} could not be removed. Call read_console for the reason.`);
        return `${asset.name} removed from the library.`;
    },
};
export const SCRIPT_TOOLS: readonly AssistantTool[] = [listScripts, readScript, searchScripts, createScriptTool, writeScript, editScript, attachScript, deleteScript];
