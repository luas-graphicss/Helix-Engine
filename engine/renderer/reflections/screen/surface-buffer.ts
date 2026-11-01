import type { GL } from '@/engine/renderer/gl/context';
import { framebufferStatus } from '@/engine/renderer/gl/framebuffer-status';
import type { SceneRenderTarget } from '@/engine/renderer/gl/scene-render-target';
export class SurfaceBuffer {
    framebuffer!: WebGLFramebuffer;
    texture!: WebGLTexture;
    width = 0;
    height = 0;
    private depth: WebGLTexture | null = null;
    constructor(private readonly gl: GL) {
        this.allocate(1, 1);
    }
    attach(scene: SceneRenderTarget): void {
        const { gl } = this;
        if (scene.width !== this.width || scene.height !== this.height) {
            this.dispose();
            this.allocate(scene.width, scene.height);
        }
        if (this.depth === scene.depth)
            return;
        this.depth = scene.depth;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, scene.depth, 0);
        const status = framebufferStatus(gl, 'surface-buffer:depth');
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        if (status !== gl.FRAMEBUFFER_COMPLETE)
            throw new Error(`Surface buffer incompleto (0x${status.toString(16)}).`);
    }
    bindAndClear(): void {
        const { gl } = this;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
        gl.viewport(0, 0, this.width, this.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
    }
    dispose(): void {
        const { gl } = this;
        gl.deleteFramebuffer(this.framebuffer);
        gl.deleteTexture(this.texture);
        this.depth = null;
    }
    private allocate(width: number, height: number): void {
        const { gl } = this;
        const texture = gl.createTexture();
        const framebuffer = gl.createFramebuffer();
        if (!texture || !framebuffer)
            throw new Error('Não foi possível alocar o surface buffer.');
        this.width = Math.max(1, Math.floor(width));
        this.height = Math.max(1, Math.floor(height));
        this.texture = texture;
        this.framebuffer = framebuffer;
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGB10_A2, this.width, this.height);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
}
