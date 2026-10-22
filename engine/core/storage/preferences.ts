import { EDITOR_STORES, isIndexedDbSupported, requestToPromise, withTransaction } from './editor-database';
type PreferenceRecord = {
    key: string;
    value: unknown;
};
export async function readPreference<T>(key: string): Promise<T | null> {
    if (!isIndexedDbSupported())
        return null;
    try {
        const record = await withTransaction(EDITOR_STORES.preferences, 'readonly', (transaction) => requestToPromise(transaction.objectStore(EDITOR_STORES.preferences).get(key) as IDBRequest<PreferenceRecord | undefined>));
        return ((await record)?.value as T | undefined) ?? null;
    }
    catch {
        return null;
    }
}
export async function writePreference(key: string, value: unknown): Promise<void> {
    if (!isIndexedDbSupported())
        return;
    try {
        await withTransaction(EDITOR_STORES.preferences, 'readwrite', (transaction) => {
            transaction.objectStore(EDITOR_STORES.preferences).put({ key, value } satisfies PreferenceRecord);
        });
    }
    catch {
    }
}
