import { BrowserDatabase } from './indexed-db';
export const LEGACY_EDITOR_DATABASE_NAME = 'helix-editor';
const PROJECT_DATABASE_VERSION = 5;
export const PROJECT_STORES = {
    materials: 'materials',
    assets: 'assets',
    assetFiles: 'asset-files',
    scenes: 'scenes',
    preferences: 'preferences',
    saves: 'saves',
} as const;
export const SAVES_BY_SLOT_INDEX = 'bySlot';
export const ASSET_FILES_BY_ASSET_INDEX = 'byAsset';
export function projectDatabaseName(projectId: string): string {
    return `helix-project-${projectId}`;
}
function upgradeProjectDatabase(db: IDBDatabase): void {
    if (!db.objectStoreNames.contains(PROJECT_STORES.materials))
        db.createObjectStore(PROJECT_STORES.materials, { keyPath: 'id' });
    if (!db.objectStoreNames.contains(PROJECT_STORES.assets))
        db.createObjectStore(PROJECT_STORES.assets, { keyPath: 'id' });
    if (!db.objectStoreNames.contains(PROJECT_STORES.assetFiles)) {
        const files = db.createObjectStore(PROJECT_STORES.assetFiles, { keyPath: 'key' });
        files.createIndex(ASSET_FILES_BY_ASSET_INDEX, 'assetId', { unique: false });
    }
    if (!db.objectStoreNames.contains(PROJECT_STORES.scenes))
        db.createObjectStore(PROJECT_STORES.scenes, { keyPath: 'key' });
    if (!db.objectStoreNames.contains(PROJECT_STORES.preferences))
        db.createObjectStore(PROJECT_STORES.preferences, { keyPath: 'key' });
    if (!db.objectStoreNames.contains(PROJECT_STORES.saves)) {
        const saves = db.createObjectStore(PROJECT_STORES.saves, { keyPath: 'key' });
        saves.createIndex(SAVES_BY_SLOT_INDEX, 'slot', { unique: false });
    }
}
export class ProjectDatabase extends BrowserDatabase {
    constructor(name: string) {
        super(name, PROJECT_DATABASE_VERSION, upgradeProjectDatabase);
    }
}
