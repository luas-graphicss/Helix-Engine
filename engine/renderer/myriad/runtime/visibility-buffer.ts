import type { GL } from '@/engine/renderer/gl/context';
const CLEAR_IDS = new Uint32Array([0, 0, 0, 0]);
export class VisibilityBuffer {
    framebuffer!: WebGLFramebuffer;
    ids!: WebGLTexture;
    width = 0;
    height = 0;
    private depth: WebGLTexture | null = null;
    constructor(private readonly gl: GL) {
        this.allocate(1, 1);
    }
    sync(depth: WebGLTexture, width: number, height: number): boolean {
        const resized = width !== this.width || height !== this.height;
        if (resized) {
            this.dispose();
            this.allocate(width, height);
        }
        if (resized || depth !== this.depth)
            this.attachDepth(depth);
        return resized;
    }
    bindAndClearIds(): void {
        this.bind();
        this.gl.clearBufferuiv(this.gl.COLOR, 0, CLEAR_IDS);
    }
    bind(): void {
        const { gl } = this;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
        gl.viewport(0, 0, this.width, this.height);
    }
    private allocate(width: number, height: number): void {
        const { gl } = this;
        const ids = gl.createTexture();
        const framebuffer = gl.createFramebuffer();
        if (!ids || !framebuffer)
            throw new Error('Não foi possível alocar o buffer de visibilidade.');
        this.width = Math.max(1, Math.floor(width));
        this.height = Math.max(1, Math.floor(height));
        this.ids = ids;
        this.framebuffer = framebuffer;
        this.depth = null;
        gl.bindTexture(gl.TEXTURE_2D, ids);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RG32UI, this.width, this.height);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, ids, 0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    private attachDepth(depth: WebGLTexture): void {
        const { gl } = this;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depth, 0);
        const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        if (status !== gl.FRAMEBUFFER_COMPLETE) {
            this.dispose();
            throw new Error(`Buffer de visibilidade incompleto (0x${status.toString(16)}).`);
        }
        this.depth = depth;
    }
    dispose(): void {
        const { gl } = this;
        gl.deleteFramebuffer(this.framebuffer);
        gl.deleteTexture(this.ids);
        this.depth = null;
    }
}
