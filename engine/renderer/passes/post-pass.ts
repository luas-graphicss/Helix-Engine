import type { PostProcessSettings } from '@/engine/core/environment/post-process-settings';
import type { GL } from '@/engine/renderer/gl/context';
import { ColorRenderTarget, type ColorFormat } from '@/engine/renderer/gl/color-render-target';
import type { FullscreenTriangle } from '@/engine/renderer/gl/fullscreen-triangle';
import { ShaderProgram } from '@/engine/renderer/gl/shader-program';
import type { ShaderDefines } from '@/engine/renderer/gl/shader-source';
import { OverlayRenderTarget, type SceneRenderTarget } from '@/engine/renderer/gl/scene-render-target';
import { FULLSCREEN_VERTEX_SHADER } from '@/engine/renderer/shaders/chunks/fullscreen.glsl';
import { UPSCALE_FRAGMENT_SHADER } from '@/engine/renderer/shaders/post/upscale.glsl';
import type { RenderProfile } from '@/engine/renderer/quality/render-profile';
import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import { BloomPass } from '@/engine/renderer/post/bloom-pass';
import { CompositePass } from '@/engine/renderer/post/composite-pass';
import { computeCocParams, DepthOfFieldPass } from '@/engine/renderer/post/depth-of-field-pass';
import { SharpenPass } from '@/engine/renderer/post/sharpen-pass';
import { SmaaPass } from '@/engine/renderer/post/smaa-pass';
export interface PostResolveInput {
    camera: PerspectiveCamera;
    settings: PostProcessSettings;
    elapsedSeconds: number;
    compareSplit: number | null;
}
export class PostPass {
    readonly stats = { drawCalls: 0 };
    private readonly overlay: OverlayRenderTarget;
    private readonly bloom: BloomPass;
    private readonly depthOfField: DepthOfFieldPass;
    private readonly composite: CompositePass;
    private readonly smaa: SmaaPass;
    private readonly sharpen: SharpenPass;
    private readonly antialiased: ColorRenderTarget;
    private readonly scaled: ColorRenderTarget;
    private readonly captured: ColorRenderTarget;
    private readonly upscale: ShaderProgram;
    constructor(gl: GL, triangle: FullscreenTriangle, profile: RenderProfile, sceneFormat: ColorFormat, alphaFormat: ColorFormat, defines: ShaderDefines) {
        this.gl = gl;
        this.triangle = triangle;
        this.overlay = new OverlayRenderTarget(gl);
        this.bloom = new BloomPass(gl, triangle, sceneFormat, profile.bloomLevels, profile.bloomStartScale, defines);
        this.depthOfField = new DepthOfFieldPass(gl, triangle, alphaFormat, profile.depthOfFieldTaps, defines);
        this.composite = new CompositePass(gl, triangle, defines);
        this.smaa = new SmaaPass(gl, triangle, profile);
        this.sharpen = new SharpenPass(gl, triangle);
        this.antialiased = new ColorRenderTarget(gl, { width: 1, height: 1, format: 'rgba8', filter: 'nearest' });
        this.scaled = new ColorRenderTarget(gl, { width: 1, height: 1, format: 'rgba8', filter: 'linear' });
        this.captured = new ColorRenderTarget(gl, { width: 1, height: 1, format: 'rgba8', filter: 'nearest' });
        this.upscale = new ShaderProgram(gl, FULLSCREEN_VERTEX_SHADER, UPSCALE_FRAGMENT_SHADER);
    }
    get capturedFrame(): ColorRenderTarget {
        return this.captured;
    }
    private readonly gl: GL;
    private readonly triangle: FullscreenTriangle;
    get antialiasing(): boolean {
        return this.smaa.antialiasing;
    }
    setQuality(bloomLevelsDrop: number, skipAntialias: boolean): void {
        this.bloom.levelsDrop = bloomLevelsDrop;
        this.smaa.bypass = skipAntialias;
    }
    settled(settings: PostProcessSettings): boolean {
        if (this.smaa.loading)
            return false;
        return !(settings.enabled && settings.filmGrain.enabled && settings.filmGrain.intensity > 0);
    }
    resolve(scene: SceneRenderTarget, input: PostResolveInput): void {
        const { gl } = this;
        const { settings, camera } = input;
        const { width, height } = scene;
        this.stats.drawCalls = 0;
        gl.disable(gl.DEPTH_TEST);
        gl.depthMask(false);
        const active = settings.enabled;
        let bloom: WebGLTexture | null = null;
        if (active && settings.bloom.enabled && settings.bloom.intensity > 0) {
            bloom = this.bloom.render(scene.color, width, height, settings.bloom);
            this.stats.drawCalls += this.bloom.stats.drawCalls;
        }
        let depthOfField: {
            texture: WebGLTexture;
            coc: ReturnType<typeof computeCocParams>;
        } | null = null;
        if (active && settings.depthOfField.enabled) {
            const coc = computeCocParams(settings.depthOfField, height);
            const texture = this.depthOfField.render(scene.color, scene.depth, camera, width, height, coc);
            this.stats.drawCalls += this.depthOfField.stats.drawCalls;
            depthOfField = { texture, coc };
        }
        this.overlay.attach(scene);
        this.overlay.bindForComposite();
        this.composite.render({
            sceneColor: scene.color,
            sceneDepth: scene.depth,
            bloom,
            depthOfField,
            camera,
            settings,
            width,
            height,
            elapsedSeconds: input.elapsedSeconds,
            compareSplit: input.compareSplit,
        });
        this.stats.drawCalls++;
        this.overlay.bind();
        gl.depthMask(true);
        gl.enable(gl.DEPTH_TEST);
    }
    bindOverlayTarget(): void {
        this.overlay.bind();
    }
    get overlayTarget(): OverlayRenderTarget {
        return this.overlay;
    }
    compose(settings: PostProcessSettings, width: number, height: number, canvasWidth = width, canvasHeight = height, capture = false): void {
        const { gl } = this;
        gl.disable(gl.DEPTH_TEST);
        gl.depthMask(false);
        let final: WebGLFramebuffer | null = null;
        if (capture) {
            this.captured.resize(canvasWidth, canvasHeight);
            final = this.captured.framebuffer;
        }
        const upscaling = canvasWidth !== width || canvasHeight !== height;
        let output = final;
        if (upscaling) {
            this.scaled.resize(width, height);
            output = this.scaled.framebuffer;
        }
        const sharpen = settings.enabled && settings.sharpen.enabled && settings.sharpen.intensity > 0;
        if (sharpen) {
            this.antialiased.resize(width, height);
            this.smaa.render(this.overlay.color, width, height, this.antialiased.framebuffer);
            this.sharpen.render(this.antialiased.texture, width, height, settings.sharpen.intensity, output);
            this.stats.drawCalls += this.smaa.stats.drawCalls + 1;
        }
        else {
            this.smaa.render(this.overlay.color, width, height, output);
            this.stats.drawCalls += this.smaa.stats.drawCalls;
        }
        if (upscaling) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, final);
            gl.viewport(0, 0, canvasWidth, canvasHeight);
            this.upscale.use();
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.scaled.texture);
            gl.uniform1i(this.upscale.uniform('u_color'), 0);
            gl.uniform2f(this.upscale.uniform('u_outputTexel'), 1 / canvasWidth, 1 / canvasHeight);
            this.triangle.draw();
            gl.bindTexture(gl.TEXTURE_2D, null);
            this.stats.drawCalls++;
        }
        if (capture)
            this.presentCaptured(canvasWidth, canvasHeight);
        gl.depthMask(true);
        gl.enable(gl.DEPTH_TEST);
    }
    private presentCaptured(width: number, height: number): void {
        const { gl } = this;
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.captured.framebuffer);
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
        gl.blitFramebuffer(0, 0, width, height, 0, 0, width, height, gl.COLOR_BUFFER_BIT, gl.NEAREST);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, width, height);
    }
    dispose(): void {
        this.overlay.dispose();
        this.bloom.dispose();
        this.depthOfField.dispose();
        this.composite.dispose();
        this.smaa.dispose();
        this.sharpen.dispose();
        this.antialiased.dispose();
        this.scaled.dispose();
        this.captured.dispose();
        this.upscale.dispose();
    }
}
