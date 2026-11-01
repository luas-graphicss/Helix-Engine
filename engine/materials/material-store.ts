import { PROJECT_STORES, type ProjectDatabase } from '@/engine/core/storage/project-database';
import type { StoredMaterial } from './material-serialization';
const STORE_NAME = PROJECT_STORES.materials;
export class MaterialStore {
    constructor(private readonly database: ProjectDatabase) { }
    async loadAll(): Promise<StoredMaterial[]> {
        const records = await this.database.getAll<StoredMaterial>(STORE_NAME);
        return records.sort((a, b) => a.createdAt - b.createdAt);
    }
    async save(record: StoredMaterial): Promise<void> {
        await this.database.put(STORE_NAME, record);
    }
    async remove(id: string): Promise<void> {
        await this.database.delete(STORE_NAME, id);
    }
}
