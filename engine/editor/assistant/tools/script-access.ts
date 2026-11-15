import type { LibraryAsset } from '@/engine/assets/library/asset-types';
import { loadScriptAsset } from '@/engine/editor/operations/script-operations';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import type { ScriptDocument } from '@/engine/scripting/script-document';
import { isScriptLanguageId, type ScriptLanguageId } from '@/engine/scripting/script-languages';
import { ToolFailure } from './tool-failure';
import { text } from './tool-parameters';
export const SCRIPT_PARAMETER = text('Script id or exact script name.');
export const LANGUAGE_PARAMETER = text('Script language id such as luau, lua, javascript, typescript or python. Defaults to the base language of the game.');
export function requireScript(session: EditorSession, reference: string): LibraryAsset {
    const scripts = session.library.byKind('script');
    const wanted = reference.trim().toLowerCase();
    const match = scripts.find((asset) => asset.id === reference) ?? scripts.find((asset) => asset.name.toLowerCase() === wanted);
    if (!match)
        throw new ToolFailure(`No script "${reference}". Call list_scripts for ids and names.`);
    return match;
}
export async function currentScriptDocument(session: EditorSession, asset: LibraryAsset): Promise<ScriptDocument> {
    return session.code.tab(asset.id)?.document ?? (await loadScriptAsset(session, asset));
}
export function resolveScriptLanguage(session: EditorSession, requested: string | undefined): ScriptLanguageId {
    const language = requested ?? session.scene.scripting.baseLanguage;
    if (!language)
        throw new ToolFailure('This game has no scripting language yet. Ask the user which language to use and pass it as "language".');
    if (!isScriptLanguageId(language))
        throw new ToolFailure(`Unknown script language "${language}".`);
    return language;
}
