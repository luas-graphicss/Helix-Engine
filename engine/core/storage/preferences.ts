import { requestToPromise } from './indexed-db';
import { getUserDatabase, USER_STORES } from './user-database';
type PreferenceRecord = {
    key: string;
    value: unknown;
};
export async function readPreference<T>(key: string): Promise<T | null> {
    const database = getUserDatabase();
    if (!database)
        return null;
    try {
        const record = await database.withTransaction(USER_STORES.preferences, 'readonly', (transaction) => requestToPromise(transaction.objectStore(USER_STORES.preferences).get(key) as IDBRequest<PreferenceRecord | undefined>));
        return ((await record)?.value as T | undefined) ?? null;
    }
    catch {
        return null;
    }
}
export async function writePreference(key: string, value: unknown): Promise<void> {
    const database = getUserDatabase();
    if (!database)
        return;
    try {
        await database.put(USER_STORES.preferences, { key, value } satisfies PreferenceRecord);
    }
    catch {
    }
}
