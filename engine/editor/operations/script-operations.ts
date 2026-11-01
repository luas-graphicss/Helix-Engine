import { ingestScriptDocument, ingestScriptReplacement } from '@/engine/assets/library/asset-ingest';
import type { LibraryAsset } from '@/engine/assets/library/asset-types';
import type { Entity } from '@/engine/core/scene/entity';
import { AddAssetCommand } from '@/engine/editor/commands/asset-library-commands';
import { SetValueCommand } from '@/engine/editor/commands/set-value-command';
import { editorDialogs } from '@/engine/editor/dialogs/editor-dialogs';
import { downloadBlob } from '@/engine/editor/files/file-download';
import { pickFiles } from '@/engine/editor/files/file-picker';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import type { CodePresentation } from '@/engine/editor/code/code-editor';
import { collectScriptSources, publishCompileResult } from '@/engine/scripting/compiler/project-sources';
import { COMPILABLE_LANGUAGES, EXECUTABLE_LANGUAGES, isCompilableLanguage } from '@/engine/scripting/compiler/script-compiler';
import { warmLanguageEngines } from '@/engine/scripting/languages/language-engine';
import { countScriptLines, type ScriptDocument, type ScriptRunContext } from '@/engine/scripting/script-document';
import { readScriptDocument, scriptDocumentToFile } from '@/engine/scripting/script-io';
import { formatLanguageLabels, isAssetLanguage, SCRIPT_ACCEPT, SCRIPT_COMPILER_STATUS_LABEL, scriptLanguage, type ScriptLanguageId } from '@/engine/scripting/script-languages';
import { createScriptSettings, type ScriptSettings } from '@/engine/scripting/script-settings';
import { buildScriptDocument, findScriptTemplate, type ScriptTemplateId } from '@/engine/scripting/script-templates';
import { betaFeatures, MIX_LANGUAGES_FEATURE } from '@/engine/settings/beta-features';
import { engineSettings } from '@/engine/settings/engine-settings-store';
import { addFilesToLibrary } from './asset-library-operations';
import { addEntity, deleteEntity } from './entity-operations';
const LOG_SOURCE = 'Código';
const COMMAND_SOURCE = 'Comando';
function describeError(cause: unknown): string {
    return cause instanceof Error ? cause.message : String(cause);
}
const documentCache = new Map<string, {
    hash: string;
    document: ScriptDocument;
}>();
function scriptDetailsOf(asset: LibraryAsset) {
    return asset.details.kind === 'script' ? asset.details : null;
}
export async function loadScriptAsset(session: EditorSession, asset: LibraryAsset): Promise<ScriptDocument> {
    if (asset.kind !== 'script')
        throw new Error(`${asset.name} não é um script.`);
    const details = scriptDetailsOf(asset);
    const cached = documentCache.get(asset.id);
    if (cached && cached.hash === asset.contentHash && details && cached.document.runContext === details.runContext && cached.document.entry === details.entry) {
        return cached.document.name === asset.name ? cached.document : { ...cached.document, name: asset.name };
    }
    const file = await session.library.primaryFile(asset);
    const document = { ...(await readScriptDocument(file, details ?? {})), name: asset.name };
    documentCache.set(asset.id, { hash: asset.contentHash, document });
    return document;
}
export function forgetScriptDocument(assetId: string): void {
    documentCache.delete(assetId);
}
export function languageForNewScript(session: EditorSession): ScriptLanguageId | null {
    return session.scene.scripting.baseLanguage;
}
export function mixLanguagesEnabled(): boolean {
    return betaFeatures.isEnabled(MIX_LANGUAGES_FEATURE);
}
const MIX_LANGUAGES_HINT = 'ative Mesclagem de linguagens em Helix ▸ Funcionalidades beta';
export function canUseLanguage(session: EditorSession, language: ScriptLanguageId): boolean {
    const { scripting } = session.scene;
    return mixLanguagesEnabled() || scripting.baseLanguage === null || scripting.baseLanguage === language || isAssetLanguage(language);
}
export function scriptsOutsideLanguage(session: EditorSession, language: ScriptLanguageId): LibraryAsset[] {
    if (mixLanguagesEnabled())
        return [];
    return session.library.byKind('script').filter((asset) => asset.details.kind === 'script' && asset.details.language !== language && !isAssetLanguage(asset.details.language));
}
export function languageMismatches(session: EditorSession): LibraryAsset[] {
    const { baseLanguage } = session.scene.scripting;
    return baseLanguage ? scriptsOutsideLanguage(session, baseLanguage) : [];
}
export interface BaseLanguageChangePlan {
    readonly from: ScriptLanguageId | null;
    readonly to: ScriptLanguageId;
    readonly affected: readonly LibraryAsset[];
}
export function planBaseLanguageChange(session: EditorSession, to: ScriptLanguageId): BaseLanguageChangePlan {
    return { from: session.scene.scripting.baseLanguage, to, affected: scriptsOutsideLanguage(session, to) };
}
export function revealCodeEditor(session: EditorSession, presentation: CodePresentation = session.code.presentation): void {
    const { code } = session;
    if (code.standalone)
        return;
    switch (presentation) {
        case 'workspace':
            code.setPresentation('workspace');
            session.setWorkspace('code');
            break;
        case 'window':
            code.openWindow();
            break;
        case 'tab':
            code.setPresentation('tab');
            openCodeInBrowserTab(session, code.activeId);
            break;
    }
}
export async function openScriptAssetInEditor(session: EditorSession, asset: LibraryAsset, options: {
    pin?: boolean;
    line?: number;
    presentation?: CodePresentation;
} = {}): Promise<boolean> {
    if (asset.kind !== 'script')
        return false;
    const { code } = session;
    const existing = code.tab(asset.id);
    if (existing) {
        code.open(existing.document, asset.id, { pin: options.pin, line: options.line });
        revealCodeEditor(session, options.presentation);
        return true;
    }
    session.library.setBusy(`Abrindo ${asset.name}…`);
    try {
        const document = await loadScriptAsset(session, asset);
        code.open(document, asset.id, { pin: options.pin, line: options.line });
        revealCodeEditor(session, options.presentation);
        return true;
    }
    catch (cause) {
        session.log.error(LOG_SOURCE, `Não foi possível abrir ${asset.name}: ${describeError(cause)}`);
        return false;
    }
    finally {
        session.library.setBusy(null);
    }
}
export interface CreateScriptOptions {
    templateId?: ScriptTemplateId;
    language?: ScriptLanguageId;
    name?: string;
    attachTo?: Entity | null;
    open?: boolean;
    presentation?: CodePresentation;
}
export async function createScript(session: EditorSession, options: CreateScriptOptions = {}): Promise<LibraryAsset | null> {
    const { library, code } = session;
    const language = options.language ?? languageForNewScript(session);
    if (!language) {
        session.log.warn(LOG_SOURCE, 'Escolha a linguagem base do jogo antes de criar o primeiro script.');
        editorDialogs.open('baseLanguage');
        return null;
    }
    if (!canUseLanguage(session, language)) {
        const base = session.scene.scripting.baseLanguage;
        session.log.warn(LOG_SOURCE, `Este jogo é em ${base ? scriptLanguage(base).label : 'uma só linguagem'}: para criar scripts em ${scriptLanguage(language).label}, ${MIX_LANGUAGES_HINT}.`);
        return null;
    }
    const templateId = options.templateId ?? 'blank';
    const template = findScriptTemplate(templateId);
    const document = buildScriptDocument(language, templateId, options.name);
    library.setBusy(`Criando ${document.name}…`);
    try {
        const result = await ingestScriptDocument(library, document, { forceNew: true });
        if (!result.added)
            return null;
        session.history.execute(new AddAssetCommand(library, result.added.snapshot, null));
        const asset = result.added.snapshot.asset;
        const named = { ...document, name: asset.name };
        documentCache.set(asset.id, { hash: asset.contentHash, document: named });
        scriptSync.announce(session, asset.id);
        if (named.entry)
            setEntryScript(session, asset.id, { silent: true });
        const target = options.attachTo === undefined && !isAssetLanguage(language) ? defaultScriptParent(session) : options.attachTo;
        if (target)
            attachScriptToEntity(session, target, asset.id, { silent: true });
        if (options.open ?? engineSettings.get('code.openOnCreate')) {
            code.open(named, asset.id, { pin: true });
            revealCodeEditor(session, options.presentation);
        }
        session.log.info(LOG_SOURCE, `${asset.name} criado em ${scriptLanguage(language).label} (${template.label})${target ? `, anexado a ${target.name}` : ''}.`);
        return asset;
    }
    catch (cause) {
        session.log.error(LOG_SOURCE, `Não foi possível criar o script: ${describeError(cause)}`);
        return null;
    }
    finally {
        library.setBusy(null);
    }
}
export async function saveScriptTab(session: EditorSession, assetId: string, options: {
    silent?: boolean;
} = {}): Promise<LibraryAsset | null> {
    const { code, library } = session;
    const tab = code.tab(assetId);
    if (!tab)
        return null;
    const { document } = tab;
    const existing = library.get(assetId);
    if (existing && existing.kind === 'script') {
        try {
            const after = await ingestScriptReplacement(library, existing, document);
            if (!after) {
                code.markSaved(assetId);
                return existing;
            }
            library.remove(existing.id);
            library.add(after);
            documentCache.set(existing.id, { hash: after.asset.contentHash, document: { ...document, name: after.asset.name } });
            code.markSaved(assetId, { ...document, name: after.asset.name });
            scriptSync.announce(session, existing.id);
            if (!options.silent)
                session.log.info(LOG_SOURCE, `${after.asset.name} salvo (${countScriptLines(document.source)} linhas).`);
            hotReloadIfRunning(session, after.asset);
            return after.asset;
        }
        catch (cause) {
            session.log.error(LOG_SOURCE, `Não foi possível salvar ${document.name}: ${describeError(cause)}`);
            return null;
        }
    }
    try {
        const result = await ingestScriptDocument(library, document, { forceNew: true });
        if (!result.added)
            return null;
        session.history.execute(new AddAssetCommand(library, result.added.snapshot, null));
        const asset = result.added.snapshot.asset;
        documentCache.set(asset.id, { hash: asset.contentHash, document: { ...document, name: asset.name } });
        code.close(assetId);
        code.open({ ...document, name: asset.name }, asset.id, { pin: true });
        if (!options.silent)
            session.log.info(LOG_SOURCE, `${asset.name} guardado na biblioteca.`);
        return asset;
    }
    catch (cause) {
        session.log.error(LOG_SOURCE, `Não foi possível guardar ${document.name}: ${describeError(cause)}`);
        return null;
    }
}
function hotReloadIfRunning(session: EditorSession, asset: LibraryAsset): void {
    const { scripts } = session;
    if (!scripts.running || scripts.mode !== 'play' || asset.details.kind !== 'script' || !isCompilableLanguage(asset.details.language))
        return;
    void scripts.reload(asset);
}
export async function saveActiveScript(session: EditorSession): Promise<LibraryAsset | null> {
    const active = session.code.activeTab;
    return active ? saveScriptTab(session, active.assetId) : null;
}
export async function saveAllScripts(session: EditorSession, options: {
    silent?: boolean;
} = {}): Promise<number> {
    const dirty = session.code.dirtyTabs;
    let saved = 0;
    for (const tab of dirty)
        if (await saveScriptTab(session, tab.assetId, { silent: true }))
            saved++;
    if (saved > 0 && !options.silent)
        session.log.info(LOG_SOURCE, `${saved} ${saved === 1 ? 'script salvo' : 'scripts salvos'}.`);
    return saved;
}
export async function closeScriptTab(session: EditorSession, assetId: string): Promise<void> {
    const { code } = session;
    const tab = code.tab(assetId);
    if (!tab)
        return;
    if (code.isDirty(tab))
        await saveScriptTab(session, assetId, { silent: true });
    code.close(assetId);
}
export async function closeAllScriptTabs(session: EditorSession): Promise<void> {
    await saveAllScripts(session, { silent: true });
    session.code.closeAll();
}
export async function closeCodeWorkspace(session: EditorSession): Promise<void> {
    await saveAllScripts(session, { silent: true });
    if (session.workspace === 'code')
        session.setWorkspace('scene');
    session.code.closeWindow();
}
