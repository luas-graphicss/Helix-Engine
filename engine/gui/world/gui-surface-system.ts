import type { Mat4 } from '@/engine/core/math/mat4';
import type { Ray } from '@/engine/core/math/ray';
import type { Entity } from '@/engine/core/scene/entity';
import type { Scene } from '@/engine/core/scene/scene';
import { createTexture, setTextureImage, touchTexture, type Texture } from '@/engine/core/scene/texture';
import { getLocalBounds } from '@/engine/renderer/geometry/bounds';
import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import type { GuiDocument, GuiPoint } from '@/engine/gui/document/gui-document';
import type { GuiMatrix } from '@/engine/gui/layout/gui-matrix';
import type { GuiViewportProvider } from '@/engine/gui/media/gui-viewport-provider';
import { GuiRuntime, type GuiRuntimeEvent } from '@/engine/gui/runtime/gui-runtime';
import { withAlpha } from '@/engine/gui/render/gui-renderer';
import { computeLocalRect, createLocalRect, createSurfaceFrame, intersectSurfaceFrame, resolveSurfaceFrame, surfaceTextureSize, type GuiSurfaceFrame, type GuiSurfaceLocalRect, type GuiSurfaceRayHit } from './gui-surface-frame';
import { surfaceAudioGain, type GuiSurfaceContent, type GuiSurfaceSettings } from './gui-surface-settings';
import { mediaSurfaceDocument, placeholderSurfaceDocument, type SurfacePlaceholder } from './gui-surface-documents';
export type GuiSurfaceDocumentLookup = GuiDocument | 'loading' | 'missing';
export interface GuiSurfaceDocumentSource {
    lookup(assetId: string): GuiSurfaceDocumentLookup;
}
export interface GuiSurfaceDraw {
    readonly entityId: number;
    readonly worldMatrix: Mat4;
    readonly local: GuiSurfaceLocalRect;
    readonly settings: GuiSurfaceSettings;
    readonly texture: Texture;
}
export interface GuiSurfaceHit extends GuiSurfaceRayHit {
    readonly entity: Entity;
}
export interface GuiSurfaceEvent extends GuiRuntimeEvent {
    readonly entity: Entity;
}
type EventListener = (event: GuiSurfaceEvent) => void;
type SynthesizedContent = Exclude<GuiSurfaceContent, {
    kind: 'screen';
}> | SurfacePlaceholder;
const IDENTITY: GuiMatrix = [1, 0, 0, 1, 0, 0];
const OUTSIDE = -1e9;
class SurfaceInstance {
    readonly runtime = new GuiRuntime();
    readonly canvas: HTMLCanvasElement;
    readonly context: CanvasRenderingContext2D;
    readonly texture: Texture;
    readonly local = createLocalRect();
    readonly frame = createSurfaceFrame();
    settings: GuiSurfaceSettings | null = null;
    document: GuiDocument | null = null;
    private synthesized: {
        readonly content: SynthesizedContent;
        readonly size: GuiPoint;
        readonly document: GuiDocument;
    } | null = null;
    lastRender = -Infinity;
    visible = true;
    readonly unsubscribe: () => void;
    constructor(readonly entity: Entity, onEvent: (event: GuiRuntimeEvent) => void) {
        this.canvas = document.createElement('canvas');
        const context = this.canvas.getContext('2d');
        if (!context)
            throw new Error('Canvas 2D indisponível para a interface no mundo.');
        this.context = context;
        this.texture = createTexture({ name: `Interface de ${entity.name}`, image: this.canvas, colorSpace: 'srgb', wrapS: 'clamp', wrapT: 'clamp', dynamic: true });
        this.runtime.setMediaScope(`surface:${entity.id}`);
        this.unsubscribe = this.runtime.onEvent(onEvent);
    }
    synthesize(content: SynthesizedContent, size: GuiPoint): GuiDocument {
        const cached = this.synthesized;
        if (cached && cached.content === content && cached.size.x === size.x && cached.size.y === size.y)
            return cached.document;
        const document = typeof content === 'string' ? placeholderSurfaceDocument(content, size) : mediaSurfaceDocument(content, size);
        this.synthesized = { content, size, document };
        return document;
    }
    resize(width: number, height: number): boolean {
        if (this.canvas.width === width && this.canvas.height === height)
            return false;
        this.canvas.width = width;
        this.canvas.height = height;
        setTextureImage(this.texture, this.canvas);
        this.runtime.setViewport({ x: width, y: height });
        return true;
    }
    render(settings: GuiSurfaceSettings, elapsedSeconds: number): void {
        const { context, canvas } = this;
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.globalAlpha = 1;
        context.globalCompositeOperation = 'source-over';
        context.clearRect(0, 0, canvas.width, canvas.height);
        if (settings.backdropAlpha > 0) {
            context.fillStyle = withAlpha(settings.backdropColor, settings.backdropAlpha);
            context.fillRect(0, 0, canvas.width, canvas.height);
        }
        this.runtime.render(context, IDENTITY);
        touchTexture(this.texture);
        this.lastRender = elapsedSeconds;
    }
    dispose(): void {
        this.unsubscribe();
        this.runtime.dispose();
        this.canvas.width = 0;
        this.canvas.height = 0;
    }
}
export class GuiSurfaceSystem {
    readonly draws: GuiSurfaceDraw[] = [];
    private readonly instances = new Map<number, SurfaceInstance>();
    private readonly listeners = new Set<EventListener>();
    private readonly alive = new Set<number>();
    private hovered: SurfaceInstance | null = null;
    private pressed: SurfaceInstance | null = null;
    private viewports: GuiViewportProvider | null = null;
    private pendingDocuments = 0;
    constructor(private readonly documents: GuiSurfaceDocumentSource) { }
    onEvent(listener: EventListener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
    private emit(entity: Entity, event: GuiRuntimeEvent): void {
        const surfaceEvent: GuiSurfaceEvent = { ...event, entity };
        for (const listener of this.listeners)
            listener(surfaceEvent);
    }
    setViewportProvider(provider: GuiViewportProvider | null): void {
        if (provider === this.viewports)
            return;
        this.viewports = provider;
        for (const instance of this.instances.values())
            instance.runtime.setViewportProvider(provider);
    }
    get size(): number {
        return this.instances.size;
    }
    get animating(): boolean {
        if (this.pendingDocuments > 0)
            return true;
        for (const instance of this.instances.values())
            if (instance.visible && instance.runtime.animating)
                return true;
        return false;
    }
    get cursor(): string | null {
        return this.hovered?.runtime.cursor ?? null;
    }
    get hasFocusedInput(): boolean {
        for (const instance of this.instances.values())
            if (instance.runtime.hasFocusedInput)
                return true;
        return false;
    }
    frameOf(entityId: number): GuiSurfaceFrame | null {
        return this.instances.get(entityId)?.frame ?? null;
    }
    update(scene: Scene, camera: PerspectiveCamera, deltaSeconds: number, elapsedSeconds: number): boolean {
        scene.updateWorldMatrices();
        const { alive, draws } = this;
        alive.clear();
        draws.length = 0;
        this.pendingDocuments = 0;
        let changed = false;
        scene.traverseVisible((entity) => {
            const settings = entity.guiSurface;
            if (!settings)
                return;
            alive.add(entity.id);
            const instance = this.acquire(entity);
            if (this.step(instance, settings, camera, deltaSeconds, elapsedSeconds))
                changed = true;
            if (instance.visible)
                draws.push({ entityId: entity.id, worldMatrix: entity.worldMatrix, local: instance.local, settings, texture: instance.texture });
        });
        for (const [id, instance] of [...this.instances.entries()]) {
            if (alive.has(id))
                continue;
            this.release(instance);
            this.instances.delete(id);
        }
        return changed;
    }
    private acquire(entity: Entity): SurfaceInstance {
        let instance = this.instances.get(entity.id);
        if (!instance) {
            instance = new SurfaceInstance(entity, (event) => this.emit(entity, event));
            instance.runtime.setViewportProvider(this.viewports);
            this.instances.set(entity.id, instance);
        }
        return instance;
    }
    private release(instance: SurfaceInstance): void {
        if (this.hovered === instance)
            this.hovered = null;
        if (this.pressed === instance)
            this.pressed = null;
        instance.dispose();
    }
    private step(instance: SurfaceInstance, settings: GuiSurfaceSettings, camera: PerspectiveCamera, deltaSeconds: number, elapsedSeconds: number): boolean {
        const { entity, runtime } = instance;
        const bounds = entity.mesh ? getLocalBounds(entity.mesh) : null;
        computeLocalRect(instance.local, settings.mount, bounds);
        resolveSurfaceFrame(instance.frame, instance.local, settings.mount, entity.worldMatrix, camera);
        const culled = settings.cullDistance > 0 && instance.frame.distance > settings.cullDistance;
        instance.visible = !culled && instance.frame.width > 0 && instance.frame.height > 0;
        instance.settings = settings;
        const textureSize = surfaceTextureSize(instance.frame.width, instance.frame.height, settings.pixelsPerMeter);
        const resized = instance.resize(textureSize.width, textureSize.height);
        const size: GuiPoint = { x: textureSize.width, y: textureSize.height };
        const document = this.resolveDocument(instance, settings.content, size);
        if (document !== instance.document) {
            instance.document = document;
            runtime.setDocuments([document]);
            runtime.setViewport(size);
        }
        runtime.setMediaGain(culled ? 0 : surfaceAudioGain(settings, instance.frame.distance));
        runtime.tick(deltaSeconds);
        if (!instance.visible)
            return false;
        const due = settings.frameRate <= 0 || elapsedSeconds - instance.lastRender >= 1 / settings.frameRate;
        if (!resized && !(runtime.needsRender && due))
            return false;
        instance.render(settings, elapsedSeconds);
        return true;
    }
    private resolveDocument(instance: SurfaceInstance, content: GuiSurfaceContent, size: GuiPoint): GuiDocument {
        if (content.kind !== 'screen')
            return instance.synthesize(content, size);
        if (!content.assetId)
            return instance.synthesize('empty', size);
        const lookup = this.documents.lookup(content.assetId);
        if (lookup === 'loading') {
            this.pendingDocuments++;
            return instance.synthesize('loading', size);
        }
        if (lookup === 'missing')
            return instance.synthesize('missing', size);
        return lookup;
    }
    pick(ray: Ray): GuiSurfaceHit | null {
        let best: GuiSurfaceHit | null = null;
        for (const instance of this.instances.values()) {
            const settings = instance.settings;
            if (!instance.visible || !settings || !settings.interactive)
                continue;
            const hit = intersectSurfaceFrame(instance.frame, ray);
            if (!hit || (!hit.front && !settings.doubleSided))
                continue;
            if (settings.interactionDistance > 0 && hit.distance > settings.interactionDistance)
                continue;
            if (!best || hit.distance < best.distance)
                best = { ...hit, entity: instance.entity };
        }
        return best;
    }
    private instanceFor(hit: GuiSurfaceHit | null): SurfaceInstance | null {
        return hit ? (this.instances.get(hit.entity.id) ?? null) : null;
    }
    private pointOf(instance: SurfaceInstance, hit: GuiSurfaceRayHit): GuiPoint {
        return { x: hit.u * instance.canvas.width, y: hit.v * instance.canvas.height };
    }
    pointerMove(ray: Ray): boolean {
        if (this.pressed) {
            const hit = this.pick(ray);
            const point = hit && this.instanceFor(hit) === this.pressed ? this.pointOf(this.pressed, hit) : { x: OUTSIDE, y: OUTSIDE };
            this.pressed.runtime.pointerMove(point.x, point.y);
            return true;
        }
        const hit = this.pick(ray);
        const instance = this.instanceFor(hit);
        if (this.hovered && this.hovered !== instance)
            this.hovered.runtime.pointerLeave();
        this.hovered = instance;
        if (!instance || !hit)
            return false;
        const point = this.pointOf(instance, hit);
        return instance.runtime.pointerMove(point.x, point.y);
    }
    pointerDown(ray: Ray): boolean {
        const hit = this.pick(ray);
        const instance = this.instanceFor(hit);
        if (!instance || !hit)
            return false;
        const point = this.pointOf(instance, hit);
        if (!instance.runtime.pointerDown(point.x, point.y))
            return false;
        this.pressed = instance;
        return true;
    }
    pointerUp(ray: Ray): boolean {
        const pressed = this.pressed;
        this.pressed = null;
        if (!pressed)
            return false;
        const hit = this.pick(ray);
        const point = hit && this.instanceFor(hit) === pressed ? this.pointOf(pressed, hit) : { x: OUTSIDE, y: OUTSIDE };
        pressed.runtime.pointerUp(point.x, point.y);
        return true;
    }
    pointerLeave(): void {
        this.hovered?.runtime.pointerLeave();
        this.hovered = null;
    }
    wheel(ray: Ray, deltaX: number, deltaY: number): boolean {
        const hit = this.pick(ray);
        const instance = this.instanceFor(hit);
        if (!instance || !hit)
            return false;
        const point = this.pointOf(instance, hit);
        return instance.runtime.wheel(point.x, point.y, deltaX, deltaY);
    }
    keyDown(event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey'>): boolean {
        for (const instance of this.instances.values()) {
            if (instance.runtime.hasFocusedInput && instance.runtime.keyDown(event))
                return true;
        }
        return false;
    }
    reset(): void {
        this.hovered = null;
        this.pressed = null;
        for (const instance of this.instances.values())
            instance.runtime.reset();
    }
    dispose(): void {
        for (const instance of this.instances.values())
            instance.dispose();
        this.instances.clear();
        this.draws.length = 0;
        this.listeners.clear();
        this.hovered = null;
        this.pressed = null;
    }
}
