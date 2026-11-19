import type { EditorSession } from '@/engine/editor/session/editor-session';
import type { VfxGraphDocument } from '@/engine/vfx-graph/document/effect-document';
import { VfxGraphStore, type StoredVfxGraph } from '@/engine/vfx-graph/storage/vfx-graph-store';
const LOG_SOURCE = 'Visual Effect Graph';
const SAVE_DELAY_MS = 500;
function describeError(cause: unknown): string {
    return cause instanceof Error ? cause.message : String(cause);
}
export class EffectGraphRecords {
    private readonly records = new Map<string, StoredVfxGraph>();
    private readonly saveTimers = new Map<string, ReturnType<typeof setTimeout>>();
    private store: VfxGraphStore | null = null;
    constructor(private readonly session: EditorSession) { }
    get all(): StoredVfxGraph[] {
        return Array.from(this.records.values()).sort((a, b) => a.createdAt - b.createdAt);
    }
    get(id: string | null): StoredVfxGraph | null {
        return id ? (this.records.get(id) ?? null) : null;
    }
    async load(): Promise<void> {
        const store = new VfxGraphStore(this.session.project.database);
        this.store = store;
        try {
            for (const record of await store.loadAll())
                this.records.set(record.id, record);
        }
        catch (cause) {
            this.session.log.error(LOG_SOURCE, `Não foi possível carregar os grafos de efeito: ${describeError(cause)}`);
        }
        const flush = () => this.flush();
        window.addEventListener('pagehide', flush);
        this.session.onDispose(() => {
            window.removeEventListener('pagehide', flush);
            this.flush();
        });
    }
    create(name: string, graph: VfxGraphDocument): StoredVfxGraph {
        const now = Date.now();
        const record: StoredVfxGraph = { id: crypto.randomUUID(), name: this.uniqueName(name, null), createdAt: now, updatedAt: now, graph };
        this.keep(record);
        return record;
    }
    replaceGraph(id: string, graph: VfxGraphDocument): boolean {
        const record = this.records.get(id);
        if (!record)
            return false;
        this.keep({ ...record, graph, updatedAt: Date.now() });
        return true;
    }
    rename(id: string, name: string): boolean {
        const record = this.records.get(id);
        const trimmed = name.trim();
        if (!record || trimmed === '' || trimmed === record.name)
            return false;
        this.keep({ ...record, name: this.uniqueName(trimmed, id), updatedAt: Date.now() });
        return true;
    }
    remove(id: string): boolean {
        if (!this.records.delete(id))
            return false;
        clearTimeout(this.saveTimers.get(id));
        this.saveTimers.delete(id);
        void this.store?.remove(id).catch((cause: unknown) => this.session.log.error(LOG_SOURCE, `Não foi possível excluir o grafo de efeito: ${describeError(cause)}`));
        return true;
    }
    flush(): void {
        for (const [id, timer] of this.saveTimers) {
            clearTimeout(timer);
            this.save(id);
        }
        this.saveTimers.clear();
    }
    private uniqueName(name: string, ownId: string | null): string {
        const taken = new Set(this.all.filter((record) => record.id !== ownId).map((record) => record.name));
        if (!taken.has(name))
            return name;
        let suffix = 2;
        while (taken.has(`${name} ${suffix}`))
            suffix++;
        return `${name} ${suffix}`;
    }
    private keep(record: StoredVfxGraph): void {
        this.records.set(record.id, record);
        clearTimeout(this.saveTimers.get(record.id));
        this.saveTimers.set(record.id, setTimeout(() => {
            this.saveTimers.delete(record.id);
            this.save(record.id);
        }, SAVE_DELAY_MS));
    }
    private save(id: string): void {
        const record = this.records.get(id);
        if (!record || !this.store)
            return;
        void this.store.save(record).catch((cause: unknown) => this.session.log.error(LOG_SOURCE, `Não foi possível salvar ${record.name}: ${describeError(cause)}`));
    }
}
