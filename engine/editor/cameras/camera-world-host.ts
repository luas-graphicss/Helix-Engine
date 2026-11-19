import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { Entity } from '@/engine/core/scene/entity';
import type { CameraViewport } from '@/engine/camera/camera-settings';
import { planCameraFrame, type ActiveCamera, type CameraFramePlan } from '@/engine/camera/stack/camera-frame-plan';
import { aimCameraFromEntity, alignCameraUp, applyCameraLens, applyCameraOutput, captureCameraView, restoreCameraView, screenBackdrop, type CameraViewState } from '@/engine/renderer/camera/camera-rig';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { CameraView } from './camera-view';
const MAX_VIEWS = 4;
const PREVIEW_HEIGHT = 216;
const PREVIEW_FRAME_RATE = 30;
const FALLBACK_ASPECT = 16 / 9;
const LOG_SOURCE = 'Câmeras';
const EMPTY_PLAN: CameraFramePlan = { main: null, layers: [], textures: [] };
export interface CameraScreenLayer {
    readonly key: string;
    readonly canvas: HTMLCanvasElement;
    readonly viewport: CameraViewport;
}
export interface CameraPreview {
    readonly key: string;
    readonly entityId: number;
    readonly canvas: HTMLCanvasElement;
    readonly aspect: number;
}
interface PlayView {
    readonly state: CameraViewState;
    readonly position: Vec3;
    readonly target: Vec3;
    driven: boolean;
}
function feedKey(entity: Entity): string {
    return `feed:${entity.id}`;
}
export class CameraWorldHost {
    layers: readonly CameraScreenLayer[] = [];
    preview: CameraPreview | null = null;
    private readonly views = new Map<string, CameraView>();
    private plan: CameraFramePlan = EMPTY_PLAN;
    private playView: PlayView | null = null;
    private mainEntity: Entity | null = null;
    private signature = '';
    private budgetWarned = false;
    constructor(private readonly session: EditorSession) { }
    get animating(): boolean {
        for (const view of this.views.values()) {
            if (view.warming)
                return true;
        }
        return false;
    }
    beginPlay(): void {
        const { camera } = this.session;
        this.playView = {
            state: captureCameraView(camera),
            position: vec3.copy(vec3.create(), camera.position),
            target: vec3.copy(vec3.create(), camera.target),
            driven: false,
        };
    }
    endPlay(): void {
        const { playView } = this;
        if (!playView)
            return;
        const { camera } = this.session;
        restoreCameraView(camera, playView.state);
        if (playView.driven) {
            vec3.copy(camera.position, playView.position);
            vec3.copy(camera.target, playView.target);
        }
        this.playView = null;
        this.mainEntity = null;
    }
    driveMainView(): void {
        const { session, playView } = this;
        this.plan = planCameraFrame(session.scene);
        if (!playView)
            return;
        const { camera } = session;
        const effects = session.scripts.cameraEffects;
        const scripted = effects.main;
        const main = scripted ?? this.plan.main?.entity ?? null;
        const settings = main?.camera ?? null;
        if (!main || !settings) {
            if (this.mainEntity)
                restoreCameraView(camera, playView.state);
            this.mainEntity = null;
            return;
        }
        this.mainEntity = main;
        playView.driven = true;
        if (main === scripted) {
            alignCameraUp(camera, main);
        }
        else {
            aimCameraFromEntity(camera, main);
            vec3.add(camera.position, camera.position, effects.shakeOffset);
            vec3.add(camera.target, camera.target, effects.shakeOffset);
        }
        applyCameraLens(camera, settings);
        applyCameraOutput(camera, settings, session.scene.postProcessing, { backdrop: screenBackdrop(settings, false), content: 'color' });
    }
    render(elapsedSeconds: number): void {
        if (typeof document === 'undefined')
            return;
        const used = new Set<string>();
        for (const feed of this.plan.textures)
            this.renderFeed(feed, elapsedSeconds, used);
        const layers = this.playView ? this.renderLayers(elapsedSeconds, used) : [];
        const preview = this.playView ? null : this.renderPreview(elapsedSeconds, used);
        this.releaseUnused(used);
        this.publish(layers, preview);
    }
    dispose(): void {
        for (const view of this.views.values())
            view.dispose();
        this.views.clear();
        this.layers = [];
        this.preview = null;
    }
    private renderFeed(feed: ActiveCamera, elapsedSeconds: number, used: Set<string>): void {
        const { session } = this;
        const { entity, settings } = feed;
        const feeds = session.scene.cameraFeeds;
        feeds.ensure(entity);
        const view = this.acquire(feedKey(entity), false, used);
        if (!view)
            return;
        const { width, height, frameRate, content } = settings.texture;
        if (!this.due(view, frameRate, width, height, elapsedSeconds))
            return;
        const output = { backdrop: screenBackdrop(settings, false), content };
        if (view.render(session, { entity, settings, output, width, height, elapsedSeconds }))
            feeds.publish(entity, view.canvas);
    }
    private renderLayers(elapsedSeconds: number, used: Set<string>): CameraScreenLayer[] {
        const { session } = this;
        const canvas = session.viewportCanvas;
        if (!canvas)
            return [];
        const layers: CameraScreenLayer[] = [];
        this.plan.layers.forEach((layer, index) => {
            const { entity, settings, viewport, overlay } = layer;
            if (entity === this.mainEntity)
                return;
            const key = `layer:${index}:${entity.id}`;
            const view = this.acquire(key, overlay, used);
            if (!view)
                return;
            const width = Math.max(1, Math.round(canvas.width * viewport.width));
            const height = Math.max(1, Math.round(canvas.height * viewport.height));
            const output = { backdrop: screenBackdrop(settings, overlay), content: 'color' as const };
            view.render(session, { entity, settings, output, width, height, elapsedSeconds });
            if (view.rendered)
                layers.push({ key, canvas: view.canvas, viewport });
        });
        return layers;
    }
    private renderPreview(elapsedSeconds: number, used: Set<string>): CameraPreview | null {
        const { session } = this;
        const entity = session.selectedEntity;
        const settings = entity?.camera;
        if (!entity || !settings)
            return null;
        if (settings.role === 'base' && settings.target === 'texture') {
            const key = feedKey(entity);
            const feed = this.views.get(key);
            return feed?.rendered ? { key, entityId: entity.id, canvas: feed.canvas, aspect: settings.texture.width / settings.texture.height } : null;
        }
        const key = 'preview';
        const view = this.acquire(key, false, used);
        if (!view)
            return null;
        const canvas = session.viewportCanvas;
        const { viewport } = settings;
        const aspect = canvas && canvas.height > 0 ? (canvas.width * viewport.width) / (canvas.height * viewport.height) : FALLBACK_ASPECT;
        const width = Math.max(1, Math.round(PREVIEW_HEIGHT * aspect));
        if (this.due(view, PREVIEW_FRAME_RATE, width, PREVIEW_HEIGHT, elapsedSeconds)) {
            const output = { backdrop: screenBackdrop(settings, false), content: 'color' as const };
            view.render(session, { entity, settings, output, width, height: PREVIEW_HEIGHT, elapsedSeconds });
        }
        return view.rendered ? { key, entityId: entity.id, canvas: view.canvas, aspect } : null;
    }
    private due(view: CameraView, frameRate: number, width: number, height: number, elapsedSeconds: number): boolean {
        if (frameRate <= 0 || !view.rendered)
            return true;
        if (view.canvas.width !== width || view.canvas.height !== height)
            return true;
        return elapsedSeconds - view.lastRender >= 1 / frameRate;
    }
    private acquire(key: string, transparent: boolean, used: Set<string>): CameraView | null {
        used.add(key);
        let view = this.views.get(key);
        if (view && view.transparent !== transparent) {
            view.dispose();
            this.views.delete(key);
            view = undefined;
        }
        if (!view) {
            if (this.views.size >= MAX_VIEWS) {
                this.warnBudget();
                return null;
            }
            view = new CameraView(transparent);
            this.views.set(key, view);
        }
        return view.failed ? null : view;
    }
    private warnBudget(): void {
        if (this.budgetWarned)
            return;
        this.budgetWarned = true;
        this.session.log.warn(LOG_SOURCE, `Limite de ${MAX_VIEWS} câmeras extras por quadro atingido; as demais não são desenhadas.`);
    }
    private releaseUnused(used: ReadonlySet<string>): void {
        for (const [key, view] of this.views) {
            if (used.has(key))
                continue;
            view.dispose();
            this.views.delete(key);
        }
        if (this.views.size < MAX_VIEWS)
            this.budgetWarned = false;
    }
    private publish(layers: readonly CameraScreenLayer[], preview: CameraPreview | null): void {
        const layerSignature = layers.map(({ key, viewport }) => `${key}:${viewport.x},${viewport.y},${viewport.width},${viewport.height}`).join('|');
        const previewSignature = preview ? `${preview.key}:${preview.entityId}:${preview.aspect.toFixed(3)}` : '';
        const signature = `${layerSignature}#${previewSignature}`;
        if (signature === this.signature)
            return;
        this.signature = signature;
        this.layers = layers;
        this.preview = preview;
        this.session.notify('view');
    }
}
