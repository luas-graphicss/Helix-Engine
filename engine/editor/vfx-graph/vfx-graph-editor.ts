import { SetVfxGraphCommand, type VfxGraphHost } from '@/engine/editor/commands/vfx-graph-commands';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { blockDefinition } from '@/engine/vfx-graph/blocks/block-catalog';
import { compileEffectGraph, type CompiledEffect } from '@/engine/vfx-graph/compiler/effect-compiler';
import type { BlockValue } from '@/engine/vfx-graph/document/block-values';
import { addBlock, findBlock, moveBlock, removeBlock, setBlockEnabled, setBlockValue } from '@/engine/vfx-graph/document/effect-blocks';
import { addContext, connectFlow, disconnectFlow, findContext, moveContexts, removeContexts, setContextValue, type ContextKind, type EffectBlock, type EffectContext, type VfxGraphDocument, } from '@/engine/vfx-graph/document/effect-document';
import { systemContexts, systemOf } from '@/engine/vfx-graph/document/effect-systems';
import type { StoredVfxGraph } from '@/engine/vfx-graph/storage/vfx-graph-store';
import { appendSystem } from '@/engine/vfx-graph/templates/effect-builder';
import { STARTER_SYSTEM } from '@/engine/vfx-graph/templates/starter-system';
import { EffectGraphRecords } from './effect-graph-records';
type Listener = () => void;
export type VfxGraphStatus = 'idle' | 'loading' | 'ready';
export interface CanvasView {
    readonly x: number;
    readonly y: number;
    readonly zoom: number;
}
export interface CanvasSize {
    readonly width: number;
    readonly height: number;
}
export interface BlockSelection {
    readonly contextId: string;
    readonly blockId: string;
}
const DEFAULT_VIEW: CanvasView = { x: 0, y: 0, zoom: 1 };
const MOVE_MERGE_KEY = 'vfx-graph-move';
const NO_CONTEXTS: ReadonlySet<string> = new Set();
export class VfxGraphEditor implements VfxGraphHost {
    status: VfxGraphStatus = 'idle';
    activeId: string | null = null;
    selectedContexts: ReadonlySet<string> = NO_CONTEXTS;
    selectedBlock: BlockSelection | null = null;
    compiled: CompiledEffect | null = null;
    view: CanvasView = DEFAULT_VIEW;
    viewportSize: CanvasSize = { width: 0, height: 0 };
    playing = true;
    restartCount = 0;
    private readonly records: EffectGraphRecords;
    private readonly listeners = new Set<Listener>();
    private version = 0;
    constructor(private readonly session: EditorSession) {
        this.records = new EffectGraphRecords(session);
    }
    readonly subscribe = (listener: Listener): (() => void) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    };
    readonly getVersion = (): number => this.version;
    get graphs(): StoredVfxGraph[] {
        return this.records.all;
    }
    get active(): StoredVfxGraph | null {
        return this.records.get(this.activeId);
    }
    get document(): VfxGraphDocument | null {
        return this.active?.graph ?? null;
    }
    get focusedContext(): EffectContext | null {
        const { document, selectedContexts } = this;
        if (!document || selectedContexts.size !== 1)
            return null;
        const [id] = selectedContexts;
        return findContext(document, id);
    }
    get focusedBlock(): EffectBlock | null {
        const { document, selectedBlock } = this;
        return document && selectedBlock ? findBlock(document, selectedBlock.contextId, selectedBlock.blockId) : null;
    }
    async load(): Promise<void> {
        if (this.status !== 'idle')
            return;
        this.status = 'loading';
        this.notify();
        await this.records.load();
        this.status = 'ready';
        this.activate(this.graphs.at(-1)?.id ?? null);
    }
    create(name: string, graph: VfxGraphDocument): StoredVfxGraph {
        const record = this.records.create(name, graph);
        this.activate(record.id);
        return record;
    }
    open(id: string): void {
        if (id !== this.activeId && this.records.get(id))
            this.activate(id);
    }
    rename(name: string): void {
        if (this.activeId && this.records.rename(this.activeId, name))
            this.notify();
    }
    remove(id: string): void {
        if (!this.records.remove(id))
            return;
        if (this.activeId === id)
            this.activate(this.graphs.at(-1)?.id ?? null);
        else
            this.notify();
    }
    restoreGraph(graphId: string, graph: VfxGraphDocument): void {
        if (!this.records.replaceGraph(graphId, graph))
            return;
        if (graphId === this.activeId) {
            this.selectedContexts = new Set(graph.contexts.filter((context) => this.selectedContexts.has(context.id)).map((context) => context.id));
            if (this.selectedBlock && !findBlock(graph, this.selectedBlock.contextId, this.selectedBlock.blockId))
                this.selectedBlock = null;
            this.compiled = compileEffectGraph(graph);
        }
        this.notify();
    }
    contextForStage(stage: ContextKind): EffectContext | null {
        const { document, focusedContext } = this;
        if (!document)
            return null;
        if (focusedContext?.kind === stage)
            return focusedContext;
        const system = focusedContext ? systemOf(document, focusedContext.id) : null;
        const sibling = system ? systemContexts(system).find((context) => context.kind === stage) : undefined;
        return sibling ?? document.contexts.find((context) => context.kind === stage) ?? null;
    }
    selectContext(contextId: string, additive: boolean): void {
        this.selectedBlock = null;
        if (!additive) {
            this.selectedContexts = new Set([contextId]);
            this.notify();
            return;
        }
        const next = new Set(this.selectedContexts);
        if (!next.delete(contextId))
            next.add(contextId);
        this.selectedContexts = next;
        this.notify();
    }
    selectBlock(contextId: string, blockId: string): void {
        this.selectedContexts = new Set([contextId]);
        this.selectedBlock = { contextId, blockId };
        this.notify();
    }
    selectAll(): void {
        this.selectedBlock = null;
        this.selectedContexts = new Set(this.document?.contexts.map((context) => context.id));
        this.notify();
    }
    clearSelection(): void {
        if (this.selectedContexts.size === 0 && !this.selectedBlock)
            return;
        this.selectedContexts = NO_CONTEXTS;
        this.selectedBlock = null;
        this.notify();
    }
    addSystem(x: number, y: number): void {
        const before = new Set(this.document?.contexts.map((context) => context.id));
        this.apply('Adicionar sistema ao efeito', (graph) => appendSystem(graph, STARTER_SYSTEM, x, y));
        this.selectedBlock = null;
        this.selectedContexts = new Set(this.document?.contexts.filter((context) => !before.has(context.id)).map((context) => context.id));
        this.notify();
    }
    addContext(kind: ContextKind, x: number, y: number): void {
        const { active } = this;
        if (!active)
            return;
        const added = addContext(active.graph, kind, x, y);
        this.apply('Adicionar contexto ao efeito', () => added.document);
        this.selectContext(added.contextId, false);
    }
    removeSelected(): void {
        const { selectedBlock, selectedContexts } = this;
        if (selectedBlock) {
            this.removeBlock(selectedBlock.contextId, selectedBlock.blockId);
            return;
        }
        this.apply('Excluir contextos do efeito', (graph) => removeContexts(graph, selectedContexts));
    }
    moveSelected(deltaX: number, deltaY: number): void {
        const ids = this.selectedContexts;
        this.apply('Mover contextos do efeito', (graph) => moveContexts(graph, ids, deltaX, deltaY), MOVE_MERGE_KEY);
    }
    endGesture(): void {
        this.session.history.endMerge();
    }
    connect(fromId: string, toId: string): void {
        this.apply('Ligar contextos do efeito', (graph) => connectFlow(graph, fromId, toId));
    }
    disconnect(linkId: string): void {
        this.apply('Desligar contextos do efeito', (graph) => disconnectFlow(graph, linkId));
    }
    addBlock(contextId: string, type: string): void {
        const { document } = this;
        const context = document ? findContext(document, contextId) : null;
        if (!document || !context || blockDefinition(type)?.stage !== context.kind)
            return;
        const added = addBlock(document, contextId, type);
        if (!added)
            return;
        this.apply('Adicionar bloco ao efeito', () => added.document);
        this.selectBlock(contextId, added.blockId);
    }
    removeBlock(contextId: string, blockId: string): void {
        this.apply('Excluir bloco do efeito', (graph) => removeBlock(graph, contextId, blockId));
    }
    moveBlock(contextId: string, blockId: string, offset: number): void {
        this.apply('Reordenar blocos do efeito', (graph) => moveBlock(graph, contextId, blockId, offset));
    }
    setBlockEnabled(contextId: string, blockId: string, enabled: boolean): void {
        this.apply(enabled ? 'Ligar bloco do efeito' : 'Desligar bloco do efeito', (graph) => setBlockEnabled(graph, contextId, blockId, enabled));
    }
    setBlockValue(contextId: string, blockId: string, key: string, value: BlockValue): void {
        this.apply('Editar bloco do efeito', (graph) => setBlockValue(graph, contextId, blockId, key, value), `vfx-graph-block:${blockId}:${key}`);
    }
    setContextValue(contextId: string, key: string, value: BlockValue): void {
        this.apply('Editar contexto do efeito', (graph) => setContextValue(graph, contextId, key, value), `vfx-graph-context:${contextId}:${key}`);
    }
    setView(view: CanvasView): void {
        this.view = view;
        this.notify();
    }
    setViewportSize(size: CanvasSize): void {
        this.viewportSize = size;
    }
    togglePlaying(): void {
        this.playing = !this.playing;
        this.notify();
    }
    restart(): void {
        this.restartCount++;
        this.playing = true;
        this.notify();
    }
    private apply(label: string, update: (graph: VfxGraphDocument) => VfxGraphDocument, mergeKey?: string): void {
        const { active } = this;
        if (!active)
            return;
        const after = update(active.graph);
        if (after !== active.graph)
            this.session.history.execute(new SetVfxGraphCommand(this, label, active.id, active.graph, after, mergeKey));
    }
    private activate(id: string | null): void {
        this.activeId = id;
        this.selectedContexts = NO_CONTEXTS;
        this.selectedBlock = null;
        this.view = DEFAULT_VIEW;
        const { document } = this;
        this.compiled = document ? compileEffectGraph(document) : null;
        this.notify();
    }
    private notify(): void {
        this.version++;
        for (const listener of this.listeners)
            listener();
    }
}
