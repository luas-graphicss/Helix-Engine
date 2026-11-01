import { requestToPromise } from '@/engine/core/storage/indexed-db';
import { ASSET_FILES_BY_ASSET_INDEX, PROJECT_STORES, type ProjectDatabase } from '@/engine/core/storage/project-database';
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
    constructor(private readonly database: ProjectDatabase) { }
    async loadAll(): Promise<LibraryAsset[]> {
        const records = await this.database.getAll<LibraryAsset>(PROJECT_STORES.assets);
        return records.sort((a, b) => a.createdAt - b.createdAt);
    }
    async load(assetId: string): Promise<LibraryAsset | null> {
        return (await this.database.get<LibraryAsset>(PROJECT_STORES.assets, assetId)) ?? null;
    }
    async saveSnapshot({ asset, files }: AssetSnapshot): Promise<void> {
        await this.database.withTransaction([PROJECT_STORES.assets, PROJECT_STORES.assetFiles], 'readwrite', (transaction) => {
            transaction.objectStore(PROJECT_STORES.assets).put(asset);
            const fileStore = transaction.objectStore(PROJECT_STORES.assetFiles);
            for (const file of files) {
                const record: StoredAssetFile = { key: fileKey(asset.id, file.name), assetId: asset.id, path: file.name, mimeType: file.type, lastModified: file.lastModified, blob: file };
                fileStore.put(record);
            }
        });
    }
    async saveMetadata(asset: LibraryAsset): Promise<void> {
        await this.database.put(PROJECT_STORES.assets, asset);
    }
    async loadFiles(assetId: string): Promise<File[]> {
        const db = await this.database.open();
        const index = db.transaction(PROJECT_STORES.assetFiles, 'readonly').objectStore(PROJECT_STORES.assetFiles).index(ASSET_FILES_BY_ASSET_INDEX);
        const records = await requestToPromise(index.getAll(assetId) as IDBRequest<StoredAssetFile[]>);
        return records.map((record) => new File([record.blob], record.path, { type: record.mimeType, lastModified: record.lastModified }));
    }
    async remove(assetId: string): Promise<void> {
        const db = await this.database.open();
        const fileKeys = await requestToPromise(db.transaction(PROJECT_STORES.assetFiles, 'readonly').objectStore(PROJECT_STORES.assetFiles).index(ASSET_FILES_BY_ASSET_INDEX).getAllKeys(assetId) as IDBRequest<IDBValidKey[]>);
        await this.database.withTransaction([PROJECT_STORES.assets, PROJECT_STORES.assetFiles], 'readwrite', (transaction) => {
            transaction.objectStore(PROJECT_STORES.assets).delete(assetId);
            const fileStore = transaction.objectStore(PROJECT_STORES.assetFiles);
            for (const key of fileKeys)
                fileStore.delete(key);
        });
    }
}
