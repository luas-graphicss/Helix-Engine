import { ASSET_FILES_BY_ASSET_INDEX, EDITOR_STORES, isIndexedDbSupported, openEditorDatabase, requestToPromise, withTransaction } from '@/engine/core/storage/editor-database';
import type { AssetSnapshot, LibraryAsset } from './asset-types';
interface StoredAssetFile {
    key: string;
    assetId: string;
    path: string;
    mimeType: string;
    lastModified: number;
    blob: Blob;
}
function fileKey(assetId: string, path: string): string {
    return `${assetId}/${path}`;
}
export class AssetStore {
    static get supported(): boolean {
        return isIndexedDbSupported();
    }
    async loadAll(): Promise<LibraryAsset[]> {
        const db = await openEditorDatabase();
        const store = db.transaction(EDITOR_STORES.assets, 'readonly').objectStore(EDITOR_STORES.assets);
        const records = await requestToPromise(store.getAll() as IDBRequest<LibraryAsset[]>);
        return records.sort((a, b) => a.createdAt - b.createdAt);
    }
    async saveSnapshot({ asset, files }: AssetSnapshot): Promise<void> {
        await withTransaction([EDITOR_STORES.assets, EDITOR_STORES.assetFiles], 'readwrite', (transaction) => {
            transaction.objectStore(EDITOR_STORES.assets).put(asset);
            const fileStore = transaction.objectStore(EDITOR_STORES.assetFiles);
            for (const file of files) {
                const record: StoredAssetFile = { key: fileKey(asset.id, file.name), assetId: asset.id, path: file.name, mimeType: file.type, lastModified: file.lastModified, blob: file };
                fileStore.put(record);
            }
        });
    }
    async saveMetadata(asset: LibraryAsset): Promise<void> {
        await withTransaction(EDITOR_STORES.assets, 'readwrite', (transaction) => {
            transaction.objectStore(EDITOR_STORES.assets).put(asset);
        });
    }
    async loadFiles(assetId: string): Promise<File[]> {
        const db = await openEditorDatabase();
        const index = db.transaction(EDITOR_STORES.assetFiles, 'readonly').objectStore(EDITOR_STORES.assetFiles).index(ASSET_FILES_BY_ASSET_INDEX);
        const records = await requestToPromise(index.getAll(assetId) as IDBRequest<StoredAssetFile[]>);
        return records.map((record) => new File([record.blob], record.path, { type: record.mimeType, lastModified: record.lastModified }));
    }
    async remove(assetId: string): Promise<void> {
        const db = await openEditorDatabase();
        const fileKeys = await requestToPromise(db.transaction(EDITOR_STORES.assetFiles, 'readonly').objectStore(EDITOR_STORES.assetFiles).index(ASSET_FILES_BY_ASSET_INDEX).getAllKeys(assetId) as IDBRequest<IDBValidKey[]>);
        await withTransaction([EDITOR_STORES.assets, EDITOR_STORES.assetFiles], 'readwrite', (transaction) => {
            transaction.objectStore(EDITOR_STORES.assets).delete(assetId);
            const fileStore = transaction.objectStore(EDITOR_STORES.assetFiles);
            for (const key of fileKeys)
                fileStore.delete(key);
        });
    }
}
