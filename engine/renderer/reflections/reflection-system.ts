import type { Vec3 } from '@/engine/core/math/vec3';
import type { GL } from '@/engine/renderer/gl/context';
import type { ColorFormat } from '@/engine/renderer/gl/color-render-target';
import type { FullscreenTriangle } from '@/engine/renderer/gl/fullscreen-triangle';
import type { SceneRenderTarget } from '@/engine/renderer/gl/scene-render-target';
import type { ShaderDefines } from '@/engine/renderer/gl/shader-source';
import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import type { RenderProfile } from '@/engine/renderer/quality/render-profile';
import type { WaterScreenReflections } from '@/engine/renderer/passes/water-pass';
import { ReflectionProbe } from './probe/reflection-probe';
import { createReflectionBinding, type ReflectionBinding } from './reflection-binding';
import type { ReflectionSettings } from './reflection-settings';
import { SceneHistory } from './screen/scene-history';
import { ScreenReflectionPass } from './screen/screen-reflection-pass';
import { SurfaceBuffer } from './screen/surface-buffer';
export interface ReflectionFormats {
    scene: ColorFormat;
    sceneAlpha: ColorFormat;
}
export interface ReflectionStats {
    probeFaces: number;
    probePrefiltered: boolean;
    screenTraced: boolean;
    drawCalls: number;
}
export class ReflectionSystem {
    readonly binding: ReflectionBinding;
    readonly probe: ReflectionProbe;
    readonly surfaceBuffer: SurfaceBuffer;
    readonly history: SceneHistory;
    readonly stats: ReflectionStats = { probeFaces: 0, probePrefiltered: false, screenTraced: false, drawCalls: 0 };
    private readonly screenPass: ScreenReflectionPass;
    private readonly waterTrace: WaterScreenReflections;
    private settings: ReflectionSettings | null = null;
    constructor(gl: GL, triangle: FullscreenTriangle, private readonly profile: RenderProfile, formats: ReflectionFormats, defines: ShaderDefines) {
        this.probe = new ReflectionProbe(gl, triangle, profile.reflectionProbeSize, formats.scene, defines);
        this.surfaceBuffer = new SurfaceBuffer(gl);
        this.history = new SceneHistory(gl, formats.scene);
        this.screenPass = new ScreenReflectionPass(gl, triangle, formats.sceneAlpha, defines);
        this.binding = createReflectionBinding(this.probe.prefiltered, this.screenPass.texture);
        this.binding.probeMaxLod = this.probe.maxLod;
        this.binding.screenMaxLod = this.screenPass.maxLod;
        this.waterTrace = { steps: profile.screenReflectionSteps, stride: profile.screenReflectionStride };
    }
    beginFrame(settings: ReflectionSettings, sceneWidth: number, sceneHeight: number): void {
        const { binding } = this;
        this.settings = settings;
        this.stats.probeFaces = 0;
        this.stats.probePrefiltered = false;
        this.stats.screenTraced = false;
        this.stats.drawCalls = 0;
        binding.intensity = Math.max(0, settings.intensity);
        binding.probeValid = settings.probe && this.probe.valid;
        binding.screenValid = false;
        binding.screenInverseSceneSize[0] = 1 / sceneWidth;
        binding.screenInverseSceneSize[1] = 1 / sceneHeight;
    }
    get screenReflectionsWanted(): boolean {
        return (this.settings?.screenSpace ?? false) && this.binding.intensity > 0;
    }
    get waterScreenReflections(): WaterScreenReflections | null {
        if (!this.settings?.water || this.binding.intensity <= 0)
            return null;
        return this.waterTrace;
    }
    wantsProbeFace(camera: PerspectiveCamera, sunDirection: Vec3, sceneAnimating: boolean): boolean {
        if (!this.settings || !this.settings.probe || this.binding.intensity <= 0)
            return false;
        return this.probe.update(camera, sunDirection, sceneAnimating);
    }
    endProbeFace(): void {
        this.probe.endFace();
        this.stats.probeFaces = this.probe.stats.facesRendered;
        this.stats.probePrefiltered = this.probe.stats.prefiltered;
        this.stats.drawCalls += this.probe.stats.drawCalls;
        if (this.probe.valid && this.settings?.probe)
            this.binding.probeValid = true;
    }
    bindSurfaceBuffer(scene: SceneRenderTarget): void {
        this.surfaceBuffer.attach(scene);
        this.surfaceBuffer.bindAndClear();
    }
    renderScreenReflections(camera: PerspectiveCamera, scene: SceneRenderTarget): void {
        const settings = this.settings;
        if (!settings || !settings.screenSpace || this.binding.intensity <= 0 || !this.history.valid || !camera.invertible)
            return;
        const { profile } = this;
        const width = Math.max(1, Math.round(scene.width * profile.screenReflectionScale));
        const height = Math.max(1, Math.round(scene.height * profile.screenReflectionScale));
        this.screenPass.render({
            camera,
            depth: scene.depth,
            surface: this.surfaceBuffer,
            history: this.history,
            sceneWidth: scene.width,
            sceneHeight: scene.height,
            steps: profile.screenReflectionSteps,
            stride: profile.screenReflectionStride,
            roughnessCutoff: this.binding.screenRoughnessCutoff,
        }, width, height);
        this.binding.screen = this.screenPass.texture;
        this.binding.screenValid = true;
        this.stats.screenTraced = true;
        this.stats.drawCalls += this.screenPass.stats.drawCalls;
    }
    captureHistory(scene: SceneRenderTarget, camera: PerspectiveCamera): void {
        if (!this.settings || !this.settings.screenSpace || this.binding.intensity <= 0) {
            this.history.invalidate();
            return;
        }
        this.history.capture(scene, camera);
    }
    get capturing(): boolean {
        return this.probe.capturing;
    }
    dispose(): void {
        this.probe.dispose();
        this.surfaceBuffer.dispose();
        this.history.dispose();
        this.screenPass.dispose();
    }
}
