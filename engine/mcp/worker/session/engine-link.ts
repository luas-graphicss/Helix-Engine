import type { EngineIdentity, HelloRequest } from '@/engine/mcp/protocol/bridge-messages';
import { isRecord, isText } from '@/engine/mcp/protocol/json-shape';
import { parseToolDescriptor, type ToolDescriptor } from '@/engine/mcp/protocol/tool-descriptor';
import type { DurableObjectStorage } from '@/engine/mcp/worker/runtime/durable-object-types';
const CATALOG_STORAGE_KEY = 'catalog';
export type PeerStanding = 'current' | 'replaced' | 'unknown';
export interface EngineCatalog {
    readonly engine: EngineIdentity;
    readonly accessMode: string;
    readonly tools: readonly ToolDescriptor[];
}
function parseStoredCatalog(value: unknown): EngineCatalog | null {
    if (!isRecord(value) || !isRecord(value.engine) || !Array.isArray(value.tools))
        return null;
    const { name, version, project } = value.engine;
    const { accessMode } = value;
    if (!isText(name) || !isText(version) || !isText(project) || !isText(accessMode))
        return null;
    const tools = value.tools.map(parseToolDescriptor).filter((tool) => tool !== null);
    return { engine: { name, version, project }, accessMode, tools };
}
export class EngineLink {
    private peer: string | null = null;
    private lastContactAt = 0;
    private storedCatalog: EngineCatalog | null = null;
    constructor(private readonly storage: DurableObjectStorage) { }
    get catalog(): EngineCatalog | null {
        return this.storedCatalog;
    }
    get tools(): readonly ToolDescriptor[] {
        return this.storedCatalog?.tools ?? [];
    }
    get connected(): boolean {
        return this.peer !== null;
    }
    get lastContactAgeMs(): number | null {
        return this.lastContactAt === 0 ? null : Date.now() - this.lastContactAt;
    }
    async restore(): Promise<void> {
        this.storedCatalog = parseStoredCatalog(await this.storage.get(CATALOG_STORAGE_KEY));
    }
    async register(hello: HelloRequest): Promise<{
        readonly replacedPeer: boolean;
    }> {
        const replacedPeer = this.peer !== null && this.peer !== hello.peer;
        this.peer = hello.peer;
        this.lastContactAt = Date.now();
        this.storedCatalog = { engine: hello.engine, accessMode: hello.accessMode, tools: hello.tools };
        await this.storage.put(CATALOG_STORAGE_KEY, this.storedCatalog);
        return { replacedPeer };
    }
    standingOf(peer: string): PeerStanding {
        if (this.peer === null)
            return 'unknown';
        return this.peer === peer ? 'current' : 'replaced';
    }
    touch(): void {
        this.lastContactAt = Date.now();
    }
    release(peer: string): boolean {
        if (this.peer !== peer)
            return false;
        this.peer = null;
        return true;
    }
    findTool(name: string): ToolDescriptor | undefined {
        return this.tools.find((tool) => tool.name === name);
    }
}
