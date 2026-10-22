const DATABASE_NAME = 'helix-editor';
const DATABASE_VERSION = 3;
export const EDITOR_STORES = {
    materials: 'materials',
    assets: 'assets',
    assetFiles: 'asset-files',
    preferences: 'preferences',
} as const;
export const ASSET_FILES_BY_ASSET_INDEX = 'byAsset';
let connection: Promise<IDBDatabase> | null = null;
export function isIndexedDbSupported(): boolean {
    return typeof indexedDB !== 'undefined';
}
function upgrade(db: IDBDatabase): void {
    if (!db.objectStoreNames.contains(EDITOR_STORES.materials))
        db.createObjectStore(EDITOR_STORES.materials, { keyPath: 'id' });
    if (!db.objectStoreNames.contains(EDITOR_STORES.assets))
        db.createObjectStore(EDITOR_STORES.assets, { keyPath: 'id' });
    if (!db.objectStoreNames.contains(EDITOR_STORES.assetFiles)) {
        const files = db.createObjectStore(EDITOR_STORES.assetFiles, { keyPath: 'key' });
        files.createIndex(ASSET_FILES_BY_ASSET_INDEX, 'assetId', { unique: false });
    }
    if (!db.objectStoreNames.contains(EDITOR_STORES.preferences))
        db.createObjectStore(EDITOR_STORES.preferences, { keyPath: 'key' });
}
export function openEditorDatabase(): Promise<IDBDatabase> {
    if (!connection) {
        connection = new Promise((resolve, reject) => {
            const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
            request.onupgradeneeded = () => upgrade(request.result);
            request.onsuccess = () => {
                const db = request.result;
                db.onversionchange = () => {
                    db.close();
                    connection = null;
                };
                resolve(db);
            };
            request.onerror = () => reject(request.error ?? new Error('Não foi possível abrir o banco do editor.'));
            request.onblocked = () => reject(new Error('O banco do editor está bloqueado por outra aba.'));
        });
        connection.catch(() => {
            connection = null;
        });
    }
    return connection;
}
export function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('Falha na operação do IndexedDB.'));
    });
}
export function transactionDone(transaction: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error ?? new Error('Falha na transação do IndexedDB.'));
        transaction.onabort = () => reject(transaction.error ?? new Error('Transação do IndexedDB abortada.'));
    });
}
export async function withTransaction<T>(stores: string | string[], mode: IDBTransactionMode, run: (transaction: IDBTransaction) => T): Promise<T> {
    const db = await openEditorDatabase();
    const transaction = db.transaction(stores, mode);
    const result = run(transaction);
    await transactionDone(transaction);
    return result;
}
