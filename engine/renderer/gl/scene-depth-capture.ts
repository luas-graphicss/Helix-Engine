import type { GL } from './context';
import type { SceneRenderTarget } from './scene-render-target';
export class SceneDepthCapture {
    texture: WebGLTexture | null = null;
    private framebuffer: WebGLFramebuffer | null = null;
    private width = 0;
    private height = 0;
    constructor(private readonly gl: GL, private readonly owner: string) { }
    capture(scene: SceneRenderTarget): WebGLTexture {
        const { gl } = this;
        if (!this.texture || !this.framebuffer || this.width !== scene.width || this.height !== scene.height)
            this.allocate(scene.width, scene.height);
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, scene.framebuffer);
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.framebuffer);
        gl.blitFramebuffer(0, 0, scene.width, scene.height, 0, 0, scene.width, scene.height, gl.DEPTH_BUFFER_BIT, gl.NEAREST);
        scene.bind();
        return this.texture as WebGLTexture;
    }
    dispose(): void {
        const { gl } = this;
        if (this.framebuffer)
            gl.deleteFramebuffer(this.framebuffer);
        if (this.texture)
            gl.deleteTexture(this.texture);
        this.framebuffer = null;
        this.texture = null;
        this.width = 0;
        this.height = 0;
    }
    private allocate(width: number, height: number): void {
        const { gl } = this;
        this.dispose();
        const texture = gl.createTexture();
        const framebuffer = gl.createFramebuffer();
        if (!texture || !framebuffer)
            throw new Error(`Não foi possível alocar a cópia de profundidade (${this.owner}).`);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT32F, width, height);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.NONE);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, texture, 0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        this.texture = texture;
        this.framebuffer = framebuffer;
        this.width = width;
        this.height = height;
    }
}
