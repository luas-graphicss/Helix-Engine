import type { Entity } from '@/engine/core/scene/entity';
import type { CameraSettings } from '@/engine/camera/camera-settings';
import { drawsInMask } from '@/engine/camera/layers/layer-draws';
import { aimCameraFromEntity, applyCameraLens, applyCameraOutput, type CameraOutput } from '@/engine/renderer/camera/camera-rig';
import { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import { createContext } from '@/engine/renderer/gl/context';
import { Renderer } from '@/engine/renderer/renderer';
import type { EditorSession } from '@/engine/editor/session/editor-session';
const MAX_DELTA_SECONDS = 0.1;
const FIRST_FRAME_DELTA_SECONDS = 1 / 60;
export interface CameraViewFrame {
    readonly entity: Entity;
    readonly settings: CameraSettings;
    readonly output: CameraOutput;
    readonly width: number;
    readonly height: number;
    readonly elapsedSeconds: number;
}
export class CameraView {
    readonly canvas = document.createElement('canvas');
    readonly camera = new PerspectiveCamera();
    failed = false;
    rendered = false;
    lastRender = -Infinity;
    private renderer: Renderer | null = null;
    private lastTick = 0;
    constructor(readonly transparent: boolean) {
        try {
            if (transparent)
                createContext(this.canvas, { offscreen: true, alpha: true });
            this.renderer = new Renderer(this.canvas, { offscreen: true });
        }
        catch (cause) {
            this.failed = true;
            console.error('[Helix] Câmera secundária indisponível:', cause);
        }
    }
    get warming(): boolean {
        return !this.rendered && !this.failed;
    }
    render(session: EditorSession, frame: CameraViewFrame): boolean {
        const { renderer, camera } = this;
        if (!renderer)
            return false;
        const { entity, settings, elapsedSeconds } = frame;
        const { scene } = session;
        renderer.setFixedSize(frame.width, frame.height);
        aimCameraFromEntity(camera, entity);
        applyCameraLens(camera, settings);
        applyCameraOutput(camera, settings, scene.postProcessing, frame.output);
        const deltaSeconds = this.lastTick > 0 ? Math.min(MAX_DELTA_SECONDS, elapsedSeconds - this.lastTick) : FIRST_FRAME_DELTA_SECONDS;
        this.lastTick = elapsedSeconds;
        try {
            renderer.render(scene, camera, {
                showGrid: false,
                shadows: session.shadowsEnabled,
                selection: null,
                showCsgBrushes: false,
                gizmo: null,
                skeletons: null,
                terrainBrush: null,
                lightHelpers: null,
                soundHelpers: null,
                vfxHelpers: null,
                guiSurfaces: drawsInMask(scene, session.guiWorld.system.draws, camera.layerMask),
                vfx: drawsInMask(scene, session.vfxWorld.system.draws, camera.layerMask),
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
            console.error('[Helix] Falha ao renderizar câmera secundária:', cause);
            return false;
        }
        if (!renderer.ready)
            return false;
        this.rendered = true;
        this.lastRender = elapsedSeconds;
        return true;
    }
    dispose(): void {
        this.renderer?.dispose();
        this.renderer = null;
        this.canvas.remove();
    }
}
