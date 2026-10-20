import type { GL } from '@/engine/renderer/gl/context';
const CLEAR_IDS = new Uint32Array([0, 0, 0, 0]);
const CLEAR_DEPTH = new Float32Array([1]);
export class VisibilityBuffer {
    framebuffer!: WebGLFramebuffer;
    ids!: WebGLTexture;
    depth!: WebGLTexture;
    width = 0;
    height = 0;
    constructor(private readonly gl: GL, width: number, height: number) {
        this.allocate(width, height);
    }
    resize(width: number, height: number): boolean {
        if (width === this.width && height === this.height)
            return false;
        this.dispose();
        this.allocate(width, height);
        return true;
    }
    bindAndClear(): void {
        const { gl } = this;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
        gl.viewport(0, 0, this.width, this.height);
        gl.clearBufferuiv(gl.COLOR, 0, CLEAR_IDS);
        gl.clearBufferfv(gl.DEPTH, 0, CLEAR_DEPTH);
    }
    private allocate(width: number, height: number): void {
        const { gl } = this;
        const ids = gl.createTexture();
        const depth = gl.createTexture();
        const framebuffer = gl.createFramebuffer();
        if (!ids || !depth || !framebuffer)
            throw new Error('Não foi possível alocar o buffer de visibilidade.');
        this.width = Math.max(1, Math.floor(width));
        this.height = Math.max(1, Math.floor(height));
        this.ids = ids;
        this.depth = depth;
        this.framebuffer = framebuffer;
        gl.bindTexture(gl.TEXTURE_2D, ids);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RG32UI, this.width, this.height);
        this.setNearest();
        gl.bindTexture(gl.TEXTURE_2D, depth);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT32F, this.width, this.height);
        this.setNearest();
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, ids, 0);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depth, 0);
        const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        if (status !== gl.FRAMEBUFFER_COMPLETE) {
            this.dispose();
            throw new Error(`Buffer de visibilidade incompleto (0x${status.toString(16)}).`);
        }
    }
    private setNearest(): void {
        const { gl } = this;
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    dispose(): void {
        const { gl } = this;
        gl.deleteFramebuffer(this.framebuffer);
        gl.deleteTexture(this.ids);
        gl.deleteTexture(this.depth);
    }
}
