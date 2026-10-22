import type { GL } from '@/engine/renderer/gl/context';
import type { FullscreenTriangle } from '@/engine/renderer/gl/fullscreen-triangle';
import { ShaderProgram } from '@/engine/renderer/gl/shader-program';
import { FULLSCREEN_VERTEX_SHADER } from '@/engine/renderer/shaders/chunks/fullscreen.glsl';
import { SHADOW_MASK_FRAGMENT_SHADER } from '@/engine/renderer/shaders/shadow-mask.glsl';
import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import type { SkyLightingBinding } from '@/engine/renderer/sky/sky-system';
import type { ShadowMapBinding } from './shadow-pass';
const DEPTH_UNIT = 0;
const SHADOW_MAP_UNIT = 1;
const CLOUD_SHADOW_UNIT = 2;
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
}
export class ShadowMaskPass {
    readonly binding: ShadowMaskBinding;
    private readonly program: ShaderProgram;
    private framebuffer: WebGLFramebuffer;
    private texture: WebGLTexture;
    private width = 0;
    private height = 0;
    constructor(private readonly gl: GL, private readonly triangle: FullscreenTriangle) {
        this.program = new ShaderProgram(gl, FULLSCREEN_VERTEX_SHADER, SHADOW_MASK_FRAGMENT_SHADER);
        const framebuffer = gl.createFramebuffer();
        const texture = gl.createTexture();
        if (!framebuffer || !texture)
            throw new Error('Não foi possível alocar a máscara de sombra.');
        this.framebuffer = framebuffer;
        this.texture = texture;
        this.allocate(1, 1);
        this.binding = { texture: this.texture, valid: false };
    }
    render(input: ShadowMaskInput, width: number, height: number): number {
        const { gl, program } = this;
        if (width !== this.width || height !== this.height)
            this.allocate(width, height);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
        gl.viewport(0, 0, width, height);
        gl.disable(gl.DEPTH_TEST);
        program.use();
        gl.uniformMatrix4fv(program.uniform('u_inverseViewProjection'), false, input.camera.inverseViewProjectionMatrix);
        gl.uniform3fv(program.uniform('u_cameraPosition'), input.camera.position);
        gl.uniform3fv(program.uniform('u_lightDirection'), input.lightDirection);
        gl.activeTexture(gl.TEXTURE0 + DEPTH_UNIT);
        gl.bindTexture(gl.TEXTURE_2D, input.depth);
        gl.uniform1i(program.uniform('u_depth'), DEPTH_UNIT);
        const { shadow, sky } = input;
        gl.activeTexture(gl.TEXTURE0 + SHADOW_MAP_UNIT);
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, shadow.texture);
        gl.uniform1i(program.uniform('u_shadowMap'), SHADOW_MAP_UNIT);
        gl.uniform1f(program.uniform('u_shadowEnabled'), shadow.active ? 1 : 0);
        gl.uniformMatrix4fv(program.uniform('u_shadowMatrix[0]'), false, shadow.shadowMatrices);
        gl.uniform1fv(program.uniform('u_shadowTexelWorld[0]'), shadow.texelWorldSizes);
        gl.uniform1i(program.uniform('u_shadowCascadeCount'), shadow.cascadeCount);
        gl.uniform1f(program.uniform('u_shadowMapSize'), shadow.size);
        gl.activeTexture(gl.TEXTURE0 + CLOUD_SHADOW_UNIT);
        gl.bindTexture(gl.TEXTURE_2D, sky.cloudShadow.texture);
        gl.uniform1i(program.uniform('u_cloudShadowMap'), CLOUD_SHADOW_UNIT);
        gl.uniform4fv(program.uniform('u_cloudShadowRegion'), sky.cloudShadow.region);
        gl.uniform1f(program.uniform('u_cloudShadowEnabled'), sky.cloudShadow.enabled ? 1 : 0);
        this.triangle.draw();
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
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RG8, width, height);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0);
        const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        if (status !== gl.FRAMEBUFFER_COMPLETE)
            throw new Error(`Máscara de sombra incompleta (0x${status.toString(16)}).`);
    }
    dispose(): void {
        const { gl } = this;
        this.program.dispose();
        gl.deleteFramebuffer(this.framebuffer);
        gl.deleteTexture(this.texture);
    }
}
