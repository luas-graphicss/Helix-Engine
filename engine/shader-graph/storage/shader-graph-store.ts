import { PROJECT_STORES, type ProjectDatabase } from '@/engine/core/storage/project-database';
import type { ShaderGraphDocument } from '../document/graph-document';
import { isRecord, parseShaderGraph } from '../document/graph-serialization';
const STORE_NAME = PROJECT_STORES.shaderGraphs;
export interface StoredShaderGraph {
    readonly id: string;
    readonly name: string;
    readonly createdAt: number;
    readonly updatedAt: number;
    readonly exportedAssetId: string | null;
    readonly graph: ShaderGraphDocument;
}
function parseStoredGraph(value: unknown): StoredShaderGraph | null {
    if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string')
        return null;
    if (typeof value.createdAt !== 'number' || typeof value.updatedAt !== 'number')
        return null;
    const graph = parseShaderGraph(value.graph);
    if (!graph)
        return null;
    const exportedAssetId = typeof value.exportedAssetId === 'string' ? value.exportedAssetId : null;
    return { id: value.id, name: value.name, createdAt: value.createdAt, updatedAt: value.updatedAt, exportedAssetId, graph };
}
export class ShaderGraphStore {
    constructor(private readonly database: ProjectDatabase) { }
    async loadAll(): Promise<StoredShaderGraph[]> {
        const records = await this.database.getAll<unknown>(STORE_NAME);
        const graphs: StoredShaderGraph[] = [];
        for (const record of records) {
            const graph = parseStoredGraph(record);
            if (graph)
                graphs.push(graph);
        }
        return graphs.sort((a, b) => a.createdAt - b.createdAt);
    }
    async save(record: StoredShaderGraph): Promise<void> {
        await this.database.put(STORE_NAME, record);
    }
    async remove(id: string): Promise<void> {
        await this.database.delete(STORE_NAME, id);
    }
}
