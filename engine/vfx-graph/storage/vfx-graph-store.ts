import { PROJECT_STORES, type ProjectDatabase } from '@/engine/core/storage/project-database';
import type { VfxGraphDocument } from '../document/effect-document';
import { parseEffectGraph } from '../document/effect-serialization';
const STORE_NAME = PROJECT_STORES.vfxGraphs;
export interface StoredVfxGraph {
    readonly id: string;
    readonly name: string;
    readonly createdAt: number;
    readonly updatedAt: number;
    readonly graph: VfxGraphDocument;
}
function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function parseStoredGraph(value: unknown): StoredVfxGraph | null {
    if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string')
        return null;
    if (typeof value.createdAt !== 'number' || typeof value.updatedAt !== 'number')
        return null;
    const graph = parseEffectGraph(value.graph);
    return graph ? { id: value.id, name: value.name, createdAt: value.createdAt, updatedAt: value.updatedAt, graph } : null;
}
export class VfxGraphStore {
    constructor(private readonly database: ProjectDatabase) { }
    async loadAll(): Promise<StoredVfxGraph[]> {
        const records = await this.database.getAll<unknown>(STORE_NAME);
        return records.flatMap((record) => parseStoredGraph(record) ?? []).sort((a, b) => a.createdAt - b.createdAt);
    }
    async save(record: StoredVfxGraph): Promise<void> {
        await this.database.put(STORE_NAME, record);
    }
    async remove(id: string): Promise<void> {
        await this.database.delete(STORE_NAME, id);
    }
}
