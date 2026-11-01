import * as mat4 from '@/engine/core/math/mat4';
import * as vec3 from '@/engine/core/math/vec3';
import { clamp, degToRad } from '@/engine/core/math/scalar';
import type { VfxBlendMode, VfxDocument, VfxTextureRef } from '@/engine/vfx/document/vfx-document';
import { VfxInstance, vfxDocumentExtent } from '@/engine/vfx/simulation/vfx-instance';
import { paintBuiltinVfxTexture } from '@/engine/vfx/textures/vfx-texture-catalog';
const PREVIEW_SEED = 0x7a3f19;
const STEP = 1 / 30;
const THUMBNAIL_WARMUP = 1.25;
const BLEND_OPERATION: Record<VfxBlendMode, GlobalCompositeOperation> = { alpha: 'source-over', additive: 'lighter', premultiplied: 'lighter', multiply: 'multiply' };
const spriteCache = new Map<string, HTMLCanvasElement>();
function spriteFor(ref: VfxTextureRef): HTMLCanvasElement {
    const id = ref.kind === 'builtin' ? ref.id : 'soft';
    let sprite = spriteCache.get(id);
    if (!sprite) {
        sprite = paintBuiltinVfxTexture(id, 64);
        spriteCache.set(id, sprite);
    }
    return sprite;
}
const tintCache = new Map<string, HTMLCanvasElement>();
function tintedSprite(sprite: HTMLCanvasElement, id: string, r: number, g: number, b: number): HTMLCanvasElement {
    const key = `${id}:${r}:${g}:${b}`;
    let tinted = tintCache.get(key);
    if (!tinted) {
        tinted = document.createElement('canvas');
        tinted.width = sprite.width;
        tinted.height = sprite.height;
        const context = tinted.getContext('2d');
        if (context) {
            context.drawImage(sprite, 0, 0);
            context.globalCompositeOperation = 'source-in';
            context.fillStyle = `rgb(${r}, ${g}, ${b})`;
            context.fillRect(0, 0, tinted.width, tinted.height);
        }
        if (tintCache.size > 512)
            tintCache.clear();
        tintCache.set(key, tinted);
    }
    return tinted;
}
const IDENTITY = mat4.create();
const GRAVITY = vec3.create(0, -9.81, 0);
const PLAYBACK = { loop: null, scale: 1, timeScale: 1 } as const;
export interface VfxPreviewCamera {
    readonly viewProjection: Float32Array;
    readonly eye: Float32Array;
}
export function previewCamera(document: VfxDocument, aspect: number): VfxPreviewCamera {
    const extent = Math.max(0.5, vfxDocumentExtent(document));
    const target = vec3.create(0, extent * 0.35, 0);
    const distance = extent * 2.6;
    const eye = vec3.create(distance * 0.35, extent * 0.35 + distance * 0.3, distance);
    const view = mat4.create();
    const projection = mat4.create();
    const viewProjection = mat4.create();
    mat4.lookAt(view, eye, target, vec3.create(0, 1, 0));
    mat4.perspective(projection, degToRad(38), aspect, 0.05, distance * 4);
    mat4.multiply(viewProjection, projection, view);
    return { viewProjection, eye };
}
const scratch = vec3.create();
const projected = vec3.create();
export function drawVfxPreview(context: CanvasRenderingContext2D, instance: VfxInstance, camera: VfxPreviewCamera, x: number, y: number, width: number, height: number): void {
    context.save();
    context.beginPath();
    context.rect(x, y, width, height);
    context.clip();
    const focal = height / (2 * Math.tan(degToRad(38) / 2));
    for (const simulator of instance.simulators) {
        const { emitter, pool } = simulator;
        if (!emitter.enabled || pool.count === 0)
            continue;
        const sprite = spriteFor(emitter.renderer.texture);
        const spriteId = emitter.renderer.texture.kind === 'builtin' ? emitter.renderer.texture.id : 'soft';
        context.globalCompositeOperation = BLEND_OPERATION[emitter.renderer.blend];
        const intensity = clamp(emitter.renderer.intensity, 0.2, 4);
        for (let i = 0; i < pool.count; i++) {
            vec3.set(scratch, pool.position[i * 3], pool.position[i * 3 + 1], pool.position[i * 3 + 2]);
            mat4.transformPoint(projected, camera.viewProjection, scratch);
            if (projected[2] < -1 || projected[2] > 1)
                continue;
            const screenX = x + (projected[0] * 0.5 + 0.5) * width;
            const screenY = y + (0.5 - projected[1] * 0.5) * height;
            const distance = vec3.distance(camera.eye, scratch);
            const pixelsPerMeter = focal / Math.max(distance, 0.05);
            const sizeX = Math.max(1.5, pool.size[i * 2] * pixelsPerMeter);
            const sizeY = Math.max(1.5, pool.size[i * 2 + 1] * pixelsPerMeter);
            const alpha = clamp(pool.color[i * 4 + 3], 0, 1);
            if (alpha <= 0.002)
                continue;
            const r = Math.round(clamp(pool.color[i * 4] * intensity, 0, 1) * 255);
            const g = Math.round(clamp(pool.color[i * 4 + 1] * intensity, 0, 1) * 255);
            const b = Math.round(clamp(pool.color[i * 4 + 2] * intensity, 0, 1) * 255);
            context.globalAlpha = alpha;
            context.translate(screenX, screenY);
            context.rotate(-pool.rotation[i]);
            context.drawImage(tintedSprite(sprite, spriteId, r, g, b), -sizeX / 2, -sizeY / 2, sizeX, sizeY);
            context.setTransform(1, 0, 0, 1, 0, 0);
        }
    }
    context.restore();
}
export function simulateVfxPreview(document: VfxDocument, seconds = THUMBNAIL_WARMUP): VfxInstance {
    const instance = new VfxInstance(document, PREVIEW_SEED);
    instance.play(PLAYBACK);
    const steps = Math.ceil(seconds / STEP);
    for (let i = 0; i < steps; i++)
        instance.step(STEP, IDENTITY, GRAVITY, PLAYBACK);
    return instance;
}
export class VfxPreviewPlayer {
    private instance: VfxInstance;
    private camera: VfxPreviewCamera | null = null;
    private cameraAspect = 0;
    private cameraDocument: VfxDocument | null = null;
    constructor(document: VfxDocument) {
        this.instance = new VfxInstance(document, PREVIEW_SEED);
        this.instance.play(PLAYBACK);
    }
    get document(): VfxDocument {
        return this.instance.document;
    }
    get alive(): number {
        return this.instance.alive;
    }
    setDocument(document: VfxDocument): void {
        if (document !== this.instance.document)
            this.instance.setDocument(document);
    }
    restart(): void {
        this.instance.restart(PLAYBACK);
    }
    step(deltaSeconds: number): void {
        if (this.instance.state === 'finished')
            this.instance.restart(PLAYBACK);
        this.instance.step(Math.min(deltaSeconds, 0.1), IDENTITY, GRAVITY, PLAYBACK);
    }
    draw(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number): void {
        const aspect = width / Math.max(height, 1);
        if (!this.camera || this.cameraAspect !== aspect || this.cameraDocument !== this.instance.document) {
            this.camera = previewCamera(this.instance.document, aspect);
            this.cameraAspect = aspect;
            this.cameraDocument = this.instance.document;
        }
        drawVfxPreview(context, this.instance, this.camera, x, y, width, height);
    }
}
