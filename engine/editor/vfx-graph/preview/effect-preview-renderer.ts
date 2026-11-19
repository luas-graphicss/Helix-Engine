import { ColorRenderTarget } from '@/engine/renderer/gl/color-render-target';
import { syncCanvasSize, WebGLUnsupportedError, type GL } from '@/engine/renderer/gl/context';
import { FullscreenTriangle } from '@/engine/renderer/gl/fullscreen-triangle';
import { ShaderProgram } from '@/engine/renderer/gl/shader-program';
import type { CompiledEffect } from '@/engine/vfx-graph/compiler/effect-compiler';
import { EffectInstance } from '@/engine/vfx-graph/runtime/effect-instance';
import { PreviewCamera } from './preview-camera';
import { PreviewGround } from './preview-ground';
import { SCREEN_VERTEX, TONEMAP_FRAGMENT } from './preview-shaders.glsl';
const MAX_FRAME_SECONDS = 0.05;
const BACKDROP_RADIANCE = 0.045;
const SCENE_TEXTURE_UNIT = 0;
export class EffectPreviewRenderer {
    private readonly gl: GL;
    private readonly instance: EffectInstance;
    private readonly camera = new PreviewCamera();
    private readonly ground: PreviewGround;
    private readonly triangle: FullscreenTriangle;
    private readonly tonemap: ShaderProgram;
    private readonly scene: ColorRenderTarget;
    private applied: CompiledEffect | null = null;
    private lastSeconds = 0;
    constructor(private readonly canvas: HTMLCanvasElement) {
        const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, powerPreference: 'high-performance' });
        if (!gl)
            throw new WebGLUnsupportedError();
        this.gl = gl;
        this.scene = new ColorRenderTarget(gl, { width: 1, height: 1, format: gl.getExtension('EXT_color_buffer_float') ? 'rgba16f' : 'rgba8' });
        this.instance = new EffectInstance(gl);
        this.ground = new PreviewGround(gl);
        this.triangle = new FullscreenTriangle(gl);
        this.tonemap = new ShaderProgram(gl, SCREEN_VERTEX, TONEMAP_FRAGMENT);
    }
    get error(): string | null {
        return this.instance.error;
    }
    get liveParticles(): number {
        return this.instance.liveParticles;
    }
    orbit(deltaYaw: number, deltaPitch: number): void {
        this.camera.orbit(deltaYaw, deltaPitch);
    }
    zoom(factor: number): void {
        this.camera.zoom(factor);
    }
    restart(): void {
        this.instance.restart();
    }
    render(compiled: CompiledEffect, timeMs: number, playing: boolean): void {
        const { gl, canvas, camera } = this;
        syncCanvasSize(canvas);
        const { width, height } = canvas;
        this.scene.resize(width, height);
        if (compiled !== this.applied) {
            this.instance.apply(compiled);
            this.applied = compiled;
        }
        const seconds = timeMs / 1000;
        const delta = this.lastSeconds > 0 ? Math.min(Math.max(seconds - this.lastSeconds, 0), MAX_FRAME_SECONDS) : 0;
        this.lastSeconds = seconds;
        if (playing && delta > 0)
            this.instance.simulate(delta);
        camera.update(width / Math.max(height, 1));
        this.scene.bind();
        gl.clearColor(BACKDROP_RADIANCE, BACKDROP_RADIANCE, BACKDROP_RADIANCE, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        this.ground.draw(camera.viewProjection);
        this.instance.draw(camera);
        this.present(width, height);
    }
    dispose(): void {
        this.instance.dispose();
        this.ground.dispose();
        this.triangle.dispose();
        this.tonemap.dispose();
        this.scene.dispose();
    }
    private present(width: number, height: number): void {
        const { gl, tonemap } = this;
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, width, height);
        tonemap.use();
        gl.activeTexture(gl.TEXTURE0 + SCENE_TEXTURE_UNIT);
        gl.bindTexture(gl.TEXTURE_2D, this.scene.texture);
        gl.uniform1i(tonemap.uniform('u_scene'), SCENE_TEXTURE_UNIT);
        this.triangle.draw();
        gl.bindTexture(gl.TEXTURE_2D, null);
    }
}
