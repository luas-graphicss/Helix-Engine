import type { LibraryAsset } from '@/engine/assets/library/asset-types';
import { addExtensionScript } from '@/engine/editor/extensions/host/extension-scripts';
import { createScript } from '@/engine/editor/operations/script-operations';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { indentUnit, type ScriptLanguageId } from '@/engine/scripting/script-languages';
import type { ExtensionTemplate } from './extension-templates';
function extensionLanguage(session: EditorSession): ScriptLanguageId {
    return session.scene.scripting.baseLanguage === 'javascript' ? 'javascript' : 'typescript';
}
export async function createExtension(session: EditorSession, template: ExtensionTemplate): Promise<LibraryAsset | null> {
    const language = extensionLanguage(session);
    const asset = await createScript(session, { language, name: template.defaultName, source: template.source(indentUnit(language)), runContext: 'shared', attachTo: null, open: true });
    if (asset)
        addExtensionScript(session, asset);
    return asset;
}
