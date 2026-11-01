import type { GL } from '@/engine/renderer/gl/context';
import { framebufferStatus } from '@/engine/renderer/gl/framebuffer-status';
import type { FullscreenTriangle } from '@/engine/renderer/gl/fullscreen-triangle';
import { ShaderProgram } from '@/engine/renderer/gl/shader-program';
import { withDefines } from '@/engine/renderer/gl/shader-source';
import { FULLSCREEN_VERTEX_SHADER } from '@/engine/renderer/shaders/chunks/fullscreen.glsl';
import { SCREEN_OCCLUSION_RADIUS_METERS } from '@/engine/renderer/shaders/chunks/screen-occlusion.glsl';
import { SHADOW_MASK_FRAGMENT_SHADER } from '@/engine/renderer/shaders/shadow-mask.glsl';
import { bindCloudShadowUniforms, bindShadowSamplingUniforms } from '@/engine/renderer/lighting/shadow-sampling-uniforms';
import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import type { SkyLightingBinding } from '@/engine/renderer/sky/sky-system';
import type { ShadowMapBinding } from './shadow-pass';
const DEPTH_UNIT = 0;
const SHADOW_MAP_UNIT = 1;
const CLOUD_SHADOW_UNIT = 2;
const SHADOW_DEPTH_UNIT = 3;
export interface ShadowMaskInput {
    camera: PerspectiveCamera;
    depth: WebGLTexture;
    shadow: ShadowMapBinding;
    sky: SkyLightingBinding;
    lightDirection: Float32Array;
}
export interface ShadowMaskBinding {
    texture: WebGLTexture;
    valid: boolean;
    readonly scale: number;
}
export class ShadowMaskPass {
    readonly binding: ShadowMaskBinding;
    private readonly program: ShaderProgram;
    private readonly blockSize: number;
    private readonly rawDepthSampler: WebGLSampler;
    private framebuffer: WebGLFramebuffer;
    private texture: WebGLTexture;
    private width = 0;
    private height = 0;
    constructor(private readonly gl: GL, private readonly triangle: FullscreenTriangle, scale: number) {
        this.blockSize = Math.max(1, Math.round(1 / Math.min(Math.max(scale, 0.25), 1)));
        const effectiveScale = 1 / this.blockSize;
        this.program = new ShaderProgram(gl, FULLSCREEN_VERTEX_SHADER, withDefines(SHADOW_MASK_FRAGMENT_SHADER, { SHADOW_MASK_BLOCK: this.blockSize }));
        const framebuffer = gl.createFramebuffer();
        const texture = gl.createTexture();
        const sampler = gl.createSampler();
        if (!framebuffer || !texture || !sampler)
            throw new Error('Não foi possível alocar a máscara de sombra.');
        this.framebuffer = framebuffer;
        this.texture = texture;
        this.rawDepthSampler = sampler;
        gl.samplerParameteri(sampler, gl.TEXTURE_COMPARE_MODE, gl.NONE);
        gl.samplerParameteri(sampler, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.samplerParameteri(sampler, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.samplerParameteri(sampler, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.samplerParameteri(sampler, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        this.allocate(1, 1);
        this.binding = { texture: this.texture, valid: false, scale: effectiveScale };
    }
    render(input: ShadowMaskInput, width: number, height: number): number {
        const { gl, program, blockSize } = this;
        const maskWidth = Math.ceil(width / blockSize);
        const maskHeight = Math.ceil(height / blockSize);
        if (maskWidth !== this.width || maskHeight !== this.height)
            this.allocate(maskWidth, maskHeight);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
        gl.viewport(0, 0, maskWidth, maskHeight);
        gl.disable(gl.DEPTH_TEST);
        program.use();
        gl.uniformMatrix4fv(program.uniform('u_inverseViewProjection'), false, input.camera.inverseViewProjectionMatrix);
        gl.uniform3fv(program.uniform('u_cameraPosition'), input.camera.position);
        gl.uniform3fv(program.uniform('u_lightDirection'), input.lightDirection);
        const focalPixels = (input.camera.projectionMatrix[5] * height) / 2;
        gl.uniform2f(program.uniform('u_screenOcclusion'), SCREEN_OCCLUSION_RADIUS_METERS, SCREEN_OCCLUSION_RADIUS_METERS * focalPixels);
        gl.activeTexture(gl.TEXTURE0 + DEPTH_UNIT);
        gl.bindTexture(gl.TEXTURE_2D, input.depth);
        gl.uniform1i(program.uniform('u_depth'), DEPTH_UNIT);
        bindShadowSamplingUniforms(gl, program, input.shadow, SHADOW_MAP_UNIT);
        bindCloudShadowUniforms(gl, program, input.sky.cloudShadow, CLOUD_SHADOW_UNIT);
        gl.activeTexture(gl.TEXTURE0 + SHADOW_DEPTH_UNIT);
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, input.shadow.texture);
        gl.bindSampler(SHADOW_DEPTH_UNIT, this.rawDepthSampler);
        gl.uniform1i(program.uniform('u_shadowDepth'), SHADOW_DEPTH_UNIT);
        this.triangle.draw();
        gl.bindSampler(SHADOW_DEPTH_UNIT, null);
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
        gl.activeTexture(gl.TEXTURE0 + DEPTH_UNIT);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.enable(gl.DEPTH_TEST);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        this.binding.valid = true;
        return 1;
    }
    skip(): void {
        this.binding.valid = false;
    }
    private allocate(width: number, height: number): void {
        const { gl } = this;
        if (this.width > 0) {
            gl.deleteTexture(this.texture);
            const texture = gl.createTexture();
            if (!texture)
                throw new Error('Não foi possível realocar a máscara de sombra.');
            this.texture = texture;
            this.binding.texture = texture;
        }
        this.width = width;
        this.height = height;
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA16UI, width, height);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0);
        const status = framebufferStatus(gl, 'shadow-mask');
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        if (status !== gl.FRAMEBUFFER_COMPLETE)
            throw new Error(`Máscara de sombra incompleta (0x${status.toString(16)}).`);
    }
    dispose(): void {
        const { gl } = this;
        this.program.dispose();
        gl.deleteFramebuffer(this.framebuffer);
        gl.deleteTexture(this.texture);
        gl.deleteSampler(this.rawDepthSampler);
    }
}
