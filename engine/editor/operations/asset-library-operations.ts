import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { Entity } from '@/engine/core/scene/entity';
import type { ImportedScene } from '@/engine/assets/import/import-types';
import { decodeImage, mimeTypeFromFileName } from '@/engine/assets/image-decoder';
import { ingestFiles } from '@/engine/assets/library/asset-ingest';
import { LIBRARY_ACCEPT, LIBRARY_FORMAT_SUMMARY } from '@/engine/assets/library/asset-kinds';
import { normalizeTags } from '@/engine/assets/library/asset-library';
import type { AssetThumbnail, LibraryAsset } from '@/engine/assets/library/asset-types';
import { renderAnimationThumbnail } from '@/engine/assets/library/thumbnails/animation-thumbnail';
import { renderImageThumbnail } from '@/engine/assets/library/thumbnails/image-thumbnail';
import { AddAssetCommand, RemoveAssetCommand } from '@/engine/editor/commands/asset-library-commands';
import { CompositeCommand, SetValueCommand } from '@/engine/editor/commands/set-value-command';
import { pickFiles } from '@/engine/editor/files/file-picker';
import { renderModelThumbnail } from '@/engine/editor/library/model-thumbnail-renderer';
import { openMaterialEditor } from '@/engine/editor/materials/material-editor-requests';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { pickEntity, pickSurfacePoint } from '@/engine/editor/viewport/pick-entity';
import type { DropPoint } from '@/engine/editor/viewport/use-file-drop';
import { loadAnimationAsset, openAnimationAssetInEditor } from './animation-operations';
import { DEFAULT_IMPORT_OPTIONS, instantiateImportedScene } from './import-operations';
import { loadTextureIntoSlot } from './texture-operations';
const LOG_SOURCE = 'Biblioteca';
function describeError(cause: unknown): string {
    return cause instanceof Error ? cause.message : String(cause);
}
function listNames(items: ReadonlyArray<{
    name: string;
}>): string {
    return items.map((item) => item.name).join(', ');
}
export interface AddToLibraryOptions {
    parsedScenes?: ReadonlyMap<File, ImportedScene>;
}
export async function addFilesToLibrary(session: EditorSession, files: File[], options: AddToLibraryOptions = {}): Promise<LibraryAsset[]> {
    const { library } = session;
    if (files.length === 0)
        return [];
    library.setBusy(`Lendo ${files.length} ${files.length === 1 ? 'arquivo' : 'arquivos'}…`);
    let report;
    try {
        report = await ingestFiles(library, files, {
            renderModel: renderModelThumbnail,
            parsedScenes: options.parsedScenes,
            onProgress: (file, index, total) => library.setBusy(total > 1 ? `Lendo ${file.name} (${index + 1}/${total})…` : `Lendo ${file.name}…`),
        });
    }
    finally {
        library.setBusy(null);
    }
    if (report.added.length > 0) {
        const commands = report.added.map((item) => new AddAssetCommand(library, item.snapshot, item.scene));
        session.history.execute(commands.length === 1 ? commands[0] : new CompositeCommand(`Adicionar ${commands.length} ativos à biblioteca`, commands));
        const added = report.added.map((item) => item.snapshot.asset);
        session.log.info(LOG_SOURCE, added.length === 1 ? `${added[0].name} adicionado à biblioteca.` : `${added.length} ativos adicionados à biblioteca: ${listNames(added)}.`);
    }
    for (const { file, existing } of report.duplicates)
        session.log.info(LOG_SOURCE, `"${file.name}" já está na biblioteca como ${existing.name}.`);
    if (report.unsupported.length > 0) {
        session.log.warn(LOG_SOURCE, `${report.unsupported.length === 1 ? 'Arquivo ignorado' : 'Arquivos ignorados'} (aceitos: ${LIBRARY_FORMAT_SUMMARY}): ${listNames(report.unsupported)}.`);
    }
    for (const { file, message } of report.failures)
        session.log.error(LOG_SOURCE, `Falha ao ler "${file.name}": ${message}`);
    return report.added.map((item) => item.snapshot.asset);
}
export function pickFilesForLibrary(session: EditorSession): void {
    void pickFiles({ accept: LIBRARY_ACCEPT, multiple: true }).then((files) => addFilesToLibrary(session, files));
}
export async function removeLibraryAsset(session: EditorSession, asset: LibraryAsset): Promise<void> {
    try {
        const snapshot = await session.library.snapshot(asset);
        if (!session.library.get(asset.id))
            return;
        session.history.execute(new RemoveAssetCommand(session.library, snapshot));
        session.log.info(LOG_SOURCE, `${asset.name} removido da biblioteca (Ctrl+Z restaura).`);
    }
    catch (cause) {
        session.log.error(LOG_SOURCE, `Não foi possível remover ${asset.name}: ${describeError(cause)}`);
    }
}
export function renameLibraryAsset(session: EditorSession, asset: LibraryAsset, name: string): void {
    const trimmed = name.trim();
    if (!trimmed || trimmed === asset.name)
        return;
    const next = session.library.uniqueName(trimmed);
    session.history.execute(new SetValueCommand(`Renomear ${asset.name} para ${next}`, (value) => session.library.rename(asset, value), asset.name, next));
}
export function setLibraryAssetTags(session: EditorSession, asset: LibraryAsset, tags: Iterable<string>): void {
    const next = normalizeTags(tags);
    if (next.length === asset.tags.length && next.every((tag, index) => tag === asset.tags[index]))
        return;
    session.history.execute(new SetValueCommand(`Etiquetas de ${asset.name}`, (value) => session.library.setTags(asset, value), asset.tags, next));
}
function setThumbnail(session: EditorSession, asset: LibraryAsset, thumbnail: AssetThumbnail | null): void {
    session.history.execute(new SetValueCommand(`Miniatura de ${asset.name}`, (value) => session.library.setThumbnail(asset, value), asset.thumbnail, thumbnail));
}
export async function setLibraryAssetThumbnailFromFile(session: EditorSession, asset: LibraryAsset, file: File): Promise<void> {
    try {
        const image = await decodeImage(file, file.type || mimeTypeFromFileName(file.name));
        setThumbnail(session, asset, { blob: await renderImageThumbnail(image), custom: true });
        session.log.info(LOG_SOURCE, `Miniatura de ${asset.name} definida a partir de "${file.name}".`);
    }
    catch (cause) {
        session.log.error(LOG_SOURCE, `Não foi possível usar "${file.name}" como miniatura: ${describeError(cause)}`);
    }
}
export function pickLibraryAssetThumbnail(session: EditorSession, asset: LibraryAsset): void {
    void pickFiles({ accept: 'image/*' }).then(([file]) => {
        if (file)
            return setLibraryAssetThumbnailFromFile(session, asset, file);
    });
}
export async function regenerateLibraryAssetThumbnail(session: EditorSession, asset: LibraryAsset): Promise<void> {
    const { library } = session;
    library.setBusy(`Gerando miniatura de ${asset.name}…`);
    try {
        let blob: Blob | null = null;
        if (asset.kind === 'model')
            blob = (await renderModelThumbnail(await library.loadModel(asset)))?.blob ?? null;
        else if (asset.kind === 'texture')
            blob = await renderImageThumbnail(await decodeImage(await library.primaryFile(asset)));
        else if (asset.kind === 'animation')
            blob = await renderAnimationThumbnail(await loadAnimationAsset(session, asset));
        if (!blob) {
            session.log.warn(LOG_SOURCE, `Não há miniatura automática para ${asset.name}.`);
            return;
        }
        setThumbnail(session, asset, { blob, custom: false });
    }
    catch (cause) {
        session.log.error(LOG_SOURCE, `Não foi possível gerar a miniatura de ${asset.name}: ${describeError(cause)}`);
    }
    finally {
        library.setBusy(null);
    }
}
export async function placeLibraryModel(session: EditorSession, asset: LibraryAsset, point: Vec3 | null = null): Promise<Entity | null> {
    if (asset.kind !== 'model')
        return null;
    session.library.setBusy(`Carregando ${asset.name}…`);
    try {
        const scene = await session.library.loadModel(asset);
        return await instantiateImportedScene(session, scene, { ...DEFAULT_IMPORT_OPTIONS, rootName: asset.name, placementPoint: point, frameAfterImport: false, saveToLibrary: false });
    }
    catch (cause) {
        session.log.error(LOG_SOURCE, `Não foi possível colocar ${asset.name} na cena: ${describeError(cause)}`);
        return null;
    }
    finally {
        session.library.setBusy(null);
    }
}
export async function applyLibraryTexture(session: EditorSession, asset: LibraryAsset, entity: Entity): Promise<void> {
    if (asset.kind !== 'texture')
        return;
    if (entity.kind !== 'mesh' || !entity.material) {
        session.log.warn(LOG_SOURCE, `${entity.name} não tem material próprio para receber ${asset.name}.`);
        return;
    }
    const libraryMaterial = session.materials.forMaterial(entity.material);
    if (libraryMaterial) {
        session.log.warn(LOG_SOURCE, `${entity.name} usa o material ${libraryMaterial.name} da biblioteca; troque o mapa dele no editor de materiais.`);
        return;
    }
    try {
        await loadTextureIntoSlot(session, entity, 'baseColorMap', await session.library.primaryFile(asset));
    }
    catch (cause) {
        session.log.error(LOG_SOURCE, `Não foi possível aplicar ${asset.name}: ${describeError(cause)}`);
    }
}
export async function createMaterialFromLibraryTexture(session: EditorSession, asset: LibraryAsset): Promise<void> {
    if (asset.kind !== 'texture')
        return;
    try {
        const file = await session.library.primaryFile(asset);
        const document = session.materials.create(asset.name);
        if (!(await session.materials.setSourceFile(document, 'albedo', file))) {
            session.materials.remove(document);
            return;
        }
        openMaterialEditor({ materialId: document.id });
        session.log.info(LOG_SOURCE, `Material ${document.name} criado a partir de ${asset.name}.`);
    }
    catch (cause) {
        session.log.error(LOG_SOURCE, `Não foi possível criar um material com ${asset.name}: ${describeError(cause)}`);
    }
}
let audioPreview: {
    assetId: string;
    element: HTMLAudioElement;
    url: string;
} | null = null;
export function playingLibraryAudioId(): string | null {
    return audioPreview?.assetId ?? null;
}
function stopAudioPreview(session: EditorSession): void {
    if (!audioPreview)
        return;
    audioPreview.element.pause();
    URL.revokeObjectURL(audioPreview.url);
    audioPreview = null;
    session.notify();
}
export async function toggleLibraryAudioPreview(session: EditorSession, asset: LibraryAsset): Promise<void> {
    if (asset.kind !== 'audio')
        return;
    if (audioPreview?.assetId === asset.id) {
        stopAudioPreview(session);
        return;
    }
    stopAudioPreview(session);
    try {
        const url = URL.createObjectURL(await session.library.primaryFile(asset));
        const element = new Audio(url);
        element.onended = () => stopAudioPreview(session);
        audioPreview = { assetId: asset.id, element, url };
        session.notify();
        await element.play();
    }
    catch (cause) {
        stopAudioPreview(session);
        session.log.error(LOG_SOURCE, `Não foi possível reproduzir ${asset.name}: ${describeError(cause)}`);
    }
}
export async function activateLibraryAsset(session: EditorSession, asset: LibraryAsset): Promise<void> {
    switch (asset.kind) {
        case 'model':
            await placeLibraryModel(session, asset);
            break;
        case 'texture': {
            const target = session.selectedEntity;
            if (target && target.kind === 'mesh' && target.material)
                await applyLibraryTexture(session, asset, target);
            else
                session.log.info(LOG_SOURCE, `Selecione uma malha para aplicar ${asset.name}, ou arraste a textura sobre um ator no viewport.`);
            break;
        }
        case 'audio':
            await toggleLibraryAudioPreview(session, asset);
            break;
        case 'animation':
            await openAnimationAssetInEditor(session, asset);
            break;
    }
}
export async function dropLibraryAssetOnViewport(session: EditorSession, assetId: string, point: DropPoint): Promise<void> {
    const asset = session.library.get(assetId);
    if (!asset)
        return;
    switch (asset.kind) {
        case 'model':
            await placeLibraryModel(session, asset, pickSurfacePoint(vec3.create(), session.scene, session.camera, point.u, point.v));
            break;
        case 'texture': {
            const entity = pickEntity(session.scene, session.camera, point.u, point.v);
            if (entity)
                await applyLibraryTexture(session, asset, entity);
            else
                session.log.info(LOG_SOURCE, `Solte ${asset.name} sobre um ator com material próprio para aplicá-la.`);
            break;
        }
        case 'audio':
            session.log.info(LOG_SOURCE, `${asset.name} é um áudio: use a prévia na biblioteca (duplo clique).`);
            break;
    }
}
