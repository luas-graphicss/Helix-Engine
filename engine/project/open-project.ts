import { LEGACY_EDITOR_DATABASE_NAME, ProjectDatabase } from '@/engine/core/storage/project-database';
import { AssetLibrary } from '@/engine/assets/library/asset-library';
import { MaterialLibrary } from '@/engine/materials/material-library';
import { EditorSession } from '@/engine/editor/session/editor-session';
import { usesTypeScriptCompiler } from '@/engine/scripting/compiler/script-compiler';
import { applyNewScenePhysicsDefaults, applySessionOpenDefaults } from '@/engine/settings/apply/session-settings';
import { bindPendingTerrainLayers } from './bind-terrain-layers';
import { getProjectRegistry } from './project-registry';
import type { ProjectRecord } from './project-record';
import { SceneStore } from './scene-store';
import { deserializeScene, type PendingTerrainLayer } from './scene-document/deserialize-scene';
import type { SceneDocument } from './scene-document/scene-document';
import { getProjectTemplate } from './templates/project-templates';
export interface OpenProjectProgress {
    label: string;
    fraction: number;
}
export const OPEN_PROJECT_SESSION_FRACTION = 0.8;
function errorMessage(cause: unknown): string {
    return cause instanceof Error ? cause.message : String(cause);
}
export interface OpenProjectOptions {
    readonly persist?: boolean;
    readonly warmCompiler?: boolean;
}
export async function openProject(id: string, onProgress: (progress: OpenProjectProgress) => void = () => { }, { persist = true, warmCompiler = true }: OpenProjectOptions = {}): Promise<EditorSession> {
    const registry = getProjectRegistry();
    onProgress({ label: 'Abrindo o registro de projetos', fraction: 0.05 });
    await registry.load();
    if (registry.status === 'unavailable')
        throw new Error(registry.error ?? 'O registro de projetos não está disponível.');
    const record = registry.get(id);
    if (!record)
        throw new Error('Este projeto não está no registro deste navegador.');
    const database = new ProjectDatabase(record.databaseName);
    let session: EditorSession | null = null;
    const notify = () => session?.notify('scene');
    const notifyAssets = () => session?.notify('assets');
    onProgress({ label: 'Carregando materiais', fraction: 0.15 });
    const materials = new MaterialLibrary(notify, database);
    await materials.load();
    onProgress({ label: 'Carregando biblioteca de ativos', fraction: 0.3 });
    const library = new AssetLibrary(notifyAssets, database);
    await library.load();
    onProgress({ label: 'Lendo a cena', fraction: 0.5 });
    const scenes = new SceneStore(database);
    const loaded = await loadSceneDocument(scenes);
    const template = getProjectTemplate(record.template);
    const warnings: string[] = [...loaded.warnings];
    let pendingTerrainLayers: PendingTerrainLayer[] = [];
    let scene;
    if (loaded.document) {
        onProgress({ label: 'Reconstruindo o mundo', fraction: 0.65 });
        const result = await deserializeScene(loaded.document, { materials, onRigReady: notify });
        scene = result.scene;
        pendingTerrainLayers = result.pendingTerrainLayers;
        warnings.push(...result.warnings);
    }
    else {
        onProgress({ label: `Criando a cena do template ${template.name}`, fraction: 0.65 });
        scene = template.createScene({ onRigReady: notify });
        applyNewScenePhysicsDefaults(scene);
    }
    onProgress({ label: 'Iniciando o editor', fraction: OPEN_PROJECT_SESSION_FRACTION });
    session = new EditorSession({ scene, project: { id, registry, database, scenes, materials, library } });
    applySessionOpenDefaults(session);
    logLibraries(session, record);
    if (loaded.document) {
        bindPendingTerrainLayers(session, pendingTerrainLayers, warnings);
        session.log.info('Projeto', `${record.name} aberto (${scene.root.name}, ${session.countEntities()} atores).`);
    }
    else {
        template.prepare?.(session);
        session.log.info('Projeto', `${record.name} criado a partir do template ${template.name}.`);
        session.autosave.markDirty();
    }
    for (const warning of warnings)
        session.log.warn('Projeto', warning);
    if (persist) {
        await registry.touchOpened(id);
        session.autosave.start();
        if (!loaded.document)
            await session.autosave.saveNow();
    }
    if (warmCompiler)
        warmTypeScript(session);
    return session;
}
function warmTypeScript(session: EditorSession): void {
    const needsTypeScript = session.library.byKind('script').some((asset) => asset.details.kind === 'script' && usesTypeScriptCompiler(asset.details.language));
    if (!needsTypeScript)
        return;
    const start = () => session.scripts.compiler.warmUp();
    if (typeof requestIdleCallback === 'function') {
        const handle = requestIdleCallback(start, { timeout: WARM_TYPESCRIPT_TIMEOUT_MS });
        session.onDispose(() => cancelIdleCallback(handle));
    }
    else {
        const handle = setTimeout(start, WARM_TYPESCRIPT_TIMEOUT_MS);
        session.onDispose(() => clearTimeout(handle));
    }
}
const WARM_TYPESCRIPT_TIMEOUT_MS = 4000;
async function loadSceneDocument(scenes: SceneStore): Promise<{
    document: SceneDocument | null;
    warnings: string[];
}> {
    const warnings: string[] = [];
    try {
        return { document: await scenes.loadCurrent(), warnings };
    }
    catch (cause) {
        warnings.push(`A cena atual não pôde ser lida (${errorMessage(cause)}); procurando um instantâneo.`);
    }
    for (const snapshot of await scenes.listSnapshots()) {
        try {
            const document = await scenes.loadSnapshot(snapshot.key);
            if (document) {
                warnings.push(`Cena restaurada do instantâneo de ${new Date(snapshot.savedAt).toLocaleString('pt-BR')}.`);
                return { document, warnings };
            }
        }
        catch (cause) {
            warnings.push(`Instantâneo de ${new Date(snapshot.savedAt).toLocaleString('pt-BR')} ilegível: ${errorMessage(cause)}`);
        }
    }
    warnings.push('Nenhuma versão da cena pôde ser lida; a cena do template foi criada no lugar. Os ativos e materiais do projeto foram preservados.');
    return { document: null, warnings };
}
function logLibraries(session: EditorSession, record: ProjectRecord): void {
    const { materials, library } = session;
    if (materials.status === 'ready' && materials.size > 0) {
        session.log.info('Materiais', `Biblioteca carregada: ${materials.size} ${materials.size === 1 ? 'material' : 'materiais'}.`);
    }
    else if (materials.error) {
        session.log.warn('Materiais', materials.error);
    }
    if (library.status === 'ready' && library.size > 0) {
        session.log.info('Biblioteca', `Biblioteca de ativos carregada: ${library.size} ${library.size === 1 ? 'ativo' : 'ativos'}.`);
    }
    else if (library.error) {
        session.log.warn('Biblioteca', library.error);
    }
    if (record.databaseName === LEGACY_EDITOR_DATABASE_NAME) {
        session.log.info('Projeto', 'Este projeto reúne o conteúdo guardado antes de a engine ter projetos.');
    }
}
