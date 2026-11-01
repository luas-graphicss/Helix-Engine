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
export function syncCodeEditorWithLibrary(session: EditorSession): void {
    const { code, library } = session;
    if (library.status !== 'ready')
        return;
    for (const tab of code.tabs) {
        const asset = library.get(tab.assetId);
        if (!asset) {
            code.close(tab.assetId);
            continue;
        }
        if (asset.name !== tab.document.name)
            code.syncName(tab.assetId, asset.name);
    }
    if (code.tabs.length === 0 && session.workspace === 'code' && code.openCount > 0) {
    }
}
export async function duplicateScriptAsset(session: EditorSession, asset: LibraryAsset): Promise<LibraryAsset | null> {
    const { library } = session;
    library.setBusy(`Duplicando ${asset.name}…`);
    try {
        const open = session.code.tab(asset.id);
        const source = open ? open.document : await loadScriptAsset(session, asset);
        const result = await ingestScriptDocument(library, { ...source, name: `Cópia de ${asset.name}`, entry: false, createdAt: Date.now() }, { forceNew: true });
        if (!result.added)
            return null;
        session.history.execute(new AddAssetCommand(library, result.added.snapshot, null));
        session.log.info(LOG_SOURCE, `${result.added.snapshot.asset.name} criado.`);
        return result.added.snapshot.asset;
    }
    catch (cause) {
        session.log.error(LOG_SOURCE, `Não foi possível duplicar ${asset.name}: ${describeError(cause)}`);
        return null;
    }
    finally {
        library.setBusy(null);
    }
}
export function exportScriptDocument(document: ScriptDocument): void {
    const file = scriptDocumentToFile(document);
    void downloadBlob(file, file.name, 'Script Helix');
}
export async function exportScriptAsset(session: EditorSession, asset: LibraryAsset): Promise<void> {
    const open = session.code.tab(asset.id);
    exportScriptDocument(open ? open.document : await loadScriptAsset(session, asset));
}
export async function importScripts(session: EditorSession): Promise<void> {
    const files = await pickFiles({ accept: SCRIPT_ACCEPT, multiple: true });
    const added = await addFilesToLibrary(session, files);
    const scripts = added.filter((asset) => asset.kind === 'script');
    const mismatched = scripts.filter((asset) => asset.details.kind === 'script' && !canUseLanguage(session, asset.details.language));
    if (mismatched.length > 0) {
        session.log.warn(LOG_SOURCE, `${mismatched.length === 1 ? `${mismatched[0].name} está` : `${mismatched.length} scripts estão`} fora da linguagem base do jogo; para usá-los, ${MIX_LANGUAGES_HINT}.`);
    }
    if (scripts[0])
        await openScriptAssetInEditor(session, scripts[0], { pin: true });
}
export function canCarryScript(entity: Entity): boolean {
    return entity.kind !== 'script' && !entity.csgBrush;
}
export function scriptActorsFor(session: EditorSession, assetId: string): Entity[] {
    const actors: Entity[] = [];
    session.scene.traverse((entity) => {
        if (entity.script?.assetId === assetId)
            actors.push(entity);
    });
    return actors;
}
export function allScriptActors(session: EditorSession): Entity[] {
    const actors: Entity[] = [];
    session.scene.traverse((entity) => {
        if (entity.kind === 'script')
            actors.push(entity);
    });
    return actors;
}
export function scriptActorName(session: EditorSession, assetId: string | null): string {
    return assetId ? (session.library.get(assetId)?.name ?? 'Script ausente') : 'Script';
}
export interface AttachScriptOptions {
    silent?: boolean;
    name?: string;
}
export function attachScriptToEntity(session: EditorSession, target: Entity, assetId: string | null, options: AttachScriptOptions = {}): Entity | null {
    if (!canCarryScript(target))
        return null;
    const name = options.name ?? scriptActorName(session, assetId);
    const entity = session.scene.createEntity({ name, kind: 'script', script: createScriptSettings({ assetId }), castShadows: false, receiveShadows: false }, null);
    const added = addEntity(session, entity, target, `Anexar script ${name} a ${target.name}`);
    if (!options.silent && assetId)
        session.log.info(LOG_SOURCE, `${added.name} passou a controlar ${target.name}.`);
    if (!assetId)
        session.log.warn(LOG_SOURCE, `${added.name} ainda não aponta para um script: escolha um na seção Script do inspetor.`);
    return added;
}
export function defaultScriptParent(session: EditorSession): Entity {
    const selected = session.selectedEntity;
    return selected && canCarryScript(selected) ? selected : session.scene.root;
}
export function addScriptActor(session: EditorSession, assetId: string | null = defaultScriptAssetId(session)): Entity | null {
    return attachScriptToEntity(session, defaultScriptParent(session), assetId);
}
export function defaultScriptAssetId(session: EditorSession): string | null {
    return session.code.activeId ?? session.library.byKind('script')[0]?.id ?? null;
}
export function placeScriptAssetAsActor(session: EditorSession, asset: LibraryAsset, target: Entity | null = null): Entity | null {
    if (asset.kind !== 'script')
        return null;
    if (target)
        return attachScriptToEntity(session, target, asset.id);
    return addScriptActor(session, asset.id);
}
export function setScriptAsset(session: EditorSession, entity: Entity, assetId: string | null): void {
    const current = entity.script;
    if (!current || current.assetId === assetId)
        return;
    const name = scriptActorName(session, assetId);
    session.history.execute(new SetValueCommand<ScriptSettings>(`Trocar o script de ${entity.name}`, (value) => {
        entity.script = { ...value };
        if (entity.kind === 'script')
            entity.name = value.assetId ? scriptActorName(session, value.assetId) : entity.name;
    }, { ...current }, { ...current, assetId }));
    session.log.info(LOG_SOURCE, `${entity.name} agora aponta para ${name}.`);
}
export function setScriptEnabled(session: EditorSession, entity: Entity, enabled: boolean): void {
    const current = entity.script;
    if (!current || current.enabled === enabled)
        return;
    session.history.execute(new SetValueCommand<ScriptSettings>(`${enabled ? 'Ativar' : 'Desativar'} ${entity.name}`, (value) => {
        entity.script = { ...value };
    }, { ...current }, { ...current, enabled }));
}
export function detachScript(session: EditorSession, entity: Entity): void {
    if (entity.kind !== 'script')
        return;
    deleteEntity(session, entity);
}
export function scriptAssetOf(session: EditorSession, entity: Entity): LibraryAsset | null {
    const assetId = entity.script?.assetId;
    if (!assetId)
        return null;
    const asset = session.library.get(assetId);
    return asset && asset.kind === 'script' ? asset : null;
}
export async function openScriptActor(session: EditorSession, entity: Entity, options: {
    presentation?: CodePresentation;
} = {}): Promise<boolean> {
    const asset = scriptAssetOf(session, entity);
    if (!asset) {
        session.log.warn(LOG_SOURCE, `${entity.name} não aponta para um script da biblioteca.`);
        return false;
    }
    return openScriptAssetInEditor(session, asset, { pin: true, presentation: options.presentation });
}
export function setBaseLanguage(session: EditorSession, language: ScriptLanguageId | null): void {
    const { scripting } = session.scene;
    if (scripting.baseLanguage === language)
        return;
    const before = scripting.baseLanguage;
    session.history.execute(new SetValueCommand<ScriptLanguageId | null>(language ? `Linguagem base: ${scriptLanguage(language).label}` : 'Remover a linguagem base', (value) => {
        scripting.baseLanguage = value;
        session.notify();
    }, before, language));
    if (language) {
        const existing = session.library.byKind('script').length;
        const outside = languageMismatches(session).length;
        session.log.info(LOG_SOURCE, `${scriptLanguage(language).label} é a linguagem base do jogo${outside > 0 ? `; ${outside} de ${existing} scripts ficam fora dela` : ''}.`);
    }
}
export function setEntryScript(session: EditorSession, assetId: string | null, options: {
    silent?: boolean;
} = {}): void {
    const { scripting } = session.scene;
    if (scripting.entryScriptId === assetId)
        return;
    const name = assetId ? scriptActorName(session, assetId) : null;
    session.history.execute(new SetValueCommand<string | null>(name ? `Script de entrada: ${name}` : 'Sem script de entrada', (value) => {
        scripting.entryScriptId = value;
        session.notify();
    }, scripting.entryScriptId, assetId));
    if (!options.silent)
        session.log.info(LOG_SOURCE, name ? `${name} é o script de entrada do jogo.` : 'O jogo começa pela ordem da hierarquia.');
}
export function setScriptRunContext(session: EditorSession, assetId: string, runContext: ScriptRunContext): void {
    session.code.updateDocument(assetId, { runContext });
}
export function setScriptLanguage(session: EditorSession, assetId: string, language: ScriptLanguageId): boolean {
    if (!canUseLanguage(session, language)) {
        session.log.warn(LOG_SOURCE, `Para usar ${scriptLanguage(language).label} neste jogo, ${MIX_LANGUAGES_HINT}.`);
        return false;
    }
    session.code.updateDocument(assetId, { language });
    return true;
}
export async function runScript(session: EditorSession, asset: LibraryAsset): Promise<void> {
    if (asset.kind !== 'script' || asset.details.kind !== 'script')
        return;
    const { code, scripts } = session;
    const tab = code.tab(asset.id);
    const saved = tab && code.isDirty(tab) ? await saveScriptTab(session, asset.id, { silent: true }) : null;
    const entry = saved ?? session.library.get(asset.id) ?? asset;
    if (entry.details.kind !== 'script')
        return;
    if (!isCompilableLanguage(entry.details.language)) {
        const language = scriptLanguage(entry.details.language);
        code.setCompileState('unavailable', `${entry.name}: ${SCRIPT_COMPILER_STATUS_LABEL[language.compiler].toLowerCase()} (${language.label}).`);
        session.log.warn(LOG_SOURCE, `${entry.name} é ${language.label}: ${SCRIPT_COMPILER_STATUS_LABEL[language.compiler].toLowerCase()}. Linguagens executáveis: ${formatLanguageLabels(EXECUTABLE_LANGUAGES)}.`);
        return;
    }
    if (session.playtest.state === 'playing' && scripts.running && scripts.mode === 'play') {
        await scripts.reload(entry);
        return;
    }
    await scripts.start('editor', { entry });
}
export function stopScript(session: EditorSession): void {
    const { scripts } = session;
    if (!scripts.running && !scripts.starting)
        return;
    if (scripts.mode === 'play') {
        session.log.warn(LOG_SOURCE, 'Os scripts do jogo param junto com o jogo: use Parar na barra de playtest.');
        return;
    }
    scripts.stop();
}
export async function runActiveScript(session: EditorSession): Promise<void> {
    const active = session.code.activeTab;
    if (!active) {
        session.log.warn(LOG_SOURCE, 'Nenhum script aberto para executar.');
        return;
    }
    const asset = session.library.get(active.assetId);
    if (asset)
        await runScript(session, asset);
}
export async function compileProject(session: EditorSession): Promise<void> {
    const { code, scripts } = session;
    await saveAllScripts(session, { silent: true });
    const assets = session.library.byKind('script');
    const { scripting } = session.scene;
    if (assets.length === 0) {
        code.setCompileState('unavailable', 'Nenhum script no projeto.');
        session.log.info(LOG_SOURCE, 'Nada para compilar: o projeto ainda não tem scripts.');
        return;
    }
    const mismatches = languageMismatches(session);
    if (mismatches.length > 0) {
        session.log.warn(LOG_SOURCE, `${mismatches.length} ${mismatches.length === 1 ? 'script foge' : 'scripts fogem'} da linguagem base (${scripting.baseLanguage ? scriptLanguage(scripting.baseLanguage).label : '—'}): ${mismatches.map((asset) => asset.name).join(', ')}.`);
    }
    code.setCompileState('compiling', `Compilando ${assets.length} ${assets.length === 1 ? 'script' : 'scripts'}…`);
    warmLanguageEngines(assets.flatMap((asset) => (asset.details.kind === 'script' ? [asset.details.language] : [])));
    const { inputs, skipped } = await collectScriptSources(session);
    if (inputs.length === 0) {
        code.setCompileState('unavailable', `${skipped.length} ${skipped.length === 1 ? 'script' : 'scripts'} sem compilador.`);
        session.log.warn(LOG_SOURCE, `Nenhum script compilável: ${skipped.map((asset) => `${asset.name} (${asset.details.kind === 'script' ? scriptLanguage(asset.details.language).label : '?'})`).join(', ')}. Por enquanto compilam ${formatLanguageLabels(Array.from(COMPILABLE_LANGUAGES))}.`);
        return;
    }
    try {
        const result = await scripts.compiler.compile(inputs);
        publishCompileResult(session, result, { source: LOG_SOURCE, skipped });
    }
    catch (cause) {
        code.setCompileState('failed', 'Compilador indisponível nesta aba; veja o console.');
        session.log.error(LOG_SOURCE, `O compilador não pôde ser carregado: ${describeError(cause)}`);
    }
}
export function runCommand(session: EditorSession, text: string): void {
    const trimmed = text.trim();
    if (!trimmed)
        return;
    const { code } = session;
    const language = languageForNewScript(session);
    code.recordCommand(trimmed, language);
    if (trimmed === 'clear' || trimmed === 'cls') {
        session.log.clear();
        return;
    }
    if (trimmed === 'help' || trimmed === '?') {
        session.log.info(COMMAND_SOURCE, 'Comandos da engine: clear (limpa o console), scripts (lista os scripts), lang (linguagem base). Código na linguagem base roda quando o interpretador chegar.');
        return;
    }
    if (trimmed === 'scripts') {
        const scripts = session.library.byKind('script');
        session.log.info(COMMAND_SOURCE, scripts.length === 0 ? 'Nenhum script na biblioteca.' : scripts.map((asset) => `${asset.name} (${asset.details.kind === 'script' ? scriptLanguage(asset.details.language).tag : '?'})`).join(' · '));
        return;
    }
    if (trimmed === 'lang') {
        session.log.info(COMMAND_SOURCE, language ? `Linguagem base: ${scriptLanguage(language).label}${mixLanguagesEnabled() ? ' (mesclagem de linguagens ligada)' : ''}.` : 'Sem linguagem base definida.');
        return;
    }
    session.log.info(COMMAND_SOURCE, `> ${trimmed}`);
    session.log.warn(COMMAND_SOURCE, language ? `A barra de comando ainda não executa ${scriptLanguage(language).label} avulso; o comando ficou no histórico. Para rodar código agora, use Executar num script.` : 'Defina a linguagem base do jogo para a barra de comando saber em que linguagem interpretar.');
}
export function codeTabUrl(projectId: string, assetId: string | null = null): string {
    const base = `/editor/${encodeURIComponent(projectId)}/code`;
    return assetId ? `${base}?script=${encodeURIComponent(assetId)}` : base;
}
export function openCodeInBrowserTab(session: EditorSession, assetId: string | null = null): void {
    if (typeof window === 'undefined')
        return;
    const name = `helix-code-${session.project.id}`;
    const existing = window.open('', name);
    if (!existing) {
        session.log.warn(LOG_SOURCE, 'O navegador bloqueou a nova aba; permita pop-ups para este site ou use a janela flutuante.');
        return;
    }
    let blank = true;
    try {
        blank = existing.location.href === 'about:blank';
    }
    catch {
        blank = false;
    }
    if (blank)
        existing.location.href = codeTabUrl(session.project.id, assetId);
    else if (assetId)
        scriptSync.announceOpen(session, assetId);
    existing.focus();
}
type ScriptSyncMessage = {
    type: 'script-saved';
    assetId: string;
} | {
    type: 'open-script';
    assetId: string;
};
class ScriptSyncChannel {
    private channel: BroadcastChannel | null = null;
    private channelProject: string | null = null;
    private readonly savedHandlers = new Set<(assetId: string) => void>();
    private readonly openHandlers = new Set<(assetId: string) => void>();
    private ensure(projectId: string): BroadcastChannel | null {
        if (typeof BroadcastChannel === 'undefined')
            return null;
        if (this.channel && this.channelProject === projectId)
            return this.channel;
        this.channel?.close();
        this.channel = new BroadcastChannel(`helix-scripts-${projectId}`);
        this.channelProject = projectId;
        this.channel.onmessage = (event: MessageEvent<Partial<ScriptSyncMessage>>) => {
            const { data } = event;
            if (!data || typeof data.assetId !== 'string')
                return;
            const handlers = data.type === 'script-saved' ? this.savedHandlers : data.type === 'open-script' ? this.openHandlers : null;
            if (handlers)
                for (const handler of handlers)
                    handler(data.assetId);
        };
        return this.channel;
    }
    announce(session: EditorSession, assetId: string): void {
        this.ensure(session.project.id)?.postMessage({ type: 'script-saved', assetId } satisfies ScriptSyncMessage);
    }
    announceOpen(session: EditorSession, assetId: string): void {
        this.ensure(session.project.id)?.postMessage({ type: 'open-script', assetId } satisfies ScriptSyncMessage);
    }
    listen(session: EditorSession, handler: (assetId: string) => void): () => void {
        this.ensure(session.project.id);
        this.savedHandlers.add(handler);
        return () => this.savedHandlers.delete(handler);
    }
    listenOpen(session: EditorSession, handler: (assetId: string) => void): () => void {
        this.ensure(session.project.id);
        this.openHandlers.add(handler);
        return () => this.openHandlers.delete(handler);
    }
}
export const scriptSync = new ScriptSyncChannel();
export async function refreshScriptFromStorage(session: EditorSession, assetId: string): Promise<void> {
    const { library, code } = session;
    const refreshed = await library.reload(assetId);
    if (!refreshed)
        return;
    forgetScriptDocument(assetId);
    if (code.tab(assetId)) {
        try {
            code.syncSaved(assetId, await loadScriptAsset(session, refreshed));
        }
        catch (cause) {
            session.log.warn(LOG_SOURCE, `${refreshed.name} mudou noutra aba, mas não pôde ser relido: ${describeError(cause)}`);
        }
    }
}
