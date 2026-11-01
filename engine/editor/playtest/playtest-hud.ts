import type { GuiDocument } from '@/engine/gui/document/gui-document';
import type { GuiMatrix } from '@/engine/gui/layout/gui-matrix';
import { GuiRuntime, type GuiRuntimeEvent } from '@/engine/gui/runtime/gui-runtime';
import { collectPlaytestGuiDocuments } from '@/engine/editor/operations/gui-operations';
import type { EditorSession } from '@/engine/editor/session/editor-session';
const LOG_SOURCE = 'HUD';
function describeValue(value: boolean | number | undefined): string {
    if (typeof value === 'number')
        return Number.isInteger(value) ? String(value) : value.toFixed(2);
    return value ? 'ligado' : 'desligado';
}
export class PlaytestHud {
    readonly runtime = new GuiRuntime();
    private active = false;
    private generation = 0;
    private documents: readonly GuiDocument[] = [];
    private designerDocument: GuiDocument | null = null;
    private readonly unsubscribe: () => void;
    private readonly scriptDocuments = new Map<string, GuiDocument>();
    private readonly listeners = new Set<(event: GuiRuntimeEvent) => void>();
    constructor(private readonly session: EditorSession) {
        this.unsubscribe = this.runtime.onEvent((event) => this.onEvent(event));
    }
    onHudEvent(listener: (event: GuiRuntimeEvent) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
    get loadedDocuments(): readonly GuiDocument[] {
        return this.documents;
    }
    showDocument(key: string, document: GuiDocument): void {
        this.scriptDocuments.set(key, document);
        this.applyDocuments();
    }
    hideDocument(key: string): boolean {
        const removed = this.scriptDocuments.delete(key);
        if (removed)
            this.applyDocuments();
        return removed;
    }
    hasDocument(key: string): boolean {
        return this.scriptDocuments.has(key);
    }
    private libraryDocuments: readonly GuiDocument[] = [];
    private applyDocuments(): void {
        if (!this.active)
            return;
        const documents = [...this.libraryDocuments, ...this.scriptDocuments.values()];
        const appeared = this.documents.length === 0 && documents.length > 0;
        const vanished = this.documents.length > 0 && documents.length === 0;
        this.documents = documents;
        this.runtime.setDocuments(documents);
        if (appeared || vanished)
            this.session.notify();
    }
    get visible(): boolean {
        return this.active && this.documents.length > 0;
    }
    get interactive(): boolean {
        return this.visible && !this.session.playtest.pointerLocked;
    }
    get cursor(): string | null {
        return this.interactive ? this.runtime.cursor : null;
    }
    get hasFocusedInput(): boolean {
        return this.visible && this.runtime.hasFocusedInput;
    }
    start(): void {
        this.active = true;
        this.runtime.setMediaScope('playtest');
        this.runtime.setViewportProvider(this.session.guiWorld.views);
        this.designerDocument = this.session.gui.document;
        void this.reload();
    }
    stop(): void {
        if (!this.active)
            return;
        this.active = false;
        this.generation++;
        this.documents = [];
        this.libraryDocuments = [];
        this.scriptDocuments.clear();
        this.runtime.reset();
        this.runtime.setDocuments([]);
        this.runtime.setViewportProvider(null);
        this.session.notify();
    }
    private async reload(): Promise<void> {
        const generation = ++this.generation;
        const library = await collectPlaytestGuiDocuments(this.session);
        if (generation !== this.generation || !this.active)
            return;
        this.libraryDocuments = library;
        const documents = [...library, ...this.scriptDocuments.values()];
        const appeared = this.documents.length === 0 && documents.length > 0;
        const vanished = this.documents.length > 0 && documents.length === 0;
        this.documents = documents;
        this.runtime.setDocuments(documents);
        if (appeared && library.length > 0)
            this.session.log.info(LOG_SOURCE, `${library.length} tela${library.length > 1 ? 's' : ''} da biblioteca sobre o jogo; desligue-as na área Interface para esconder.`);
        if (appeared || vanished)
            this.session.notify();
    }
    tick(deltaSeconds: number): boolean {
        if (!this.active)
            return false;
        if (this.session.gui.document !== this.designerDocument) {
            this.designerDocument = this.session.gui.document;
            void this.reload();
        }
        if (this.documents.length === 0)
            return false;
        this.runtime.tick(deltaSeconds);
        return this.runtime.animating;
    }
    get needsRender(): boolean {
        return this.runtime.needsRender;
    }
    render(context: CanvasRenderingContext2D, width: number, height: number, dpr: number): void {
        this.runtime.setViewport({ x: width, y: height });
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.clearRect(0, 0, context.canvas.width, context.canvas.height);
        const base: GuiMatrix = [dpr, 0, 0, dpr, 0, 0];
        this.runtime.render(context, base);
    }
    pointerMove(x: number, y: number): boolean {
        return this.interactive && this.runtime.pointerMove(x, y);
    }
    pointerDown(x: number, y: number): boolean {
        return this.interactive && this.runtime.pointerDown(x, y);
    }
    pointerUp(x: number, y: number): boolean {
        return this.visible && this.runtime.pointerUp(x, y);
    }
    pointerLeave(): void {
        if (this.visible)
            this.runtime.pointerLeave();
    }
    wheel(x: number, y: number, deltaX: number, deltaY: number): boolean {
        return this.interactive && this.runtime.wheel(x, y, deltaX, deltaY);
    }
    keyDown(event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey'>): boolean {
        return this.hasFocusedInput && this.runtime.keyDown(event);
    }
    dispose(): void {
        this.unsubscribe();
        this.runtime.dispose();
    }
    private onEvent(event: GuiRuntimeEvent): void {
        for (const listener of this.listeners)
            listener(event);
        if (this.listeners.size > 0)
            return;
        if (event.type === 'activate') {
            this.session.log.info(LOG_SOURCE, `"${event.nodeName}" ativado.`);
        }
        else if (event.type === 'change' && typeof event.value !== 'string') {
            this.session.log.info(LOG_SOURCE, `"${event.nodeName}" = ${describeValue(event.value)}.`);
        }
    }
}
