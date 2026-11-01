import { requestToPromise } from '@/engine/core/storage/indexed-db';
import { PROJECT_STORES, type ProjectDatabase } from '@/engine/core/storage/project-database';
import { engineSettings } from '@/engine/settings/engine-settings-store';
import { isSceneJson, type SceneDocument } from './scene-document/scene-document';
const STORE = PROJECT_STORES.scenes;
const CURRENT_KEY = 'current';
const SNAPSHOT_PREFIX = 'snapshot:';
interface StoredScene {
    key: string;
    savedAt: number;
    document: SceneDocument;
}
export interface SceneSnapshotInfo {
    key: string;
    savedAt: number;
}
function isStoredScene(value: unknown): value is StoredScene {
    if (typeof value !== 'object' || value === null)
        return false;
    const record = value as Partial<StoredScene>;
    return typeof record.key === 'string' && typeof record.document === 'object' && record.document !== null && isSceneJson(record.document.json);
}
export class SceneStore {
    constructor(private readonly database: ProjectDatabase) { }
    async loadCurrent(): Promise<SceneDocument | null> {
        const stored = await this.database.get<unknown>(STORE, CURRENT_KEY);
        if (stored === undefined)
            return null;
        if (!isStoredScene(stored))
            throw new Error('A cena gravada está num formato irreconhecível.');
        return stored.document;
    }
    async saveCurrent(document: SceneDocument): Promise<void> {
        const savedAt = document.json.savedAt;
        const snapshotIntervalMs = engineSettings.get('project.snapshots.interval') * 60 * 1000;
        const maxSnapshots = engineSettings.get('project.snapshots.max');
        await this.database.withTransaction(STORE, 'readwrite', (transaction) => {
            const store = transaction.objectStore(STORE);
            const request = store.getAllKeys() as IDBRequest<IDBValidKey[]>;
            request.onsuccess = () => {
                const snapshotTimes = request.result
                    .filter((key): key is string => typeof key === 'string' && key.startsWith(SNAPSHOT_PREFIX))
                    .map((key) => Number(key.slice(SNAPSHOT_PREFIX.length)))
                    .filter(Number.isFinite)
                    .sort((a, b) => a - b);
                const newest = snapshotTimes.at(-1) ?? -Infinity;
                const current = store.get(CURRENT_KEY) as IDBRequest<StoredScene | undefined>;
                current.onsuccess = () => {
                    const previous = current.result;
                    if (previous && isStoredScene(previous) && previous.savedAt - newest >= snapshotIntervalMs) {
                        store.put({ key: `${SNAPSHOT_PREFIX}${previous.savedAt}`, savedAt: previous.savedAt, document: previous.document } satisfies StoredScene);
                        snapshotTimes.push(previous.savedAt);
                    }
                    while (snapshotTimes.length > maxSnapshots) {
                        const oldest = snapshotTimes.shift();
                        if (oldest !== undefined)
                            store.delete(`${SNAPSHOT_PREFIX}${oldest}`);
                    }
                    store.put({ key: CURRENT_KEY, savedAt, document } satisfies StoredScene);
                };
            };
        });
    }
    async listSnapshots(): Promise<SceneSnapshotInfo[]> {
        const db = await this.database.open();
        const keys = await requestToPromise(db.transaction(STORE, 'readonly').objectStore(STORE).getAllKeys() as IDBRequest<IDBValidKey[]>);
        return keys
            .filter((key): key is string => typeof key === 'string' && key.startsWith(SNAPSHOT_PREFIX))
            .map((key) => ({ key, savedAt: Number(key.slice(SNAPSHOT_PREFIX.length)) }))
            .filter((info) => Number.isFinite(info.savedAt))
            .sort((a, b) => b.savedAt - a.savedAt);
    }
    async loadSnapshot(key: string): Promise<SceneDocument | null> {
        const stored = await this.database.get<unknown>(STORE, key);
        return isStoredScene(stored) ? stored.document : null;
    }
    async restoreSnapshot(key: string): Promise<SceneDocument> {
        const document = await this.loadSnapshot(key);
        if (!document)
            throw new Error('Este instantâneo não existe mais.');
        await this.database.withTransaction(STORE, 'readwrite', (transaction) => {
            const store = transaction.objectStore(STORE);
            const current = store.get(CURRENT_KEY) as IDBRequest<StoredScene | undefined>;
            current.onsuccess = () => {
                const previous = current.result;
                if (previous && isStoredScene(previous)) {
                    store.put({ key: `${SNAPSHOT_PREFIX}${previous.savedAt}`, savedAt: previous.savedAt, document: previous.document } satisfies StoredScene);
                }
                store.put({ key: CURRENT_KEY, savedAt: Date.now(), document } satisfies StoredScene);
            };
        });
        return document;
    }
}
