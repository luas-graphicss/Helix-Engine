import { ingestVfxDocument, ingestVfxReplacement } from '@/engine/assets/library/asset-ingest';
import type { LibraryAsset } from '@/engine/assets/library/asset-types';
import type { Entity } from '@/engine/core/scene/entity';
import { VFX_EXTENSION, type VfxDocument } from '@/engine/vfx/document/vfx-document';
import { readVfxDocument, vfxDocumentToFile } from '@/engine/vfx/document/vfx-io';
import { findVfxTemplate } from '@/engine/vfx/document/vfx-templates';
import { AddAssetCommand } from '@/engine/editor/commands/asset-library-commands';
import { downloadBlob } from '@/engine/editor/files/file-download';
import { pickFiles } from '@/engine/editor/files/file-picker';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { addFilesToLibrary } from './asset-library-operations';
import { addVfxActor } from './vfx-world-operations';
const LOG_SOURCE = 'Efeitos';
function describeError(cause: unknown): string {
    return cause instanceof Error ? cause.message : String(cause);
}
const documentCache = new Map<string, {
    hash: string;
    document: VfxDocument;
}>();
export async function loadVfxAsset(session: EditorSession, asset: LibraryAsset): Promise<VfxDocument> {
    if (asset.kind !== 'vfx')
        throw new Error(`${asset.name} não é um efeito.`);
    const cached = documentCache.get(asset.id);
    if (cached && cached.hash === asset.contentHash)
        return cached.document.name === asset.name ? cached.document : { ...cached.document, name: asset.name };
    const file = await session.library.primaryFile(asset);
    const document = { ...(await readVfxDocument(file)), name: asset.name };
    documentCache.set(asset.id, { hash: asset.contentHash, document });
    return document;
}
export function findVfxStage(session: EditorSession, assetId: string): Entity | null {
    const selected = session.selectedEntity;
    if (selected?.vfx?.assetId === assetId)
        return selected;
    let found: Entity | null = null;
    session.scene.traverse((entity) => {
        if (!found && entity.parent && entity.vfx?.assetId === assetId)
            found = entity;
    });
    return found;
}
export async function openVfxAssetInEditor(session: EditorSession, asset: LibraryAsset, options: {
    place?: boolean;
} = {}): Promise<boolean> {
    if (asset.kind !== 'vfx')
        return false;
    const editor = session.vfx;
    if (editor.assetId === asset.id && editor.document) {
        if (!editor.stageEntityId || !session.findById(editor.stageEntityId))
            editor.setStage(resolveStage(session, asset, options.place ?? true)?.id ?? null);
        return true;
    }
    if (editor.dirty)
        await saveVfxEditorDocument(session, { silent: true });
    session.library.setBusy(`Abrindo ${asset.name}…`);
    try {
        const document = await loadVfxAsset(session, asset);
        const stage = resolveStage(session, asset, options.place ?? true);
        editor.open(document, asset.id, stage?.id ?? null);
        if (stage)
            session.select(stage);
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
function resolveStage(session: EditorSession, asset: LibraryAsset, place: boolean): Entity | null {
    const existing = findVfxStage(session, asset.id);
    if (existing || !place)
        return existing;
    return addVfxActor(session, { assetId: asset.id, name: asset.name });
}
export async function createVfxEffect(session: EditorSession, templateId: string, options: {
    name?: string;
    stage?: Entity | null;
} = {}): Promise<LibraryAsset | null> {
    const { library } = session;
    const template = findVfxTemplate(templateId);
    const built = template.build();
    const document = options.name?.trim() ? { ...built, name: options.name.trim() } : built;
    if (session.vfx.dirty)
        await saveVfxEditorDocument(session, { silent: true });
    library.setBusy(`Criando ${document.name}…`);
    try {
        const result = await ingestVfxDocument(library, document, { forceNew: true });
        if (!result.added)
            return null;
        session.history.execute(new AddAssetCommand(library, result.added.snapshot, null));
        const asset = result.added.snapshot.asset;
        const named = { ...document, name: asset.name };
        documentCache.set(asset.id, { hash: asset.contentHash, document: named });
        const stage = options.stage === undefined ? addVfxActor(session, { assetId: asset.id, name: asset.name }) : options.stage;
        session.vfx.open(named, asset.id, stage?.id ?? null);
        session.log.info(LOG_SOURCE, `${asset.name} criado a partir do modelo ${template.label}.`);
        return asset;
    }
    catch (cause) {
        session.log.error(LOG_SOURCE, `Não foi possível criar o efeito: ${describeError(cause)}`);
        return null;
    }
    finally {
        library.setBusy(null);
    }
}
export async function saveVfxDocumentToLibrary(session: EditorSession, document: VfxDocument): Promise<LibraryAsset | null> {
    const { library } = session;
    library.setBusy(`Salvando ${document.name}…`);
    try {
        const result = await ingestVfxDocument(library, document, { forceNew: true });
        if (!result.added)
            return null;
        session.history.execute(new AddAssetCommand(library, result.added.snapshot, null));
        const asset = result.added.snapshot.asset;
        documentCache.set(asset.id, { hash: asset.contentHash, document: { ...document, name: asset.name } });
        return asset;
    }
    catch (cause) {
        session.log.error(LOG_SOURCE, `Não foi possível salvar o efeito: ${describeError(cause)}`);
        return null;
    }
    finally {
        library.setBusy(null);
    }
}
export async function saveVfxEditorDocument(session: EditorSession, options: {
    silent?: boolean;
} = {}): Promise<LibraryAsset | null> {
    const editor = session.vfx;
    const { document } = editor;
    if (!document)
        return null;
    const { library } = session;
    const existing = editor.assetId ? library.get(editor.assetId) : null;
    if (existing && existing.kind === 'vfx') {
        try {
            const after = await ingestVfxReplacement(library, existing, document);
            if (!after) {
                editor.markSaved(existing.id);
                return existing;
            }
            library.remove(existing.id);
            library.add(after);
            documentCache.set(existing.id, { hash: after.asset.contentHash, document });
            editor.markSaved(existing.id);
            if (!options.silent)
                session.log.info(LOG_SOURCE, `${after.asset.name} salvo na biblioteca.`);
            return after.asset;
        }
        catch (cause) {
            session.log.error(LOG_SOURCE, `Não foi possível salvar ${document.name}: ${describeError(cause)}`);
            return null;
        }
    }
    try {
        const result = await ingestVfxDocument(library, document, { forceNew: true });
        if (!result.added)
            return null;
        session.history.execute(new AddAssetCommand(library, result.added.snapshot, null));
        const asset = result.added.snapshot.asset;
        documentCache.set(asset.id, { hash: asset.contentHash, document: { ...document, name: asset.name } });
        editor.markSaved(asset.id);
        if (!options.silent)
            session.log.info(LOG_SOURCE, `${asset.name} guardado na biblioteca.`);
        return asset;
    }
    catch (cause) {
        session.log.error(LOG_SOURCE, `Não foi possível guardar ${document.name}: ${describeError(cause)}`);
        return null;
    }
}
export async function closeVfxEditor(session: EditorSession): Promise<void> {
    if (session.vfx.dirty)
        await saveVfxEditorDocument(session, { silent: true });
    session.vfx.close();
}
export function syncVfxEditorWithLibrary(session: EditorSession): void {
    const editor = session.vfx;
    if (!editor.document || !editor.assetId)
        return;
    if (session.library.status !== 'ready')
        return;
    const asset = session.library.get(editor.assetId);
    if (!asset) {
        editor.close();
        return;
    }
    if (asset.name !== editor.document.name)
        editor.syncName(asset.name);
    if (editor.stageEntityId !== null && !session.findById(editor.stageEntityId))
        editor.setStage(findVfxStage(session, asset.id)?.id ?? null);
}
export async function duplicateVfxAsset(session: EditorSession, asset: LibraryAsset): Promise<LibraryAsset | null> {
    const { library } = session;
    library.setBusy(`Duplicando ${asset.name}…`);
    try {
        const source = session.vfx.assetId === asset.id && session.vfx.document ? session.vfx.document : await loadVfxAsset(session, asset);
        const result = await ingestVfxDocument(library, { ...source, name: `Cópia de ${asset.name}`, createdAt: Date.now() }, { forceNew: true });
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
export function exportVfxDocument(document: VfxDocument): void {
    const file = vfxDocumentToFile(document);
    void downloadBlob(file, file.name, 'Efeito Helix');
}
export async function importVfxEffects(session: EditorSession): Promise<void> {
    const files = await pickFiles({ accept: `.${VFX_EXTENSION}`, multiple: true });
    const added = await addFilesToLibrary(session, files);
    const effect = added.find((asset) => asset.kind === 'vfx');
    if (effect)
        await openVfxAssetInEditor(session, effect);
}
export async function renderVfxAssetThumbnail(session: EditorSession, asset: LibraryAsset): Promise<Blob | null> {
    const { renderVfxThumbnail } = await import('@/engine/assets/library/thumbnails/vfx-thumbnail');
    const document = session.vfx.assetId === asset.id && session.vfx.document ? session.vfx.document : await loadVfxAsset(session, asset);
    return renderVfxThumbnail(document);
}
