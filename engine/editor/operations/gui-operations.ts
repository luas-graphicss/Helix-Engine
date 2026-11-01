import { ingestGuiDocument, ingestGuiReplacement } from '@/engine/assets/library/asset-ingest';
import { FONT_ACCEPT } from '@/engine/assets/library/asset-kinds';
import type { LibraryAsset } from '@/engine/assets/library/asset-types';
import { GUI_EXTENSION, type GuiDocument } from '@/engine/gui/document/gui-document';
import { guiDocumentToFile, readGuiDocument } from '@/engine/gui/document/gui-io';
import { fontAssetFamily } from '@/engine/gui/fonts/gui-font-registry';
import { findGuiTemplate } from '@/engine/gui/templates/gui-templates';
import { AddAssetCommand } from '@/engine/editor/commands/asset-library-commands';
import { downloadBlob } from '@/engine/editor/files/file-download';
import { pickFiles } from '@/engine/editor/files/file-picker';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { addFilesToLibrary } from './asset-library-operations';
import { setSelectedTextFamily } from './gui-property-operations';
const LOG_SOURCE = 'Interface';
function describeError(cause: unknown): string {
    return cause instanceof Error ? cause.message : String(cause);
}
const documentCache = new Map<string, {
    hash: string;
    document: GuiDocument;
}>();
export async function loadGuiAsset(session: EditorSession, asset: LibraryAsset): Promise<GuiDocument> {
    if (asset.kind !== 'gui')
        throw new Error(`${asset.name} não é uma tela.`);
    const cached = documentCache.get(asset.id);
    if (cached && cached.hash === asset.contentHash)
        return cached.document.name === asset.name ? cached.document : { ...cached.document, name: asset.name };
    const file = await session.library.primaryFile(asset);
    const document = { ...(await readGuiDocument(file)), name: asset.name };
    documentCache.set(asset.id, { hash: asset.contentHash, document });
    return document;
}
export function forgetGuiDocument(assetId: string): void {
    documentCache.delete(assetId);
}
export async function openGuiAssetInDesigner(session: EditorSession, asset: LibraryAsset): Promise<boolean> {
    if (asset.kind !== 'gui')
        return false;
    const designer = session.gui;
    if (designer.assetId === asset.id && designer.document) {
        session.setWorkspace('gui');
        return true;
    }
    if (designer.dirty)
        await saveGuiDesignerDocument(session, { silent: true });
    session.library.setBusy(`Abrindo ${asset.name}…`);
    try {
        const document = await loadGuiAsset(session, asset);
        designer.open(document, asset.id);
        session.setWorkspace('gui');
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
export async function createGuiScreen(session: EditorSession, templateId: string, name?: string): Promise<LibraryAsset | null> {
    const { library } = session;
    const template = findGuiTemplate(templateId);
    const built = template.build();
    const document = name?.trim() ? { ...built, name: name.trim() } : built;
    if (session.gui.dirty)
        await saveGuiDesignerDocument(session, { silent: true });
    library.setBusy(`Criando ${document.name}…`);
    try {
        const result = await ingestGuiDocument(library, document, { forceNew: true });
        if (!result.added)
            return null;
        session.history.execute(new AddAssetCommand(library, result.added.snapshot, null));
        const asset = result.added.snapshot.asset;
        const named = { ...document, name: asset.name };
        documentCache.set(asset.id, { hash: asset.contentHash, document: named });
        session.gui.open(named, asset.id);
        session.setWorkspace('gui');
        session.log.info(LOG_SOURCE, `${asset.name} criada a partir do modelo ${template.label}.`);
        return asset;
    }
    catch (cause) {
        session.log.error(LOG_SOURCE, `Não foi possível criar a tela: ${describeError(cause)}`);
        return null;
    }
    finally {
        library.setBusy(null);
    }
}
export async function saveGuiDesignerDocument(session: EditorSession, options: {
    silent?: boolean;
} = {}): Promise<LibraryAsset | null> {
    const designer = session.gui;
    const { document } = designer;
    if (!document)
        return null;
    const { library } = session;
    const existing = designer.assetId ? library.get(designer.assetId) : null;
    if (existing && existing.kind === 'gui') {
        try {
            const after = await ingestGuiReplacement(library, existing, document);
            if (!after) {
                designer.markSaved(existing.id);
                return existing;
            }
            library.remove(existing.id);
            library.add(after);
            documentCache.set(existing.id, { hash: after.asset.contentHash, document });
            designer.markSaved(existing.id);
            if (!options.silent)
                session.log.info(LOG_SOURCE, `${after.asset.name} salva na biblioteca.`);
            return after.asset;
        }
        catch (cause) {
            session.log.error(LOG_SOURCE, `Não foi possível salvar ${document.name}: ${describeError(cause)}`);
            return null;
        }
    }
    try {
        const result = await ingestGuiDocument(library, document, { forceNew: true });
        if (!result.added)
            return null;
        session.history.execute(new AddAssetCommand(library, result.added.snapshot, null));
        const asset = result.added.snapshot.asset;
        documentCache.set(asset.id, { hash: asset.contentHash, document: { ...document, name: asset.name } });
        designer.markSaved(asset.id);
        if (!options.silent)
            session.log.info(LOG_SOURCE, `${asset.name} guardada na biblioteca.`);
        return asset;
    }
    catch (cause) {
        session.log.error(LOG_SOURCE, `Não foi possível guardar ${document.name}: ${describeError(cause)}`);
        return null;
    }
}
export async function closeGuiDesigner(session: EditorSession): Promise<void> {
    if (session.gui.dirty)
        await saveGuiDesignerDocument(session, { silent: true });
    session.gui.close();
    session.setWorkspace('scene');
}
export function syncGuiDesignerWithLibrary(session: EditorSession): void {
    const designer = session.gui;
    if (!designer.document || !designer.assetId)
        return;
    if (session.library.status !== 'ready')
        return;
    const asset = session.library.get(designer.assetId);
    if (!asset) {
        designer.close();
        if (session.workspace === 'gui')
            session.setWorkspace('scene');
        return;
    }
    if (asset.name !== designer.document.name)
        designer.syncName(asset.name);
}
export async function duplicateGuiAsset(session: EditorSession, asset: LibraryAsset): Promise<LibraryAsset | null> {
    const { library } = session;
    library.setBusy(`Duplicando ${asset.name}…`);
    try {
        const source = session.gui.assetId === asset.id && session.gui.document ? session.gui.document : await loadGuiAsset(session, asset);
        const result = await ingestGuiDocument(library, { ...source, name: `Cópia de ${asset.name}`, createdAt: Date.now() }, { forceNew: true });
        if (!result.added)
            return null;
        session.history.execute(new AddAssetCommand(library, result.added.snapshot, null));
        session.log.info(LOG_SOURCE, `${result.added.snapshot.asset.name} criada.`);
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
export async function updateGuiAssetSettings(session: EditorSession, asset: LibraryAsset, patch: Partial<Pick<GuiDocument, 'enabled' | 'displayOrder'>>): Promise<void> {
    const designer = session.gui;
    if (designer.assetId === asset.id && designer.document) {
        designer.apply(patch.enabled !== undefined ? (patch.enabled ? 'Mostrar tela no jogo' : 'Ocultar tela no jogo') : 'Alterar ordem da tela', (document) => ({ ...document, ...patch }));
        return;
    }
    const { library } = session;
    try {
        const document = { ...(await loadGuiAsset(session, asset)), ...patch };
        const after = await ingestGuiReplacement(library, asset, document);
        if (!after)
            return;
        library.remove(asset.id);
        library.add(after);
        documentCache.set(asset.id, { hash: after.asset.contentHash, document });
    }
    catch (cause) {
        session.log.error(LOG_SOURCE, `Não foi possível atualizar ${asset.name}: ${describeError(cause)}`);
    }
}
export function exportGuiDocument(document: GuiDocument): void {
    const file = guiDocumentToFile(document);
    void downloadBlob(file, file.name, 'Tela Helix');
}
export function importGuiFonts(session: EditorSession): void {
    void pickFiles({ accept: FONT_ACCEPT, multiple: true }).then((files) => addFilesToLibrary(session, files));
}
export async function importGuiScreens(session: EditorSession): Promise<void> {
    const files = await pickFiles({ accept: `.${GUI_EXTENSION}`, multiple: true });
    const added = await addFilesToLibrary(session, files);
    const screen = added.find((asset) => asset.kind === 'gui');
    if (screen)
        await openGuiAssetInDesigner(session, screen);
}
export function applyFontAssetToSelection(session: EditorSession, asset: LibraryAsset): boolean {
    if (asset.kind !== 'font')
        return false;
    return setSelectedTextFamily(session, fontAssetFamily(asset.id), asset.name);
}
export async function collectPlaytestGuiDocuments(session: EditorSession): Promise<GuiDocument[]> {
    const designer = session.gui;
    const documents: GuiDocument[] = [];
    for (const asset of session.library.byKind('gui')) {
        if (asset.details.kind !== 'gui')
            continue;
        if (designer.assetId === asset.id && designer.document) {
            if (designer.document.enabled)
                documents.push(designer.document);
            continue;
        }
        if (!asset.details.enabled)
            continue;
        try {
            documents.push(await loadGuiAsset(session, asset));
        }
        catch (cause) {
            session.log.warn(LOG_SOURCE, `${asset.name} ficou fora do playtest: ${describeError(cause)}`);
        }
    }
    return documents.sort((a, b) => a.displayOrder - b.displayOrder);
}
