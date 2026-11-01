import { ingestPrefabDocument } from '@/engine/assets/library/asset-ingest';
import type { LibraryAsset } from '@/engine/assets/library/asset-types';
import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { Entity } from '@/engine/core/scene/entity';
import { AddAssetCommand } from '@/engine/editor/commands/asset-library-commands';
import { downloadBlob } from '@/engine/editor/files/file-download';
import { pickFiles } from '@/engine/editor/files/file-picker';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { bindPendingTerrainLayers } from '@/engine/project/bind-terrain-layers';
import { PREFAB_DOCUMENT_FORMAT, PREFAB_DOCUMENT_VERSION, PREFAB_EXTENSION, type PrefabDocument } from '@/engine/project/prefab/prefab-document';
import { prefabDocumentToFile, readPrefabDocument } from '@/engine/project/prefab/prefab-io';
import { deserializeSubtree } from '@/engine/project/scene-document/deserialize-scene';
import { SCENE_DOCUMENT_VERSION } from '@/engine/project/scene-document/scene-document';
import { serializeSubtree } from '@/engine/project/scene-document/serialize-scene';
import { addFilesToLibrary } from './asset-library-operations';
import { addEntity, defaultParent, spawnPosition } from './entity-operations';
import { libraryDocumentForTerrainMaterial } from './material-library-operations';
const LOG_SOURCE = 'Prefabs';
function describeError(cause: unknown): string {
    return cause instanceof Error ? cause.message : String(cause);
}
const documentCache = new Map<string, {
    hash: string;
    document: PrefabDocument;
}>();
export async function loadPrefabAsset(session: EditorSession, asset: LibraryAsset): Promise<PrefabDocument> {
    if (asset.kind !== 'prefab')
        throw new Error(`${asset.name} não é um prefab.`);
    const cached = documentCache.get(asset.id);
    if (cached && cached.hash === asset.contentHash)
        return cached.document;
    const file = await session.library.primaryFile(asset);
    const document = await readPrefabDocument(file);
    documentCache.set(asset.id, { hash: asset.contentHash, document });
    return document;
}
function countTriangles(entity: Entity): number {
    let triangles = entity.mesh ? Math.floor(entity.mesh.indices.length / 3) : 0;
    for (const child of entity.children)
        triangles += countTriangles(child);
    return triangles;
}
export async function buildPrefabDocument(session: EditorSession, entity: Entity, name: string): Promise<PrefabDocument> {
    if (entity === session.scene.root)
        throw new Error('A raiz da cena não pode virar prefab; escolha um ator.');
    const subtree = await serializeSubtree(entity, { libraryDocumentForTerrainMaterial: (id) => libraryDocumentForTerrainMaterial(session, id)?.id ?? null });
    return {
        json: {
            format: PREFAB_DOCUMENT_FORMAT,
            version: PREFAB_DOCUMENT_VERSION,
            sceneVersion: SCENE_DOCUMENT_VERSION,
            savedAt: Date.now(),
            name: name.trim() || entity.name,
            meshes: subtree.json.meshes,
            textures: subtree.json.textures,
            materials: subtree.json.materials,
            root: subtree.root,
            stats: { entities: subtree.entityCount, triangles: countTriangles(entity), rootKind: entity.kind },
        },
        binary: subtree.binary,
        images: subtree.images,
    };
}
export async function savePrefabToLibrary(session: EditorSession, entity: Entity, name: string = entity.name): Promise<LibraryAsset | null> {
    const { library } = session;
    library.setBusy(`Salvando ${name}…`);
    try {
        const document = await buildPrefabDocument(session, entity, name);
        const result = await ingestPrefabDocument(library, document, { forceNew: true });
        if (!result.added)
            return null;
        session.history.execute(new AddAssetCommand(library, result.added.snapshot, null));
        const asset = result.added.snapshot.asset;
        documentCache.set(asset.id, { hash: asset.contentHash, document: { ...document, json: { ...document.json, name: asset.name } } });
        session.log.info(LOG_SOURCE, `${asset.name} salvo na biblioteca (${document.json.stats.entities} ${document.json.stats.entities === 1 ? 'ator' : 'atores'}).`);
        return asset;
    }
    catch (cause) {
        session.log.error(LOG_SOURCE, `Não foi possível salvar ${name} como prefab: ${describeError(cause)}`);
        return null;
    }
    finally {
        library.setBusy(null);
    }
}
export async function buildPrefabInstance(session: EditorSession, asset: LibraryAsset): Promise<Entity> {
    const document = await loadPrefabAsset(session, asset);
    const result = await deserializeSubtree(document, document.json.root, session.scene, { materials: session.materials, onRigReady: () => session.notify() });
    const warnings = [...result.warnings];
    bindPendingTerrainLayers(session, result.pendingTerrainLayers, warnings);
    for (const warning of warnings)
        session.log.warn(LOG_SOURCE, `${asset.name}: ${warning}`);
    return result.root;
}
export async function placePrefabAsset(session: EditorSession, asset: LibraryAsset, options: {
    position?: Vec3 | null;
    parent?: Entity;
} = {}): Promise<Entity | null> {
    if (asset.kind !== 'prefab')
        return null;
    session.library.setBusy(`Instanciando ${asset.name}…`);
    try {
        const root = await buildPrefabInstance(session, asset);
        vec3.copy(root.transform.position, options.position ?? spawnPosition(session, root.mesh));
        return addEntity(session, root, options.parent ?? defaultParent(session), `Instanciar ${asset.name}`);
    }
    catch (cause) {
        session.log.error(LOG_SOURCE, `Não foi possível instanciar ${asset.name}: ${describeError(cause)}`);
        return null;
    }
    finally {
        session.library.setBusy(null);
    }
}
export async function exportPrefabAsset(session: EditorSession, asset: LibraryAsset): Promise<void> {
    try {
        const document = await loadPrefabAsset(session, asset);
        const file = await prefabDocumentToFile(document.json.name === asset.name ? document : { ...document, json: { ...document.json, name: asset.name } });
        await downloadBlob(file, file.name, 'Prefab Helix');
    }
    catch (cause) {
        session.log.error(LOG_SOURCE, `Não foi possível exportar ${asset.name}: ${describeError(cause)}`);
    }
}
export async function importPrefabs(session: EditorSession): Promise<LibraryAsset[]> {
    const files = await pickFiles({ accept: `.${PREFAB_EXTENSION}`, multiple: true });
    return addFilesToLibrary(session, files);
}
