import { BrowserDatabase, isIndexedDbSupported } from './indexed-db';
const USER_DATABASE_NAME = 'helix-user';
const USER_DATABASE_VERSION = 3;
export const USER_STORES = {
    projects: 'projects',
    preferences: 'preferences',
} as const;
const LEGACY_THUMBNAILS_STORE = 'thumbnails';
function upgradeUserDatabase(db: IDBDatabase): void {
    if (!db.objectStoreNames.contains(USER_STORES.projects))
        db.createObjectStore(USER_STORES.projects, { keyPath: 'id' });
    if (!db.objectStoreNames.contains(USER_STORES.preferences))
        db.createObjectStore(USER_STORES.preferences, { keyPath: 'key' });
    if (db.objectStoreNames.contains(LEGACY_THUMBNAILS_STORE))
        db.deleteObjectStore(LEGACY_THUMBNAILS_STORE);
}
let userDatabase: BrowserDatabase | null = null;
export function getUserDatabase(): BrowserDatabase | null {
    if (!isIndexedDbSupported())
        return null;
    if (!userDatabase)
        userDatabase = new BrowserDatabase(USER_DATABASE_NAME, USER_DATABASE_VERSION, upgradeUserDatabase);
    return userDatabase;
}
