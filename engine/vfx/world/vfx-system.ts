import type { Mat4 } from '@/engine/core/math/mat4';
import type { Entity } from '@/engine/core/scene/entity';
import type { Scene } from '@/engine/core/scene/scene';
import type { Texture } from '@/engine/core/scene/texture';
import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import type { VfxDocument, VfxTextureRef } from '@/engine/vfx/document/vfx-document';
import { VfxInstance } from '@/engine/vfx/simulation/vfx-instance';
import { builtinVfxTexture } from '@/engine/vfx/textures/vfx-texture-catalog';
import type { VfxSettings } from '@/engine/vfx/vfx-settings';
export type VfxDocumentLookup = VfxDocument | 'loading' | 'missing';
export interface VfxDocumentSource {
    lookup(assetId: string): VfxDocumentLookup;
}
export interface VfxTextureSource {
    resolve(assetId: string): Texture | null;
}
export type VfxContext = 'editor' | 'game';
export interface VfxDraw {
    readonly entityId: number;
    readonly worldMatrix: Mat4;
    readonly instance: VfxInstance;
    readonly settings: VfxSettings;
    readonly distance: number;
    readonly resolveTexture: (ref: VfxTextureRef) => Texture | null;
}
export interface VfxSystemStats {
    effects: number;
    playing: number;
    particles: number;
    budget: number;
    pending: number;
}
class EffectSlot {
    instance: VfxInstance | null = null;
    assetId: string | null = null;
    settings: VfxSettings | null = null;
    context: VfxContext | null = null;
    pendingPlay = false;
    constructor(readonly entity: Entity) { }
}
function randomSeed(): number {
    return Math.floor(Math.random() * 4294967295) >>> 0;
}
export class VfxSystem {
    readonly draws: VfxDraw[] = [];
    readonly stats: VfxSystemStats = { effects: 0, playing: 0, particles: 0, budget: 0, pending: 0 };
    private readonly slots = new Map<number, EffectSlot>();
    private readonly alive = new Set<number>();
    private readonly resolveTexture = (ref: VfxTextureRef): Texture | null => {
        if (ref.kind === 'builtin')
            return builtinVfxTexture(ref.id);
        return this.textures.resolve(ref.assetId);
    };
    constructor(private readonly documents: VfxDocumentSource, private readonly textures: VfxTextureSource) { }
    get size(): number {
        return this.slots.size;
    }
    get animating(): boolean {
        if (this.stats.pending > 0)
            return true;
        for (const slot of this.slots.values())
            if (slot.instance?.animating)
                return true;
        return false;
    }
    instanceOf(entityId: number): VfxInstance | null {
        return this.slots.get(entityId)?.instance ?? null;
    }
    update(scene: Scene, camera: PerspectiveCamera, deltaSeconds: number, context: VfxContext): void {
        scene.updateWorldMatrices();
        const { alive, draws, stats } = this;
        alive.clear();
        draws.length = 0;
        stats.effects = 0;
        stats.playing = 0;
        stats.particles = 0;
        stats.budget = 0;
        stats.pending = 0;
        scene.traverseVisible((entity) => {
            const settings = entity.vfx;
            if (!settings)
                return;
            alive.add(entity.id);
            stats.effects++;
            const slot = this.acquire(entity);
            this.reconcile(slot, settings, context);
            const instance = slot.instance;
            if (!instance)
                return;
            const m = entity.worldMatrix;
            const distance = Math.hypot(m[12] - camera.position[0], m[13] - camera.position[1], m[14] - camera.position[2]);
            const culled = settings.cullDistance > 0 && distance > settings.cullDistance;
            if (!culled)
                instance.step(deltaSeconds, m, scene.physics.gravity, settings);
            if (instance.state === 'playing') {
                stats.playing++;
                stats.budget += instance.document.emitters.reduce((total, emitter) => total + (emitter.enabled ? emitter.maxParticles : 0), 0);
            }
            stats.particles += instance.alive;
            if (!culled && instance.alive > 0) {
                draws.push({ entityId: entity.id, worldMatrix: m, instance, settings, distance, resolveTexture: this.resolveTexture });
            }
        });
        for (const [id, slot] of [...this.slots.entries()]) {
            if (alive.has(id))
                continue;
            slot.instance?.stop();
            this.slots.delete(id);
        }
    }
    private acquire(entity: Entity): EffectSlot {
        let slot = this.slots.get(entity.id);
        if (!slot) {
            slot = new EffectSlot(entity);
            this.slots.set(entity.id, slot);
        }
        return slot;
    }
    private reconcile(slot: EffectSlot, settings: VfxSettings, context: VfxContext): void {
        const previous = slot.settings;
        const contextChanged = slot.context !== context;
        slot.settings = settings;
        slot.context = context;
        if (!settings.assetId) {
            slot.instance?.stop();
            slot.instance = null;
            slot.assetId = null;
            return;
        }
        const lookup = this.documents.lookup(settings.assetId);
        if (lookup === 'loading') {
            this.stats.pending++;
            return;
        }
        if (lookup === 'missing') {
            slot.instance?.stop();
            slot.instance = null;
            slot.assetId = null;
            return;
        }
        const assetChanged = slot.assetId !== settings.assetId || !slot.instance;
        if (assetChanged) {
            slot.instance?.stop();
            slot.instance = new VfxInstance(lookup, settings.seed || randomSeed());
            slot.assetId = settings.assetId;
        }
        else if (slot.instance && slot.instance.document !== lookup) {
            slot.instance.setDocument(lookup);
        }
        const instance = slot.instance as VfxInstance;
        const seedChanged = previous !== null && previous.seed !== settings.seed;
        if (seedChanged)
            instance.reseed(settings.seed || randomSeed());
        if (context === 'editor' && !settings.playInEditor) {
            if (instance.state !== 'stopped')
                instance.stop();
            slot.pendingPlay = false;
            return;
        }
        if (slot.pendingPlay) {
            slot.pendingPlay = false;
            instance.play(settings);
            return;
        }
        const fresh = assetChanged || contextChanged || seedChanged || (previous !== null && previous.playInEditor !== settings.playInEditor);
        if (fresh) {
            if (settings.autoPlay)
                instance.play(settings);
            else
                instance.stop();
            return;
        }
        if (previous && !previous.autoPlay && settings.autoPlay && instance.state === 'stopped')
            instance.play(settings);
    }
    play(entityId: number): void {
        const slot = this.slots.get(entityId);
        if (!slot)
            return;
        if (slot.instance && slot.settings)
            slot.instance.play(slot.settings);
        else
            slot.pendingPlay = true;
    }
    pause(entityId: number): void {
        this.slots.get(entityId)?.instance?.pause();
    }
    resume(entityId: number): void {
        this.slots.get(entityId)?.instance?.resume();
    }
    stop(entityId: number): void {
        const slot = this.slots.get(entityId);
        if (!slot)
            return;
        slot.pendingPlay = false;
        slot.instance?.stop();
    }
    reset(): void {
        for (const slot of this.slots.values()) {
            slot.instance?.stop();
            slot.context = null;
            slot.pendingPlay = false;
        }
    }
    dispose(): void {
        for (const slot of this.slots.values())
            slot.instance?.stop();
        this.slots.clear();
        this.draws.length = 0;
    }
}
