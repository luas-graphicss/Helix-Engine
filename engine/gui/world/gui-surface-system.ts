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
