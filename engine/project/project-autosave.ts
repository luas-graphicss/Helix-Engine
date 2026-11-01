import type { EditorSession } from '@/engine/editor/session/editor-session';
import { libraryDocumentForTerrainMaterial } from '@/engine/editor/operations/material-library-operations';
import { engineSettings } from '@/engine/settings/engine-settings-store';
import { serializeScene } from './scene-document/serialize-scene';
export type AutosaveState = 'clean' | 'dirty' | 'saving' | 'error';
const THUMBNAIL_INTERVAL_MS = 60000;
function errorMessage(cause: unknown): string {
    return cause instanceof Error ? cause.message : String(cause);
}
export class ProjectAutosave {
    state: AutosaveState = 'clean';
    lastSavedAt: number | null = null;
    error: string | null = null;
    private savedRevision: number;
    private extraRevision = 0;
    private savedExtraRevision = 0;
    private timer: ReturnType<typeof setTimeout> | null = null;
    private dirtySince: number | null = null;
    private saving: Promise<boolean> | null = null;
    private lastThumbnailAt = -Infinity;
    private unsubscribe: (() => void) | null = null;
    private discarded = false;
    private readonly flushOnHide = () => {
        if (document.visibilityState === 'hidden')
            this.flush();
    };
    private readonly flushOnLeave = () => this.flush();
    constructor(private readonly session: EditorSession) {
        this.savedRevision = session.history.revision;
    }
    get dirty(): boolean {
        return this.session.history.revision !== this.savedRevision || this.extraRevision !== this.savedExtraRevision;
    }
    start(): void {
        if (this.unsubscribe)
            return;
        this.unsubscribe = this.session.subscribe(() => this.onSessionChange());
        window.addEventListener('pagehide', this.flushOnLeave);
        document.addEventListener('visibilitychange', this.flushOnHide);
    }
    stop(): void {
        this.unsubscribe?.();
        this.unsubscribe = null;
        window.removeEventListener('pagehide', this.flushOnLeave);
        document.removeEventListener('visibilitychange', this.flushOnHide);
        this.clearTimer();
    }
    discard(): void {
        this.stop();
        this.discarded = true;
        this.savedRevision = this.session.history.revision;
        this.savedExtraRevision = this.extraRevision;
        this.dirtySince = null;
    }
    markDirty(): void {
        if (this.discarded)
            return;
        this.extraRevision++;
        this.onSessionChange();
    }
    flush(): void {
        if (!this.dirty || this.saving || this.playing)
            return;
        void this.saveNow();
    }
    private get playing(): boolean {
        return this.session.playtest.isRunning;
    }
    async saveNow(): Promise<boolean> {
        if (this.discarded || this.playing)
            return false;
        if (this.saving) {
            await this.saving;
            if (!this.dirty)
                return true;
        }
        this.clearTimer();
        this.saving = this.save();
        try {
            return await this.saving;
        }
        finally {
            this.saving = null;
            if (this.dirty)
                this.schedule();
        }
    }
    private onSessionChange(): void {
        if (!this.dirty)
            return;
        if (this.state === 'clean' || this.state === 'error') {
            this.state = 'dirty';
            this.error = null;
            this.dirtySince ??= performance.now();
            this.session.notify('project');
        }
        this.schedule();
    }
    settingsChanged(): void {
        if (this.dirty)
            this.schedule();
    }
    private schedule(): void {
        if (this.saving)
            return;
        this.clearTimer();
        if (this.playing || !engineSettings.get('project.autosave.enabled'))
            return;
        const debounceMs = engineSettings.get('project.autosave.delay') * 1000;
        const maxWaitMs = engineSettings.get('project.autosave.maxWait') * 1000;
        const waited = this.dirtySince === null ? 0 : performance.now() - this.dirtySince;
        const delay = Math.max(0, Math.min(debounceMs, maxWaitMs - waited));
        this.timer = setTimeout(() => {
            this.timer = null;
            void this.saveNow();
        }, delay);
    }
    private clearTimer(): void {
        if (this.timer)
            clearTimeout(this.timer);
        this.timer = null;
    }
    private async save(): Promise<boolean> {
        const { session } = this;
        const { project } = session;
        const revision = session.history.revision;
        const extraRevision = this.extraRevision;
        this.setState('saving');
        try {
            const document = await serializeScene(session.scene, {
                libraryDocumentForTerrainMaterial: (id) => libraryDocumentForTerrainMaterial(session, id)?.id ?? null,
            });
            await project.scenes.saveCurrent(document);
            this.savedRevision = revision;
            this.savedExtraRevision = extraRevision;
            this.lastSavedAt = document.json.savedAt;
            this.dirtySince = null;
            this.setState(this.dirty ? 'dirty' : 'clean');
            void this.updateRecord(document.json.stats.entities);
            return true;
        }
        catch (cause) {
            this.error = `Não foi possível salvar a cena: ${errorMessage(cause)}`;
            session.log.error('Projeto', this.error);
            this.setState('error');
            return false;
        }
    }
    private async updateRecord(entities: number): Promise<void> {
        const { session } = this;
        const { project } = session;
        const stats = { entities, assets: session.library.size, materials: session.materials.size };
        const now = performance.now();
        let thumbnail: Blob | null = null;
        if (engineSettings.get('project.thumbnail.enabled') && now - this.lastThumbnailAt >= THUMBNAIL_INTERVAL_MS) {
            thumbnail = await session.capture.request(session.viewportCanvas);
            if (thumbnail)
                this.lastThumbnailAt = now;
        }
        try {
            await project.registry.touchSaved(project.id, thumbnail ? { stats, thumbnail } : { stats });
        }
        catch {
        }
    }
    private setState(state: AutosaveState): void {
        if (this.state === state)
            return;
        this.state = state;
        this.session.notify('project');
    }
}
