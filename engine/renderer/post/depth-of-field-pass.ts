import type { DepthOfFieldSettings } from '@/engine/core/environment/post-process-settings';
import type { GL } from '@/engine/renderer/gl/context';
import { ColorRenderTarget, type ColorFormat } from '@/engine/renderer/gl/color-render-target';
import type { FullscreenTriangle } from '@/engine/renderer/gl/fullscreen-triangle';
import { ShaderProgram } from '@/engine/renderer/gl/shader-program';
import { withDefines, type ShaderDefines } from '@/engine/renderer/gl/shader-source';
import { FULLSCREEN_VERTEX_SHADER } from '@/engine/renderer/shaders/chunks/fullscreen.glsl';
import { DOF_BLUR_FRAGMENT_SHADER, DOF_PREFILTER_FRAGMENT_SHADER } from '@/engine/renderer/shaders/post/depth-of-field.glsl';
import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
const COLOR_UNIT = 0;
const DEPTH_UNIT = 1;
const SENSOR_HEIGHT_M = 0.024;
export interface CocParams {
    focusDistance: number;
    coefficient: number;
    maxCocUv: number;
}
export function computeCocParams(settings: DepthOfFieldSettings, height: number): CocParams {
    const focalLength = settings.focalLength / 1000;
    const aperture = focalLength / Math.max(settings.aperture, 0.5);
    const focusDistance = Math.max(settings.focusDistance, focalLength + 0.01);
    const coefficient = (0.5 * aperture * focalLength) / ((focusDistance - focalLength) * SENSOR_HEIGHT_M);
    return { focusDistance, coefficient, maxCocUv: Math.max(settings.maxBlur, 1) / Math.max(height, 1) };
}
export class DepthOfFieldPass {
    readonly stats = { drawCalls: 0 };
    private readonly prefilterProgram: ShaderProgram;
    private readonly blurProgram: ShaderProgram;
    private readonly prefiltered: ColorRenderTarget;
    private readonly blurred: ColorRenderTarget;
    constructor(private readonly gl: GL, private readonly triangle: FullscreenTriangle, format: ColorFormat, taps: number, defines: ShaderDefines) {
        this.prefilterProgram = new ShaderProgram(gl, FULLSCREEN_VERTEX_SHADER, withDefines(DOF_PREFILTER_FRAGMENT_SHADER, defines));
        this.blurProgram = new ShaderProgram(gl, FULLSCREEN_VERTEX_SHADER, withDefines(DOF_BLUR_FRAGMENT_SHADER, { ...defines, DOF_TAPS: taps }));
        this.prefiltered = new ColorRenderTarget(gl, { width: 1, height: 1, format, filter: 'linear' });
        this.blurred = new ColorRenderTarget(gl, { width: 1, height: 1, format, filter: 'linear' });
    }
    render(sceneColor: WebGLTexture, sceneDepth: WebGLTexture, camera: PerspectiveCamera, width: number, height: number, coc: CocParams): WebGLTexture {
        const { gl, triangle } = this;
        const halfWidth = Math.max(1, Math.floor(width / 2));
        const halfHeight = Math.max(1, Math.floor(height / 2));
        this.prefiltered.resize(halfWidth, halfHeight);
        this.blurred.resize(halfWidth, halfHeight);
        this.prefiltered.bind();
        this.prefilterProgram.use();
        gl.activeTexture(gl.TEXTURE0 + COLOR_UNIT);
        gl.bindTexture(gl.TEXTURE_2D, sceneColor);
        gl.uniform1i(this.prefilterProgram.uniform('u_color'), COLOR_UNIT);
        gl.activeTexture(gl.TEXTURE0 + DEPTH_UNIT);
        gl.bindTexture(gl.TEXTURE_2D, sceneDepth);
        gl.uniform1i(this.prefilterProgram.uniform('u_depth'), DEPTH_UNIT);
        gl.uniform2f(this.prefilterProgram.uniform('u_sourceTexel'), 1 / width, 1 / height);
        gl.uniform2f(this.prefilterProgram.uniform('u_targetTexel'), 1 / halfWidth, 1 / halfHeight);
        gl.uniform4f(this.prefilterProgram.uniform('u_cocParams'), coc.focusDistance, coc.coefficient, coc.maxCocUv, 0);
        gl.uniform2f(this.prefilterProgram.uniform('u_depthParams'), camera.near, camera.far);
        triangle.draw();
        this.blurred.bind();
        this.blurProgram.use();
        gl.activeTexture(gl.TEXTURE0 + COLOR_UNIT);
        gl.bindTexture(gl.TEXTURE_2D, this.prefiltered.texture);
        gl.uniform1i(this.blurProgram.uniform('u_source'), COLOR_UNIT);
        gl.uniform2f(this.blurProgram.uniform('u_texel'), 1 / halfWidth, 1 / halfHeight);
        gl.uniform1f(this.blurProgram.uniform('u_maxCoc'), coc.maxCocUv);
        gl.uniform1f(this.blurProgram.uniform('u_rcpAspect'), halfHeight / halfWidth);
        triangle.draw();
        gl.activeTexture(gl.TEXTURE0 + DEPTH_UNIT);
        gl.bindTexture(gl.TEXTURE_2D, null);
        this.stats.drawCalls = 2;
        return this.blurred.texture;
    }
    dispose(): void {
        this.prefilterProgram.dispose();
        this.blurProgram.dispose();
        this.prefiltered.dispose();
        this.blurred.dispose();
    }
}
