import { createRay } from '@/engine/core/math/ray';
import type { GuiDocument } from '@/engine/gui/document/gui-document';
import { GuiSurfaceSystem, type GuiSurfaceDocumentLookup, type GuiSurfaceEvent } from '@/engine/gui/world/gui-surface-system';
import { buildPickRay } from '@/engine/editor/viewport/pick-entity';
import { SceneViewPool } from '@/engine/editor/viewport/scene-view-pool';
import { loadGuiAsset } from '@/engine/editor/operations/gui-operations';
import type { EditorSession } from '@/engine/editor/session/editor-session';
const LOG_SOURCE = 'Interface no mundo';
function describeValue(value: boolean | number | undefined): string {
    if (typeof value === 'number')
        return Number.isInteger(value) ? String(value) : value.toFixed(2);
    return value ? 'ligado' : 'desligado';
}
interface CachedDocument {
    readonly hash: string;
    readonly document: GuiDocument | null;
}
export class GuiWorldHost {
    readonly system: GuiSurfaceSystem;
    readonly views: SceneViewPool;
    private readonly cache = new Map<string, CachedDocument>();
    private readonly loading = new Set<string>();
    private readonly ray = createRay();
    private readonly unsubscribe: () => void;
    aimedEntityId: number | null = null;
    constructor(private readonly session: EditorSession) {
        this.system = new GuiSurfaceSystem({ lookup: (assetId) => this.lookup(assetId) });
        this.views = new SceneViewPool(session);
        this.system.setViewportProvider(this.views);
        this.unsubscribe = this.system.onEvent((event) => this.onSurfaceEvent(event));
    }
    get interactive(): boolean {
        return this.session.playtest.state === 'playing';
    }
    get cursor(): string | null {
        return this.interactive ? this.system.cursor : null;
    }
    get hasFocusedInput(): boolean {
        return this.interactive && this.system.hasFocusedInput;
    }
    private lookup(assetId: string): GuiSurfaceDocumentLookup {
        const { session } = this;
        const designer = session.gui;
        if (designer.assetId === assetId && designer.document)
            return designer.document;
        const asset = session.library.get(assetId);
        if (!asset || asset.kind !== 'gui')
            return 'missing';
        const cached = this.cache.get(assetId);
        if (cached && cached.hash === asset.contentHash)
            return cached.document ?? 'missing';
        if (!this.loading.has(assetId)) {
            this.loading.add(assetId);
            const hash = asset.contentHash;
            void loadGuiAsset(session, asset)
                .then((document) => this.cache.set(assetId, { hash, document }))
                .catch((cause: unknown) => {
                this.cache.set(assetId, { hash, document: null });
                session.log.error(LOG_SOURCE, `Não foi possível ler a tela ${asset.name}: ${cause instanceof Error ? cause.message : String(cause)}`);
            })
                .finally(() => this.loading.delete(assetId));
        }
        return 'loading';
    }
    private onSurfaceEvent(event: GuiSurfaceEvent): void {
        if (event.type === 'activate') {
            this.session.log.info(LOG_SOURCE, `${event.entity.name}: "${event.nodeName}" ativado.`);
        }
        else if (event.type === 'change' && typeof event.value !== 'string') {
            this.session.log.info(LOG_SOURCE, `${event.entity.name}: "${event.nodeName}" = ${describeValue(event.value)}.`);
        }
    }
    tick(deltaSeconds: number, elapsedSeconds: number): boolean {
        const { session, system } = this;
        if (this.interactive && session.playtest.pointerLocked) {
            const aimed = this.pointerMove(0.5, 0.5) ? (system.pick(this.ray)?.entity.id ?? null) : null;
            if (aimed !== this.aimedEntityId) {
                this.aimedEntityId = aimed;
                session.notify();
            }
        }
        else if (this.aimedEntityId !== null) {
            this.aimedEntityId = null;
            session.notify();
        }
        const changed = system.update(session.scene, session.camera, deltaSeconds, elapsedSeconds);
        this.views.collect(elapsedSeconds);
        return changed || system.animating;
    }
    private aim(u: number, v: number): boolean {
        return buildPickRay(this.ray, this.session.camera, u, v) !== null;
    }
    pointerMove(u: number, v: number): boolean {
        if (!this.interactive || !this.aim(u, v))
            return false;
        return this.system.pointerMove(this.ray);
    }
    pointerDown(u: number, v: number): boolean {
        if (!this.interactive || !this.aim(u, v))
            return false;
        return this.system.pointerDown(this.ray);
    }
    pointerUp(u: number, v: number): boolean {
        if (!this.interactive || !this.aim(u, v))
            return false;
        return this.system.pointerUp(this.ray);
    }
    pointerLeave(): void {
        this.system.pointerLeave();
    }
    wheel(u: number, v: number, deltaX: number, deltaY: number): boolean {
        if (!this.interactive || !this.aim(u, v))
            return false;
        return this.system.wheel(this.ray, deltaX, deltaY);
    }
    keyDown(event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey'>): boolean {
        return this.interactive && this.system.keyDown(event);
    }
    reset(): void {
        this.aimedEntityId = null;
        this.system.reset();
    }
    dispose(): void {
        this.unsubscribe();
        this.system.dispose();
        this.views.dispose();
    }
}
