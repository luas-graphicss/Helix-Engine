import type { VfxDocument, VfxEmitter, VfxModule } from '@/engine/vfx/document/vfx-document';
import { findEmitter, findModule, updateEmitter, updateModule } from '@/engine/vfx/document/vfx-tree';
import { SetVfxDocumentCommand, type VfxDocumentHost } from '@/engine/editor/commands/vfx-commands';
import type { EditorSession } from '@/engine/editor/session/editor-session';
type Listener = () => void;
export type VfxInspectorSection = 'effect' | 'spawn' | 'shape' | 'initial' | 'renderer' | 'module';
export const VFX_SECTION_LABEL: Record<Exclude<VfxInspectorSection, 'module' | 'effect'>, string> = {
    spawn: 'Geração',
    shape: 'Forma',
    initial: 'Inicial',
    renderer: 'Render',
};
export class VfxEditor implements VfxDocumentHost {
    document: VfxDocument | null = null;
    assetId: string | null = null;
    stageEntityId: number | null = null;
    selectedEmitterId: string | null = null;
    selectedModuleId: string | null = null;
    section: VfxInspectorSection = 'spawn';
    paused = false;
    openCount = 0;
    private savedDocument: VfxDocument | null = null;
    private sessionKey = 0;
    private version = 0;
    private pendingStep = 0;
    private pendingSeek: number | null = null;
    private readonly listeners = new Set<Listener>();
    constructor(private readonly session: EditorSession) { }
    readonly subscribe = (listener: Listener): (() => void) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    };
    readonly getVersion = (): number => this.version;
    notify(): void {
        this.version++;
        for (const listener of this.listeners)
            listener();
    }
    get isOpen(): boolean {
        return this.document !== null;
    }
    get dirty(): boolean {
        return this.document !== null && this.document !== this.savedDocument;
    }
    get selectedEmitter(): VfxEmitter | null {
        return this.document ? findEmitter(this.document, this.selectedEmitterId) : null;
    }
    get selectedModule(): VfxModule | null {
        return findModule(this.selectedEmitter, this.selectedModuleId);
    }
    open(document: VfxDocument, assetId: string | null, stageEntityId: number | null): void {
        this.sessionKey++;
        this.openCount++;
        this.document = document;
        this.assetId = assetId;
        this.savedDocument = assetId ? document : null;
        this.stageEntityId = stageEntityId;
        this.selectedEmitterId = document.emitters[0]?.id ?? null;
        this.selectedModuleId = null;
        this.section = this.selectedEmitterId ? 'spawn' : 'effect';
        this.paused = false;
        this.notify();
    }
    close(): void {
        if (!this.document)
            return;
        this.sessionKey++;
        this.document = null;
        this.assetId = null;
        this.savedDocument = null;
        this.stageEntityId = null;
        this.selectedEmitterId = null;
        this.selectedModuleId = null;
        this.paused = false;
        this.notify();
    }
    markSaved(assetId: string): void {
        this.assetId = assetId;
        this.savedDocument = this.document;
        this.notify();
    }
    syncName(name: string): void {
        if (!this.document || this.document.name === name)
            return;
        this.document = { ...this.document, name };
        this.savedDocument = this.savedDocument ? { ...this.savedDocument, name } : null;
        this.notify();
    }
    setStage(entityId: number | null): void {
        if (this.stageEntityId === entityId)
            return;
        this.stageEntityId = entityId;
        this.notify();
    }
    setPaused(paused: boolean): void {
        if (this.paused === paused)
            return;
        this.paused = paused;
        this.notify();
    }
    stepFrame(seconds: number): void {
        if (!(seconds > 0))
            return;
        this.paused = true;
        this.pendingStep += seconds;
        this.notify();
    }
    seek(seconds: number): void {
        this.paused = true;
        this.pendingSeek = Math.max(0, seconds);
        this.notify();
    }
    takeStep(): number {
        const step = this.pendingStep;
        this.pendingStep = 0;
        return step;
    }
    takeSeek(): number | null {
        const seek = this.pendingSeek;
        this.pendingSeek = null;
        return seek;
    }
    restoreDocument(document: VfxDocument, sessionKey: number): void {
        if (sessionKey !== this.sessionKey || !this.document)
            return;
        this.document = document;
        this.pruneSelection();
        this.notify();
        if (this.stageEntityId !== null)
            this.session.notify('scene');
    }
    apply(label: string, update: (document: VfxDocument) => VfxDocument, mergeKey?: string): boolean {
        if (!this.document)
            return false;
        const after = update(this.document);
        if (after === this.document)
            return false;
        this.session.history.execute(new SetVfxDocumentCommand(this, label, this.document, after, this.sessionKey, mergeKey));
        return true;
    }
    updateSelectedEmitter(label: string, update: (emitter: VfxEmitter) => VfxEmitter, mergeKey?: string): boolean {
        const id = this.selectedEmitterId;
        if (!id)
            return false;
        return this.apply(label, (document) => updateEmitter(document, id, update), mergeKey);
    }
    updateSelectedModule(label: string, update: (module: VfxModule) => VfxModule, mergeKey?: string): boolean {
        const emitterId = this.selectedEmitterId;
        const moduleId = this.selectedModuleId;
        if (!emitterId || !moduleId)
            return false;
        return this.apply(label, (document) => updateModule(document, emitterId, moduleId, update), mergeKey);
    }
    endMerge(): void {
        this.session.history.endMerge();
    }
    selectEmitter(id: string | null): void {
        const section: VfxInspectorSection = id ? (this.section === 'module' || this.section === 'effect' ? 'spawn' : this.section) : 'effect';
        if (this.selectedEmitterId === id && this.selectedModuleId === null && this.section === section)
            return;
        this.selectedEmitterId = id;
        this.selectedModuleId = null;
        this.section = section;
        this.notify();
    }
    selectModule(emitterId: string, moduleId: string): void {
        if (this.selectedEmitterId === emitterId && this.selectedModuleId === moduleId)
            return;
        this.selectedEmitterId = emitterId;
        this.selectedModuleId = moduleId;
        this.section = 'module';
        this.notify();
    }
    setSection(section: VfxInspectorSection): void {
        if (this.section === section)
            return;
        this.section = section;
        if (section !== 'module')
            this.selectedModuleId = null;
        this.notify();
    }
    private pruneSelection(): void {
        const { document } = this;
        if (!document)
            return;
        if (this.selectedEmitterId && !findEmitter(document, this.selectedEmitterId)) {
            this.selectedEmitterId = document.emitters[0]?.id ?? null;
            this.selectedModuleId = null;
            this.section = this.selectedEmitterId ? 'spawn' : 'effect';
        }
        if (this.selectedModuleId && !findModule(this.selectedEmitter, this.selectedModuleId)) {
            this.selectedModuleId = null;
            if (this.section === 'module')
                this.section = 'spawn';
        }
    }
}
