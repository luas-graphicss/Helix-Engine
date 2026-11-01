import { PROJECT_STORES, type ProjectDatabase } from '@/engine/core/storage/project-database';
export type JsonValue = string | number | boolean | null | JsonValue[] | {
    [key: string]: JsonValue;
};
export const DEFAULT_SAVE_SLOT = 'default';
interface StoredSave {
    readonly key: string;
    readonly slot: string;
    readonly name: string;
    readonly value: JsonValue;
    readonly savedAt: number;
}
function saveKey(slot: string, name: string): string {
    return `${slot}/${name}`;
}
export class GameSaveStore {
    private readonly cache = new Map<string, Map<string, StoredSave>>();
    private loaded: Promise<void> | null = null;
    constructor(private readonly database: ProjectDatabase) { }
    load(): Promise<void> {
        if (!this.loaded) {
            this.loaded = this.database
                .getAll<StoredSave>(PROJECT_STORES.saves)
                .then((rows) => {
                for (const row of rows)
                    this.slotMap(row.slot).set(row.name, row);
            })
                .catch(() => {
            });
        }
        return this.loaded;
    }
    private slotMap(slot: string): Map<string, StoredSave> {
        let map = this.cache.get(slot);
        if (!map) {
            map = new Map();
            this.cache.set(slot, map);
        }
        return map;
    }
    get(slot: string, name: string): JsonValue | undefined {
        return this.cache.get(slot)?.get(name)?.value;
    }
    has(slot: string, name: string): boolean {
        return this.cache.get(slot)?.has(name) ?? false;
    }
    keys(slot: string): string[] {
        return [...(this.cache.get(slot)?.keys() ?? [])];
    }
    slots(): string[] {
        return [...this.cache.keys()].filter((slot) => (this.cache.get(slot)?.size ?? 0) > 0);
    }
    async set(slot: string, name: string, value: JsonValue): Promise<void> {
        const row: StoredSave = { key: saveKey(slot, name), slot, name, value, savedAt: Date.now() };
        this.slotMap(slot).set(name, row);
        await this.database.put(PROJECT_STORES.saves, row);
    }
    async remove(slot: string, name: string): Promise<boolean> {
        const existed = this.slotMap(slot).delete(name);
        if (existed)
            await this.database.delete(PROJECT_STORES.saves, saveKey(slot, name));
        return existed;
    }
    async clear(slot: string): Promise<void> {
        const map = this.cache.get(slot);
        if (!map || map.size === 0)
            return;
        const keys = [...map.values()].map((row) => row.key);
        map.clear();
        await this.database.withTransaction(PROJECT_STORES.saves, 'readwrite', (transaction) => {
            const store = transaction.objectStore(PROJECT_STORES.saves);
            for (const key of keys)
                store.delete(key);
        });
    }
    snapshot(slot: string): Record<string, JsonValue> {
        const out: Record<string, JsonValue> = {};
        for (const [name, row] of this.cache.get(slot) ?? [])
            out[name] = row.value;
        return out;
    }
    async restore(slot: string, values: Record<string, JsonValue>): Promise<void> {
        await this.clear(slot);
        const rows: StoredSave[] = Object.entries(values).map(([name, value]) => ({ key: saveKey(slot, name), slot, name, value, savedAt: Date.now() }));
        const map = this.slotMap(slot);
        for (const row of rows)
            map.set(row.name, row);
        await this.database.withTransaction(PROJECT_STORES.saves, 'readwrite', (transaction) => {
            const store = transaction.objectStore(PROJECT_STORES.saves);
            for (const row of rows)
                store.put(row);
        });
    }
}
