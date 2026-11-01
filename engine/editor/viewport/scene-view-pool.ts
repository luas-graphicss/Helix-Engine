import * as vec3 from '@/engine/core/math/vec3';
import type { Entity } from '@/engine/core/scene/entity';
import type { GuiViewDescription, GuiViewportProvider } from '@/engine/gui/media/gui-viewport-provider';
import { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import { Renderer } from '@/engine/renderer/renderer';
import type { EditorSession } from '@/engine/editor/session/editor-session';
const MAX_VIEWS = 4;
const MAX_VIEW_SIDE = 1024;
const IDLE_DISPOSE_SECONDS = 3;
const SNAPSHOT_DISPOSE_SECONDS = 60;
const MAX_DELTA_SECONDS = 0.1;
const DEG = Math.PI / 180;
class SceneView {
    readonly canvas = document.createElement('canvas');
    readonly camera = new PerspectiveCamera();
    renderer: Renderer | null = null;
    failed = false;
    lastRequest = 0;
    lastRender = -Infinity;
    lastTick = 0;
    rendered = false;
    private readonly forward = vec3.create();
    constructor(readonly key: string) {
        try {
            this.renderer = new Renderer(this.canvas, { offscreen: true });
        }
        catch (cause) {
            this.failed = true;
            console.error('[Helix] Visão secundária indisponível:', cause);
        }
    }
    get warming(): boolean {
        return !this.rendered && !this.failed;
    }
    aim(session: EditorSession, view: GuiViewDescription, aspect: number, elapsedSeconds: number): void {
        const { camera } = this;
        camera.aspect = aspect;
        camera.fovDegrees = Math.max(5, Math.min(150, view.fov));
        if (view.camera === 'entity') {
            const entity = findCamera(session, view.cameraName);
            if (entity) {
                const m = entity.worldMatrix;
                vec3.set(camera.position, m[12], m[13], m[14]);
                vec3.set(this.forward, -m[8], -m[9], -m[10]);
                if (vec3.length(this.forward) < 1e-6)
                    vec3.set(this.forward, 0, 0, -1);
                vec3.normalize(this.forward, this.forward);
                vec3.scaleAndAdd(camera.target, camera.position, this.forward, 10);
                return;
            }
            vec3.copy(camera.position, session.camera.position);
            vec3.copy(camera.target, session.camera.target);
            return;
        }
        const target = view.targetName ? findEntity(session, view.targetName) : null;
        if (target) {
            const m = target.worldMatrix;
            vec3.set(camera.target, m[12], m[13], m[14]);
        }
        else {
            vec3.set(camera.target, 0, 0, 0);
        }
        const yaw = (view.yaw + (view.yawOffset ?? 0) + view.autoRotate * elapsedSeconds) * DEG;
        const pitch = Math.max(-89, Math.min(89, view.pitch + (view.pitchOffset ?? 0))) * DEG;
        const distance = Math.max(0.05, view.distance * (view.distanceScale ?? 1));
        const horizontal = Math.cos(pitch) * distance;
        vec3.set(camera.position, camera.target[0] + Math.sin(yaw) * horizontal, camera.target[1] - Math.sin(pitch) * distance, camera.target[2] + Math.cos(yaw) * horizontal);
    }
    render(session: EditorSession, view: GuiViewDescription, width: number, height: number, elapsedSeconds: number): boolean {
        const { renderer } = this;
        if (!renderer)
            return false;
        renderer.setFixedSize(width, height);
        this.aim(session, view, width / height, elapsedSeconds);
        const deltaSeconds = this.lastTick > 0 ? Math.min(MAX_DELTA_SECONDS, elapsedSeconds - this.lastTick) : 1 / 60;
        this.lastTick = elapsedSeconds;
        try {
            renderer.render(session.scene, this.camera, {
                showGrid: view.grid,
                shadows: session.shadowsEnabled,
                selection: null,
                showCsgBrushes: false,
                gizmo: null,
                skeletons: null,
                terrainBrush: null,
                lightHelpers: null,
                soundHelpers: null,
                guiSurfaces: session.guiWorld.system.draws,
                vfx: session.vfxWorld.system.draws,
                vfxHelpers: null,
                soloLight: null,
                elapsedSeconds,
                deltaSeconds,
                culling: session.render.culling,
                lod: session.render.lod,
                myriad: session.render.myriad,
                terrainMaterialCache: session.render.terrain.materialCache,
                postCompareSplit: null,
                profileGpu: false,
            });
        }
        catch (cause) {
            this.failed = true;
            console.error('[Helix] Falha ao renderizar visão secundária:', cause);
            return false;
        }
        if (!renderer.ready)
            return false;
        this.rendered = true;
        this.lastRender = elapsedSeconds;
        return true;
    }
    snapshot(): HTMLCanvasElement | null {
        if (!this.rendered)
            return null;
        const copy = document.createElement('canvas');
        copy.width = this.canvas.width;
        copy.height = this.canvas.height;
        const context = copy.getContext('2d');
        if (!context)
            return null;
        context.drawImage(this.canvas, 0, 0);
        return copy;
    }
    dispose(): void {
        this.renderer?.dispose();
        this.renderer = null;
    }
}
interface Snapshot {
    readonly image: HTMLCanvasElement;
    lastRequest: number;
}
function findEntity(session: EditorSession, name: string): Entity | null {
    let found: Entity | null = null;
    session.scene.traverse((entity) => {
        if (!found && entity.name === name)
            found = entity;
    });
    return found;
}
function findCamera(session: EditorSession, name: string): Entity | null {
    if (name) {
        const named = findEntity(session, name);
        return named && named.kind === 'camera' ? named : null;
    }
    let found: Entity | null = null;
    session.scene.traverse((entity) => {
        if (!found && entity.kind === 'camera')
            found = entity;
    });
    return found;
}
export class SceneViewPool implements GuiViewportProvider {
    private readonly views = new Map<string, SceneView>();
    private readonly snapshots = new Map<string, Snapshot>();
    private now = 0;
    constructor(private readonly session: EditorSession) { }
    get size(): number {
        return this.views.size;
    }
    get animating(): boolean {
        if (this.views.size === 0)
            return false;
        if (this.session.playtest.state === 'playing' || this.session.animation.playing)
            return true;
        for (const entry of this.views.values())
            if (entry.warming)
                return true;
        return false;
    }
    frame(key: string, view: GuiViewDescription, width: number, height: number, elapsedSeconds: number): CanvasImageSource | null {
        if (typeof document === 'undefined')
            return null;
        this.now = elapsedSeconds;
        let entry = this.views.get(key);
        if (!entry) {
            if (this.views.size >= MAX_VIEWS)
                this.evictOldest();
            if (this.views.size >= MAX_VIEWS)
                return this.snapshotFor(key, elapsedSeconds);
            entry = new SceneView(key);
            this.views.set(key, entry);
        }
        entry.lastRequest = elapsedSeconds;
        if (entry.failed)
            return null;
        const scale = Math.max(0.25, Math.min(1, view.resolutionScale));
        const limit = MAX_VIEW_SIDE / Math.max(width, height, 1);
        const pixelWidth = Math.max(1, Math.round(width * Math.min(scale, limit)));
        const pixelHeight = Math.max(1, Math.round(height * Math.min(scale, limit)));
        const sizeChanged = entry.canvas.width !== pixelWidth || entry.canvas.height !== pixelHeight;
        const due = view.frameRate <= 0 || elapsedSeconds - entry.lastRender >= 1 / view.frameRate || sizeChanged || !entry.rendered;
        if (due)
            entry.render(this.session, view, pixelWidth, pixelHeight, elapsedSeconds);
        if (!entry.rendered)
            return this.snapshotFor(key, elapsedSeconds);
        this.snapshots.delete(key);
        return entry.canvas;
    }
    release(key: string): void {
        this.snapshots.delete(key);
        const entry = this.views.get(key);
        if (!entry)
            return;
        entry.dispose();
        this.views.delete(key);
    }
    collect(elapsedSeconds: number): void {
        this.now = elapsedSeconds;
        for (const entry of [...this.views.values()]) {
            if (elapsedSeconds - entry.lastRequest > IDLE_DISPOSE_SECONDS)
                this.park(entry);
        }
        for (const [key, snapshot] of [...this.snapshots.entries()]) {
            if (elapsedSeconds - snapshot.lastRequest > SNAPSHOT_DISPOSE_SECONDS)
                this.snapshots.delete(key);
        }
    }
    private park(entry: SceneView): void {
        const image = entry.snapshot();
        if (image)
            this.snapshots.set(entry.key, { image, lastRequest: entry.lastRequest });
        entry.dispose();
        this.views.delete(entry.key);
    }
    private snapshotFor(key: string, elapsedSeconds: number): HTMLCanvasElement | null {
        const snapshot = this.snapshots.get(key);
        if (!snapshot)
            return null;
        snapshot.lastRequest = elapsedSeconds;
        return snapshot.image;
    }
    private evictOldest(): void {
        let oldest: SceneView | null = null;
        for (const entry of this.views.values())
            if (!oldest || entry.lastRequest < oldest.lastRequest)
                oldest = entry;
        if (oldest && this.now - oldest.lastRequest > 0.5)
            this.park(oldest);
    }
    dispose(): void {
        for (const entry of this.views.values())
            entry.dispose();
        this.views.clear();
        this.snapshots.clear();
    }
}
