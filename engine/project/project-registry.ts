import { deleteDatabase, listDatabaseNames, requestToPromise } from '@/engine/core/storage/indexed-db';
import { LEGACY_EDITOR_DATABASE_NAME, PROJECT_STORES, ProjectDatabase } from '@/engine/core/storage/project-database';
import { getUserDatabase, USER_STORES } from '@/engine/core/storage/user-database';
import { createProjectRecord, createProjectStats, normalizeProjectName, type ProjectRecord, type ProjectTemplateId } from './project-record';
export type ProjectRegistryStatus = 'idle' | 'loading' | 'ready' | 'unavailable';
type Listener = () => void;
const LEGACY_PROJECT_NAME = 'Projeto recuperado';
function errorMessage(cause: unknown): string {
    return cause instanceof Error ? cause.message : String(cause);
}
function upgradeRecord(record: ProjectRecord): ProjectRecord {
    return {
        ...record,
        deletedAt: record.deletedAt ?? null,
        thumbnail: record.thumbnail ?? null,
        stats: { ...createProjectStats(), ...record.stats },
        openedAt: record.openedAt ?? record.updatedAt ?? record.createdAt,
    };
}
export class ProjectRegistry {
    private readonly records = new Map<string, ProjectRecord>();
    private readonly database = getUserDatabase();
    private readonly listeners = new Set<Listener>();
    private version = 0;
    status: ProjectRegistryStatus = 'idle';
    error: string | null = null;
    subscribe = (listener: Listener): (() => void) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    };
    getVersion = (): number => this.version;
    get active(): ProjectRecord[] {
        return Array.from(this.records.values())
            .filter((record) => record.deletedAt === null)
            .sort((a, b) => b.openedAt - a.openedAt);
    }
    get trashed(): ProjectRecord[] {
        return Array.from(this.records.values())
            .filter((record) => record.deletedAt !== null)
            .sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0));
    }
    get(id: string): ProjectRecord | null {
        return this.records.get(id) ?? null;
    }
    private loading: Promise<void> | null = null;
    load(): Promise<void> {
        if (this.status === 'ready' || this.status === 'unavailable')
            return Promise.resolve();
        if (!this.loading) {
            this.loading = this.performLoad().finally(() => {
                this.loading = null;
            });
        }
        return this.loading;
    }
    private async performLoad(): Promise<void> {
        if (!this.database) {
            this.status = 'unavailable';
            this.error = 'Este navegador não oferece IndexedDB: os projetos não podem ser guardados.';
            this.notify();
            return;
        }
        this.status = 'loading';
        this.notify();
        try {
            for (const stored of await this.database.getAll<ProjectRecord>(USER_STORES.projects)) {
                const record = upgradeRecord(stored);
                this.records.set(record.id, record);
            }
            await this.adoptLegacyDatabase();
            this.status = 'ready';
            this.error = null;
        }
        catch (cause) {
            this.status = 'unavailable';
            this.error = `Não foi possível abrir o registro de projetos: ${errorMessage(cause)}`;
        }
        this.notify();
    }
    async create(template: ProjectTemplateId, name?: string): Promise<ProjectRecord> {
        const record = createProjectRecord(template, name);
        await new ProjectDatabase(record.databaseName).open();
        await this.save(record);
        return record;
    }
    async register(record: ProjectRecord): Promise<void> {
        await this.save(record);
    }
    async rename(id: string, name: string): Promise<void> {
        const record = this.records.get(id);
        if (!record)
            return;
        const normalized = normalizeProjectName(name);
        if (normalized === record.name)
            return;
        await this.save({ ...record, name: normalized, updatedAt: Date.now() });
    }
    async touchSaved(id: string, patch: Partial<Pick<ProjectRecord, 'stats' | 'thumbnail'>>): Promise<void> {
        const record = this.records.get(id);
        if (!record)
            return;
        await this.save({ ...record, ...patch, updatedAt: Date.now() });
    }
    async touchOpened(id: string): Promise<void> {
        const record = this.records.get(id);
        if (!record)
            return;
        await this.save({ ...record, openedAt: Date.now() });
    }
    async trash(id: string): Promise<void> {
        const record = this.records.get(id);
        if (!record || record.deletedAt !== null)
            return;
        await this.save({ ...record, deletedAt: Date.now() });
    }
    async restore(id: string): Promise<void> {
        const record = this.records.get(id);
        if (!record || record.deletedAt === null)
            return;
        await this.save({ ...record, deletedAt: null, openedAt: Date.now() });
    }
    async purge(id: string): Promise<void> {
        const record = this.records.get(id);
        if (!record || !this.database)
            return;
        await deleteDatabase(record.databaseName);
        this.records.delete(id);
        this.notify();
        await this.persist(() => this.database?.delete(USER_STORES.projects, id), `remover "${record.name}" do registro`);
    }
    async emptyTrash(): Promise<void> {
        for (const record of this.trashed)
            await this.purge(record.id);
    }
    async duplicate(id: string): Promise<ProjectRecord | null> {
        const source = this.records.get(id);
        if (!source)
            return null;
        const copy = createProjectRecord(source.template, `${source.name} (cópia)`);
        copy.thumbnail = source.thumbnail;
        copy.stats = { ...source.stats };
        const from = new ProjectDatabase(source.databaseName);
        const to = new ProjectDatabase(copy.databaseName);
        try {
            for (const store of Object.values(PROJECT_STORES)) {
                const items = await from.getAll<unknown>(store);
                if (items.length === 0)
                    continue;
                await to.withTransaction(store, 'readwrite', (transaction) => {
                    const target = transaction.objectStore(store);
                    for (const item of items)
                        target.put(item);
                });
            }
        }
        finally {
            await from.close();
            await to.close();
        }
        await this.save(copy);
        return copy;
    }
    private notify(): void {
        this.version++;
        for (const listener of this.listeners)
            listener();
    }
    private async save(record: ProjectRecord): Promise<void> {
        this.records.set(record.id, record);
        this.notify();
        await this.persist(() => this.database?.put(USER_STORES.projects, record), `gravar "${record.name}"`);
    }
    private async persist(run: () => Promise<void> | undefined, what: string): Promise<void> {
        try {
            await run();
        }
        catch (cause) {
            this.error = `Não foi possível ${what} no registro de projetos: ${errorMessage(cause)}`;
            this.notify();
            throw cause;
        }
    }
    private async adoptLegacyDatabase(): Promise<void> {
        if (!this.database)
            return;
        for (const record of this.records.values())
            if (record.databaseName === LEGACY_EDITOR_DATABASE_NAME)
                return;
        const names = await listDatabaseNames();
        if (!names.includes(LEGACY_EDITOR_DATABASE_NAME))
            return;
        const record = createProjectRecord('baseplate', LEGACY_PROJECT_NAME);
        record.databaseName = LEGACY_EDITOR_DATABASE_NAME;
        const legacy = new ProjectDatabase(LEGACY_EDITOR_DATABASE_NAME);
        try {
            record.stats.assets = (await legacy.getAll<unknown>(PROJECT_STORES.assets)).length;
            record.stats.materials = (await legacy.getAll<unknown>(PROJECT_STORES.materials)).length;
            const preferences = await legacy.getAll<{
                key: string;
                value: unknown;
            }>(PROJECT_STORES.preferences);
            for (const preference of preferences) {
                const existing = await this.database.withTransaction(USER_STORES.preferences, 'readonly', (transaction) => requestToPromise(transaction.objectStore(USER_STORES.preferences).get(preference.key)));
                if ((await existing) === undefined)
                    await this.database.put(USER_STORES.preferences, preference);
            }
        }
        finally {
            await legacy.close();
        }
        await this.save(record);
    }
}
let registry: ProjectRegistry | null = null;
export function getProjectRegistry(): ProjectRegistry {
    if (!registry)
        registry = new ProjectRegistry();
    return registry;
}
