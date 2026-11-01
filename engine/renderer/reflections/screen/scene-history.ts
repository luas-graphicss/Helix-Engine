import * as mat4 from '@/engine/core/math/mat4';
import type { GL } from '@/engine/renderer/gl/context';
import { colorInternalFormat, type ColorFormat } from '@/engine/renderer/gl/color-render-target';
import type { SceneRenderTarget } from '@/engine/renderer/gl/scene-render-target';
import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
export class SceneHistory {
    texture!: WebGLTexture;
    width = 0;
    height = 0;
    valid = false;
    readonly viewProjection = mat4.create();
    constructor(private readonly gl: GL, private readonly format: ColorFormat) {
        this.allocate(1, 1);
    }
    capture(scene: SceneRenderTarget, camera: PerspectiveCamera): void {
        const { gl } = this;
        if (scene.width !== this.width || scene.height !== this.height) {
            gl.deleteTexture(this.texture);
            this.allocate(scene.width, scene.height);
        }
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, scene.framebuffer);
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 0, 0, this.width, this.height);
        gl.bindTexture(gl.TEXTURE_2D, null);
        mat4.copy(this.viewProjection, camera.viewProjectionMatrix);
        this.valid = true;
    }
    invalidate(): void {
        this.valid = false;
    }
    dispose(): void {
        this.gl.deleteTexture(this.texture);
    }
    private allocate(width: number, height: number): void {
        const { gl } = this;
        const texture = gl.createTexture();
        if (!texture)
            throw new Error('Não foi possível alocar o histórico da cena.');
        this.width = Math.max(1, Math.floor(width));
        this.height = Math.max(1, Math.floor(height));
        this.texture = texture;
        this.valid = false;
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texStorage2D(gl.TEXTURE_2D, 1, colorInternalFormat(gl, this.format), this.width, this.height);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);
    }
}
