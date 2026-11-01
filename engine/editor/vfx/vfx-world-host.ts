import type { Texture } from '@/engine/core/scene/texture';
import { guiImages } from '@/engine/gui/images/gui-image-cache';
import type { VfxHelperState } from '@/engine/renderer/passes/vfx-helper-pass';
import type { VfxDocument } from '@/engine/vfx/document/vfx-document';
import { vfxAssetTexture } from '@/engine/vfx/textures/vfx-texture-catalog';
import { VfxSystem, type VfxDocumentLookup } from '@/engine/vfx/world/vfx-system';
import { loadVfxAsset } from '@/engine/editor/operations/vfx-operations';
import type { EditorSession } from '@/engine/editor/session/editor-session';
const LOG_SOURCE = 'Efeitos';
const SEEK_STEP_SECONDS = 1 / 60;
interface CachedDocument {
    readonly hash: string;
    readonly document: VfxDocument | null;
}
export class VfxWorldHost {
    readonly system: VfxSystem;
    private readonly cache = new Map<string, CachedDocument>();
    private readonly loading = new Set<string>();
    constructor(private readonly session: EditorSession) {
        this.system = new VfxSystem({ lookup: (assetId) => this.lookup(assetId) }, { resolve: (assetId) => this.resolveTexture(assetId) });
    }
    private lookup(assetId: string): VfxDocumentLookup {
        const { session } = this;
        const editor = session.vfx;
        if (editor.assetId === assetId && editor.document)
            return editor.document;
        const asset = session.library.get(assetId);
        if (!asset || asset.kind !== 'vfx')
            return 'missing';
        const cached = this.cache.get(assetId);
        if (cached && cached.hash === asset.contentHash)
            return cached.document ?? 'missing';
        if (!this.loading.has(assetId)) {
            this.loading.add(assetId);
            const hash = asset.contentHash;
            void loadVfxAsset(session, asset)
                .then((document) => this.cache.set(assetId, { hash, document }))
                .catch((cause: unknown) => {
                this.cache.set(assetId, { hash, document: null });
                session.log.error(LOG_SOURCE, `Não foi possível ler o efeito ${asset.name}: ${cause instanceof Error ? cause.message : String(cause)}`);
            })
                .finally(() => this.loading.delete(assetId));
        }
        return 'loading';
    }
    private resolveTexture(assetId: string): Texture | null {
        const image = guiImages.get(assetId);
        return image ? vfxAssetTexture(assetId, image) : null;
    }
    tick(deltaSeconds: number): boolean {
        const { session, system } = this;
        const editor = session.vfx;
        const context = session.playtest.state === 'playing' ? 'game' : 'editor';
        const frozen = context === 'editor' && editor.paused && editor.stageEntityId !== null;
        const seek = frozen ? editor.takeSeek() : null;
        const step = frozen ? editor.takeStep() : 0;
        system.update(session.scene, session.camera, frozen ? step : deltaSeconds, context);
        if (seek !== null)
            this.seekStage(seek);
        return !frozen && system.animating;
    }
    private seekStage(seconds: number): void {
        const { session, system } = this;
        const stage = session.vfx.stageEntityId !== null ? session.findById(session.vfx.stageEntityId) : null;
        const settings = stage?.vfx;
        const instance = stage ? system.instanceOf(stage.id) : null;
        if (!stage || !settings || !instance)
            return;
        instance.restart(settings);
        const { duration } = instance.document;
        const loop = settings.loop ?? instance.document.loop;
        let remaining = seconds - instance.time;
        if (loop && duration > 0)
            remaining = ((remaining % duration) + duration) % duration;
        const gravity = session.scene.physics.gravity;
        const playback = { ...settings, timeScale: 1 };
        for (let elapsed = 0; elapsed < remaining; elapsed += SEEK_STEP_SECONDS) {
            instance.step(Math.min(SEEK_STEP_SECONDS, remaining - elapsed), stage.worldMatrix, gravity, playback);
        }
    }
    helperState(entityId: number): VfxHelperState | null {
        const settings = this.session.findById(entityId)?.vfx;
        if (!settings)
            return null;
        const instance = this.system.instanceOf(entityId);
        const editor = this.session.vfx;
        const editing = editor.stageEntityId === entityId && editor.document !== null;
        const document = instance?.document ?? (editing ? editor.document : null);
        return {
            playing: instance?.state === 'playing',
            emitters: document?.emitters ?? [],
            focusedEmitterId: editing ? editor.selectedEmitterId : null,
            scale: (document?.scale ?? 1) * settings.scale,
        };
    }
    reset(): void {
        this.system.reset();
    }
    dispose(): void {
        this.system.dispose();
    }
}
