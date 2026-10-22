import * as aabb from '@/engine/core/math/aabb';
import { degToRad } from '@/engine/core/math/scalar';
import { DEFAULT_MATERIALIZE_OPTIONS } from '@/engine/assets/import/import-materializer';
import type { ImportedScene } from '@/engine/assets/import/import-types';
import type { ModelRendering } from '@/engine/assets/library/asset-ingest';
import { renderPixelsThumbnail, THUMBNAIL_SIZE } from '@/engine/assets/library/thumbnails/image-thumbnail';
import { Renderer, type RenderOptions } from '@/engine/renderer/renderer';
import { createMyriadSettings } from '@/engine/renderer/myriad/runtime/myriad-settings';
import { ImportPreviewModel } from '@/engine/editor/import/preview/import-preview-model';
const SETTLE_FRAMES = 3;
const WARMUP_TIMEOUT_MS = 10000;
const IDLE_DISPOSE_MS = 20000;
const VIEW_AZIMUTH = degToRad(-38);
const VIEW_POLAR = degToRad(62);
const RENDER_OPTIONS: Omit<RenderOptions, 'elapsedSeconds' | 'deltaSeconds'> = {
    showGrid: false,
    shadows: true,
    selection: null,
    showCsgBrushes: false,
    gizmo: null,
    terrainBrush: null,
    skeletons: null,
    culling: { frustumCulling: true, minPixelSize: 0 },
    lod: { enabled: false, bias: 0 },
    myriad: { ...createMyriadSettings(), enabled: false },
    terrainMaterialCache: true,
};
interface Rig {
    canvas: HTMLCanvasElement;
    renderer: Renderer;
    model: ImportPreviewModel;
}
class ModelThumbnailRenderer {
    private rig: Rig | null = null;
    private queue: Promise<unknown> = Promise.resolve();
    private idleTimer: ReturnType<typeof setTimeout> | null = null;
    private unavailable: string | null = null;
    capture(scene: ImportedScene): Promise<ModelRendering | null> {
        const run = this.queue.then(() => this.render(scene));
        this.queue = run.catch(() => undefined);
        return run;
    }
    private async render(scene: ImportedScene): Promise<ModelRendering | null> {
        if (this.unavailable)
            return null;
        const rig = this.acquire();
        if (!rig)
            return null;
        try {
            const result = await rig.model.rebuild(scene, DEFAULT_MATERIALIZE_OPTIONS);
            if (!result)
                return null;
            rig.model.frame();
            const { bounds } = rig.model;
            const dimensions = aabb.isEmpty(bounds) ? null : ([bounds.max[0] - bounds.min[0], bounds.max[1] - bounds.min[1], bounds.max[2] - bounds.min[2]] as const);
            const pixels = await this.renderAndRead(rig);
            const blob = await renderPixelsThumbnail(pixels.data, pixels.width, pixels.height);
            return { blob, dimensions };
        }
        finally {
            rig.model.clear();
            this.scheduleDispose();
        }
    }
    private acquire(): Rig | null {
        if (this.idleTimer)
            clearTimeout(this.idleTimer);
        this.idleTimer = null;
        if (this.rig)
            return this.rig;
        const canvas = document.createElement('canvas');
        canvas.setAttribute('aria-hidden', 'true');
        Object.assign(canvas.style, { position: 'fixed', left: '-10000px', top: '0', width: `${THUMBNAIL_SIZE}px`, height: `${THUMBNAIL_SIZE}px`, pointerEvents: 'none' });
        document.body.append(canvas);
        try {
            const renderer = new Renderer(canvas);
            const model = new ImportPreviewModel();
            model.orbit.azimuth = VIEW_AZIMUTH;
            model.orbit.polar = VIEW_POLAR;
            this.rig = { canvas, renderer, model };
            return this.rig;
        }
        catch (cause) {
            canvas.remove();
            this.unavailable = cause instanceof Error ? cause.message : 'Falha ao iniciar o renderer de miniaturas.';
            console.warn('[biblioteca] Miniaturas de modelos indisponíveis:', this.unavailable);
            return null;
        }
    }
    private renderAndRead({ renderer, model, canvas }: Rig): Promise<{
        data: Uint8Array;
        width: number;
        height: number;
    }> {
        return new Promise((resolve) => {
            const started = performance.now();
            let lastFrame = started;
            let settled = 0;
            const frame = (now: number) => {
                const deltaSeconds = Math.min((now - lastFrame) / 1000, 0.1);
                lastFrame = now;
                renderer.render(model.scene, model.camera, { ...RENDER_OPTIONS, elapsedSeconds: now / 1000, deltaSeconds });
                if (renderer.stats.shadersPending === 0)
                    settled++;
                if (settled < SETTLE_FRAMES && now - started < WARMUP_TIMEOUT_MS) {
                    requestAnimationFrame(frame);
                    return;
                }
                const { gl } = renderer;
                const { width, height } = canvas;
                const data = new Uint8Array(width * height * 4);
                gl.bindFramebuffer(gl.FRAMEBUFFER, null);
                gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, data);
                resolve({ data, width, height });
            };
            requestAnimationFrame(frame);
        });
    }
    private scheduleDispose(): void {
        if (this.idleTimer)
            clearTimeout(this.idleTimer);
        this.idleTimer = setTimeout(() => this.dispose(), IDLE_DISPOSE_MS);
    }
    private dispose(): void {
        const rig = this.rig;
        if (!rig)
            return;
        this.rig = null;
        rig.renderer.dispose();
        rig.renderer.gl.getExtension('WEBGL_lose_context')?.loseContext();
        rig.canvas.remove();
    }
}
let shared: ModelThumbnailRenderer | null = null;
export function renderModelThumbnail(scene: ImportedScene): Promise<ModelRendering | null> {
    shared ??= new ModelThumbnailRenderer();
    return shared.capture(scene);
}
