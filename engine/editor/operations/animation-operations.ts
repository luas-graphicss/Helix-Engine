import { ingestAnimationDocument, ingestAnimationReplacement } from '@/engine/assets/library/asset-ingest';
import type { LibraryAsset } from '@/engine/assets/library/asset-types';
import type { AnimationDocument } from '@/engine/core/animation/animation-document';
import { animationExportFormatInfo, exportAnimation, readAnimations, type AnimationExportFormat } from '@/engine/core/animation/animation-io';
import type { Entity } from '@/engine/core/scene/entity';
import { registerAnimationDocument } from '@/engine/animation/clip-registry';
import { AddAssetCommand, ReplaceAssetCommand } from '@/engine/editor/commands/asset-library-commands';
import { downloadBlob } from '@/engine/editor/files/file-download';
import type { EditorSession } from '@/engine/editor/session/editor-session';
const LOG_SOURCE = 'Animação';
function describeError(cause: unknown): string {
    return cause instanceof Error ? cause.message : String(cause);
}
const documentCache = new WeakMap<LibraryAsset, Promise<AnimationDocument>>();
export function loadAnimationAsset(session: EditorSession, asset: LibraryAsset): Promise<AnimationDocument> {
    if (asset.kind !== 'animation')
        return Promise.reject(new Error(`${asset.name} não é uma animação.`));
    let pending = documentCache.get(asset);
    if (!pending) {
        pending = session.library
            .primaryFile(asset)
            .then((file) => readAnimations(file))
            .then(({ documents }) => {
            if (documents.length === 0)
                throw new Error(`${asset.name} não contém trilhas.`);
            return documents[0];
        });
        documentCache.set(asset, pending);
        pending.catch(() => documentCache.delete(asset));
    }
    return pending;
}
export async function saveAnimationToLibrary(session: EditorSession, document: AnimationDocument): Promise<LibraryAsset | null> {
    const { library } = session;
    library.setBusy(`Guardando ${document.name}…`);
    try {
        const result = await ingestAnimationDocument(library, document);
        if (result.duplicate) {
            session.log.info(LOG_SOURCE, `${document.name} já está na biblioteca como ${result.duplicate.name}.`);
            return result.duplicate;
        }
        if (!result.added)
            return null;
        session.history.execute(new AddAssetCommand(library, result.added.snapshot, null));
        session.log.info(LOG_SOURCE, `${result.added.snapshot.asset.name} guardada na biblioteca.`);
        return result.added.snapshot.asset;
    }
    catch (cause) {
        session.log.error(LOG_SOURCE, `Não foi possível guardar ${document.name}: ${describeError(cause)}`);
        return null;
    }
    finally {
        library.setBusy(null);
    }
}
export async function openAnimationAssetInEditor(session: EditorSession, asset: LibraryAsset, target: Entity | null = session.selectedEntity): Promise<boolean> {
    session.library.setBusy(`Abrindo ${asset.name}…`);
    try {
        const document = await loadAnimationAsset(session, asset);
        registerAnimationDocument(asset.id, document);
        return session.animation.open({ ...document, name: asset.name }, target, { assetId: asset.id });
    }
    catch (cause) {
        session.log.error(LOG_SOURCE, `Não foi possível abrir ${asset.name}: ${describeError(cause)}`);
        return false;
    }
    finally {
        session.library.setBusy(null);
    }
}
export async function ensureAnimationDocument(session: EditorSession, assetId: string): Promise<AnimationDocument | null> {
    const asset = session.library.get(assetId);
    if (!asset || asset.kind !== 'animation')
        return null;
    try {
        const document = await loadAnimationAsset(session, asset);
        registerAnimationDocument(asset.id, document);
        return document;
    }
    catch (cause) {
        session.log.error(LOG_SOURCE, `Não foi possível ler ${asset.name}: ${describeError(cause)}`);
        return null;
    }
}
export async function saveAnimationEditorDocument(session: EditorSession): Promise<LibraryAsset | null> {
    const editor = session.animation;
    const { document } = editor;
    if (!document)
        return null;
    const existing = editor.assetId ? session.library.get(editor.assetId) : null;
    if (existing && existing.kind === 'animation') {
        session.library.setBusy(`Salvando ${document.name}…`);
        try {
            const before = await session.library.snapshot(existing);
            const after = await ingestAnimationReplacement(session.library, existing, document);
            if (!after) {
                editor.markSaved(existing.id);
                return existing;
            }
            session.history.execute(new ReplaceAssetCommand(session.library, before, after));
            registerAnimationDocument(existing.id, document);
            editor.markSaved(existing.id);
            session.log.info(LOG_SOURCE, `${after.asset.name} salva na biblioteca.`);
            return after.asset;
        }
        catch (cause) {
            session.log.error(LOG_SOURCE, `Não foi possível salvar ${document.name}: ${describeError(cause)}`);
            return null;
        }
        finally {
            session.library.setBusy(null);
        }
    }
    const asset = await saveAnimationToLibrary(session, document);
    if (asset) {
        registerAnimationDocument(asset.id, document);
        editor.markSaved(asset.id);
    }
    return asset;
}
export async function exportAnimationDocument(session: EditorSession, document: AnimationDocument, format: AnimationExportFormat): Promise<void> {
    const info = animationExportFormatInfo(format);
    try {
        const exported = exportAnimation(document, format);
        const saved = await downloadBlob(exported.blob, exported.fileName, info.label);
        if (saved)
            session.log.info(LOG_SOURCE, `${document.name} exportada como ${exported.fileName}.`);
    }
    catch (cause) {
        session.log.error(LOG_SOURCE, `Não foi possível exportar ${document.name} em ${info.label}: ${describeError(cause)}`);
    }
}
export async function exportAnimationAsset(session: EditorSession, asset: LibraryAsset, format: AnimationExportFormat): Promise<void> {
    session.library.setBusy(`Exportando ${asset.name}…`);
    try {
        const document = await loadAnimationAsset(session, asset);
        await exportAnimationDocument(session, { ...document, name: asset.name }, format);
    }
    catch (cause) {
        session.log.error(LOG_SOURCE, `Não foi possível ler ${asset.name}: ${describeError(cause)}`);
    }
    finally {
        session.library.setBusy(null);
    }
}
export async function extractAnimationsFromModelAsset(session: EditorSession, asset: LibraryAsset): Promise<LibraryAsset[]> {
    if (asset.kind !== 'model')
        return [];
    session.library.setBusy(`Lendo animações de ${asset.name}…`);
    try {
        const file = await session.library.primaryFile(asset);
        const scene = await session.library.loadModel(asset);
        const { documents } = await readAnimations(file, { scene });
        if (documents.length === 0) {
            session.log.info(LOG_SOURCE, `${asset.name} não contém animações.`);
            return [];
        }
        const saved: LibraryAsset[] = [];
        for (const document of documents) {
            const result = await saveAnimationToLibrary(session, document);
            if (result)
                saved.push(result);
        }
        return saved;
    }
    catch (cause) {
        session.log.error(LOG_SOURCE, `Não foi possível extrair as animações de ${asset.name}: ${describeError(cause)}`);
        return [];
    }
    finally {
        session.library.setBusy(null);
    }
}
