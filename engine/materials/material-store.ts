import { EDITOR_STORES, isIndexedDbSupported, openEditorDatabase, requestToPromise, withTransaction } from '@/engine/core/storage/editor-database';
import type { StoredMaterial } from './material-serialization';
const STORE_NAME = EDITOR_STORES.materials;
export class MaterialStore {
    static get supported(): boolean {
        return isIndexedDbSupported();
    }
    async loadAll(): Promise<StoredMaterial[]> {
        const db = await openEditorDatabase();
        const store = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME);
        const records = await requestToPromise(store.getAll() as IDBRequest<StoredMaterial[]>);
        return records.sort((a, b) => a.createdAt - b.createdAt);
    }
    async save(record: StoredMaterial): Promise<void> {
        await withTransaction(STORE_NAME, 'readwrite', (transaction) => {
            transaction.objectStore(STORE_NAME).put(record);
        });
    }
    async remove(id: string): Promise<void> {
        await withTransaction(STORE_NAME, 'readwrite', (transaction) => {
            transaction.objectStore(STORE_NAME).delete(id);
        });
    }
}
