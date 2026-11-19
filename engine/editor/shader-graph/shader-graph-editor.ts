import { SetShaderGraphCommand, type ShaderGraphHost } from '@/engine/editor/commands/shader-graph-commands';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { compileShaderGraph, type CompiledGraph } from '@/engine/shader-graph/compiler/graph-compiler';
import { addNode, connect, disconnect, findNode, moveNodes, removeNodes, setNodeValue, type GraphNode, type GraphValue, type ShaderGraphDocument, type SocketRef, } from '@/engine/shader-graph/document/graph-document';
import { ShaderGraphStore, type StoredShaderGraph } from '@/engine/shader-graph/storage/shader-graph-store';
import { GraphShaderLink } from './graph-shader-link';
import { GraphTextureCache } from './graph-textures';
type Listener = () => void;
export type ShaderGraphStatus = 'idle' | 'loading' | 'ready';
export interface GraphView {
    readonly x: number;
    readonly y: number;
    readonly zoom: number;
}
export interface GraphViewportSize {
    readonly width: number;
    readonly height: number;
}
const LOG_SOURCE = 'Shader Graph';
const SAVE_DELAY_MS = 500;
const DEFAULT_VIEW: GraphView = { x: 40, y: 80, zoom: 1 };
const MOVE_MERGE_KEY = 'shader-graph-move';
function describeError(cause: unknown): string {
    return cause instanceof Error ? cause.message : String(cause);
}
export class ShaderGraphEditor implements ShaderGraphHost {
    status: ShaderGraphStatus = 'idle';
    activeId: string | null = null;
    selection: ReadonlySet<string> = new Set();
    compiled: CompiledGraph | null = null;
    view: GraphView = DEFAULT_VIEW;
    viewportSize: GraphViewportSize = { width: 0, height: 0 };
    readonly textures: GraphTextureCache;
    readonly link: GraphShaderLink;
    private readonly records = new Map<string, StoredShaderGraph>();
    private readonly saveTimers = new Map<string, ReturnType<typeof setTimeout>>();
    private readonly listeners = new Set<Listener>();
    private store: ShaderGraphStore | null = null;
    private version = 0;
    constructor(private readonly session: EditorSession) {
        this.textures = new GraphTextureCache(session, () => this.refreshLink());
        this.link = new GraphShaderLink(session, this.textures, () => this.notify());
    }
    readonly subscribe = (listener: Listener): (() => void) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    };
    readonly getVersion = (): number => this.version;
    get graphs(): StoredShaderGraph[] {
        return Array.from(this.records.values()).sort((a, b) => a.createdAt - b.createdAt);
    }
    get active(): StoredShaderGraph | null {
        return this.activeId ? (this.records.get(this.activeId) ?? null) : null;
    }
    get document(): ShaderGraphDocument | null {
        return this.active?.graph ?? null;
    }
    get selectedNode(): GraphNode | null {
        const { document, selection } = this;
        if (!document || selection.size !== 1)
            return null;
        const [id] = selection;
        return findNode(document, id);
    }
    async load(): Promise<void> {
        if (this.status !== 'idle')
            return;
        this.status = 'loading';
        this.notify();
        const store = new ShaderGraphStore(this.session.project.database);
        this.store = store;
        try {
            for (const record of await store.loadAll())
                this.records.set(record.id, record);
        }
        catch (cause) {
            this.session.log.error(LOG_SOURCE, `Não foi possível carregar os grafos de shader: ${describeError(cause)}`);
        }
        const flush = () => this.flush();
        window.addEventListener('pagehide', flush);
        this.session.onDispose(() => {
            window.removeEventListener('pagehide', flush);
            this.flush();
        });
        this.status = 'ready';
        this.activate(this.graphs.at(-1)?.id ?? null);
    }
    create(name: string, graph: ShaderGraphDocument): StoredShaderGraph {
        const now = Date.now();
        const record: StoredShaderGraph = { id: crypto.randomUUID(), name: this.uniqueName(name, null), createdAt: now, updatedAt: now, exportedAssetId: null, graph };
        this.keep(record);
        this.activate(record.id);
        return record;
    }
    open(id: string): void {
        if (id !== this.activeId && this.records.has(id))
            this.activate(id);
    }
    rename(name: string): void {
        const { active } = this;
        const trimmed = name.trim();
        if (!active || trimmed === '' || trimmed === active.name)
            return;
        this.keep({ ...active, name: this.uniqueName(trimmed, active.id), updatedAt: Date.now() });
        this.notify();
    }
    remove(id: string): void {
        if (!this.records.delete(id))
            return;
        const timer = this.saveTimers.get(id);
        if (timer)
            clearTimeout(timer);
        this.saveTimers.delete(id);
        this.link.detach(id);
        void this.store?.remove(id).catch((cause: unknown) => this.session.log.error(LOG_SOURCE, `Não foi possível excluir o grafo: ${describeError(cause)}`));
        if (this.activeId === id)
            this.activate(this.graphs.at(-1)?.id ?? null);
        else
            this.notify();
    }
    markExported(id: string, assetId: string): void {
        const record = this.records.get(id);
        if (!record || record.exportedAssetId === assetId)
            return;
        this.keep({ ...record, exportedAssetId: assetId });
        this.notify();
    }
    restoreGraph(graphId: string, graph: ShaderGraphDocument): void {
        const record = this.records.get(graphId);
        if (!record)
            return;
        this.keep({ ...record, graph, updatedAt: Date.now() });
        if (graphId === this.activeId) {
            this.selection = new Set(graph.nodes.filter((node) => this.selection.has(node.id)).map((node) => node.id));
            this.recompile();
        }
        this.notify();
    }
    select(nodeId: string, additive: boolean): void {
        if (!additive) {
            this.selection = new Set([nodeId]);
            this.notify();
            return;
        }
        const next = new Set(this.selection);
        if (!next.delete(nodeId))
            next.add(nodeId);
        this.selection = next;
        this.notify();
    }
    selectAll(): void {
        this.selection = new Set(this.document?.nodes.map((node) => node.id));
        this.notify();
    }
    clearSelection(): void {
        if (this.selection.size === 0)
            return;
        this.selection = new Set();
        this.notify();
    }
    addNode(type: string, x: number, y: number): void {
        const { active } = this;
        if (!active)
            return;
        const added = addNode(active.graph, type, x, y);
        this.apply('Adicionar nó ao grafo', () => added.document);
        this.selection = new Set([added.nodeId]);
        this.notify();
    }
    removeSelected(): void {
        const ids = this.selection;
        this.apply('Excluir nós do grafo', (graph) => removeNodes(graph, ids));
    }
    moveSelected(deltaX: number, deltaY: number): void {
        const ids = this.selection;
        this.apply('Mover nós do grafo', (graph) => moveNodes(graph, ids, deltaX, deltaY), MOVE_MERGE_KEY);
    }
    endGesture(): void {
        this.session.history.endMerge();
    }
    connect(from: SocketRef, to: SocketRef): void {
        this.apply('Ligar nós do grafo', (graph) => connect(graph, from, to));
    }
    disconnect(linkId: string): void {
        this.apply('Desligar nós do grafo', (graph) => disconnect(graph, linkId));
    }
    setValue(nodeId: string, key: string, value: GraphValue): void {
        this.apply('Editar nó do grafo', (graph) => setNodeValue(graph, nodeId, key, value), `shader-graph-value:${nodeId}:${key}`);
    }
    setView(view: GraphView): void {
        this.view = view;
        this.notify();
    }
    setViewportSize(size: GraphViewportSize): void {
        this.viewportSize = size;
    }
    flush(): void {
        for (const [id, timer] of this.saveTimers) {
            clearTimeout(timer);
            this.save(id);
        }
        this.saveTimers.clear();
    }
    private apply(label: string, update: (graph: ShaderGraphDocument) => ShaderGraphDocument, mergeKey?: string): void {
        const { active } = this;
        if (!active)
            return;
        const after = update(active.graph);
        if (after !== active.graph)
            this.session.history.execute(new SetShaderGraphCommand(this, label, active.id, active.graph, after, mergeKey));
    }
    private activate(id: string | null): void {
        this.activeId = id;
        this.selection = new Set();
        this.view = DEFAULT_VIEW;
        this.recompile();
        this.notify();
    }
    private recompile(): void {
        const { document } = this;
        this.compiled = document ? compileShaderGraph(document) : null;
        this.refreshLink();
    }
    private refreshLink(): void {
        const { active, compiled } = this;
        if (active && compiled)
            this.link.refresh(active, compiled);
    }
    private uniqueName(name: string, ownId: string | null): string {
        const taken = new Set(this.graphs.filter((record) => record.id !== ownId).map((record) => record.name));
        if (!taken.has(name))
            return name;
        let suffix = 2;
        while (taken.has(`${name} ${suffix}`))
            suffix++;
        return `${name} ${suffix}`;
    }
    private keep(record: StoredShaderGraph): void {
        this.records.set(record.id, record);
        const pending = this.saveTimers.get(record.id);
        if (pending)
            clearTimeout(pending);
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
    private notify(): void {
        this.version++;
        for (const listener of this.listeners)
            listener();
    }
}
