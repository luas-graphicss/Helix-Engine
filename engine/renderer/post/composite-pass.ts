import type { PostProcessSettings } from '@/engine/core/environment/post-process-settings';
import { linearToSrgb } from '@/engine/core/color/srgb';
import type { GL } from '@/engine/renderer/gl/context';
import type { FullscreenTriangle } from '@/engine/renderer/gl/fullscreen-triangle';
import { ShaderProgram } from '@/engine/renderer/gl/shader-program';
import { withDefines, type ShaderDefines } from '@/engine/renderer/gl/shader-source';
import { FULLSCREEN_VERTEX_SHADER } from '@/engine/renderer/shaders/chunks/fullscreen.glsl';
import { COMPOSITE_FRAGMENT_SHADER } from '@/engine/renderer/shaders/post/composite.glsl';
import { TONE_MAPPER_INDEX } from '@/engine/renderer/shaders/post/tonemapping.glsl';
import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import type { CocParams } from './depth-of-field-pass';
import { whiteBalanceCoefficients } from './white-balance';
const COLOR_UNIT = 0;
const DEPTH_UNIT = 1;
const BLOOM_UNIT = 2;
const DOF_UNIT = 3;
const TEXTURE_UNITS = [DOF_UNIT, BLOOM_UNIT, DEPTH_UNIT, COLOR_UNIT] as const;
export interface CompositeInput {
    sceneColor: WebGLTexture;
    sceneDepth: WebGLTexture;
    bloom: WebGLTexture | null;
    depthOfField: {
        texture: WebGLTexture;
        coc: CocParams;
    } | null;
    camera: PerspectiveCamera;
    settings: PostProcessSettings;
    width: number;
    height: number;
    elapsedSeconds: number;
    compareSplit: number | null;
}
export class CompositePass {
    private readonly program: ShaderProgram;
    private readonly whiteBalance = new Float32Array(3);
    constructor(private readonly gl: GL, private readonly triangle: FullscreenTriangle, defines: ShaderDefines) {
        this.program = new ShaderProgram(gl, FULLSCREEN_VERTEX_SHADER, withDefines(COMPOSITE_FRAGMENT_SHADER, defines));
    }
    render(input: CompositeInput): void {
        const { gl, program, triangle } = this;
        const { settings, width, height } = input;
        const active = settings.enabled;
        program.use();
        this.bindTexture(input.sceneColor, COLOR_UNIT, 'u_color');
        this.bindTexture(input.sceneDepth, DEPTH_UNIT, 'u_depth');
        this.bindTexture(input.bloom ?? input.sceneColor, BLOOM_UNIT, 'u_bloom');
        this.bindTexture(input.depthOfField?.texture ?? input.sceneColor, DOF_UNIT, 'u_dof');
        gl.uniform2f(program.uniform('u_texel'), 1 / width, 1 / height);
        gl.uniform1f(program.uniform('u_aspect'), width / height);
        const { lensDistortion, chromaticAberration, bloom, grading, whiteBalance, vignette, filmGrain } = settings;
        const distortionOn = active && lensDistortion.enabled;
        gl.uniform2f(program.uniform('u_distortion'), distortionOn ? lensDistortion.intensity : 0, distortionOn ? Math.max(lensDistortion.scale, 1) : 1);
        gl.uniform1f(program.uniform('u_chromatic'), active && chromaticAberration.enabled ? chromaticAberration.intensity : 0);
        gl.uniform1f(program.uniform('u_dofEnabled'), input.depthOfField ? 1 : 0);
        if (input.depthOfField) {
            const { coc } = input.depthOfField;
            gl.uniform4f(program.uniform('u_cocParams'), coc.focusDistance, coc.coefficient, coc.maxCocUv, 0);
        }
        else {
            gl.uniform4f(program.uniform('u_cocParams'), 1, 0, 1, 0);
        }
        gl.uniform2f(program.uniform('u_depthParams'), input.camera.near, input.camera.far);
        gl.uniform1f(program.uniform('u_bloomIntensity'), input.bloom && bloom.enabled ? bloom.intensity : 0);
        gl.uniform1f(program.uniform('u_exposureScale'), active ? 2 ** settings.exposure : 1);
        if (active)
            whiteBalanceCoefficients(this.whiteBalance, whiteBalance.temperature, whiteBalance.tint);
        else
            this.whiteBalance.fill(1);
        gl.uniform3fv(program.uniform('u_whiteBalance'), this.whiteBalance);
        gl.uniform1i(program.uniform('u_toneMapper'), active ? TONE_MAPPER_INDEX[settings.toneMapper] : TONE_MAPPER_INDEX.aces);
        if (active) {
            gl.uniform4f(program.uniform('u_grading'), grading.contrast, grading.saturation, grading.vibrance, grading.toneBalance);
            gl.uniform3f(program.uniform('u_tones'), grading.shadows, grading.midtones, grading.highlights);
            const s = grading.shadowTint;
            const h = grading.highlightTint;
            gl.uniform3f(program.uniform('u_shadowTint'), linearToSrgb(s[0]), linearToSrgb(s[1]), linearToSrgb(s[2]));
            gl.uniform3f(program.uniform('u_highlightTint'), linearToSrgb(h[0]), linearToSrgb(h[1]), linearToSrgb(h[2]));
        }
        else {
            gl.uniform4f(program.uniform('u_grading'), 0, 0, 0, 0);
            gl.uniform3f(program.uniform('u_tones'), 0, 0, 0);
            gl.uniform3f(program.uniform('u_shadowTint'), 0.5, 0.5, 0.5);
            gl.uniform3f(program.uniform('u_highlightTint'), 0.5, 0.5, 0.5);
        }
        const vignetteOn = active && vignette.enabled;
        gl.uniform3f(program.uniform('u_vignette'), vignetteOn ? vignette.intensity : 0, vignette.smoothness, vignette.roundness);
        const grainOn = active && filmGrain.enabled;
        gl.uniform4f(program.uniform('u_grain'), grainOn ? filmGrain.intensity : 0, filmGrain.size, filmGrain.luminanceResponse, input.elapsedSeconds % 1000);
        gl.uniform1f(program.uniform('u_compareSplit'), input.compareSplit ?? -1);
        triangle.draw();
        for (const unit of TEXTURE_UNITS) {
            gl.activeTexture(gl.TEXTURE0 + unit);
            gl.bindTexture(gl.TEXTURE_2D, null);
        }
    }
    private bindTexture(texture: WebGLTexture, unit: number, name: string): void {
        const { gl } = this;
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.uniform1i(this.program.uniform(name), unit);
    }
    dispose(): void {
        this.program.dispose();
    }
}
