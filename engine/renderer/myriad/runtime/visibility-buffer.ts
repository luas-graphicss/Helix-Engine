import type { GL } from '@/engine/renderer/gl/context';
import { framebufferStatus } from '@/engine/renderer/gl/framebuffer-status';
const CLEAR_IDS = new Uint32Array([0, 0, 0, 0]);
const STATUS_SIGNATURE = 'visibility-buffer';
export class VisibilityBufferUnsupportedError extends Error {
    constructor(readonly status: number) {
        super(`Buffer de visibilidade incompleto (0x${status.toString(16)}).`);
        this.name = 'VisibilityBufferUnsupportedError';
    }
}
function allocateIdsStorage(gl: GL, ids: WebGLTexture, width: number, height: number): void {
    gl.bindTexture(gl.TEXTURE_2D, ids);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RG32UI, width, height);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
}
export function probeVisibilityBufferSupport(gl: GL): number {
    const ids = gl.createTexture();
    const depth = gl.createTexture();
    const framebuffer = gl.createFramebuffer();
    if (!ids || !depth || !framebuffer)
        return gl.FRAMEBUFFER_UNSUPPORTED;
    allocateIdsStorage(gl, ids, 1, 1);
    gl.bindTexture(gl.TEXTURE_2D, depth);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT32F, 1, 1);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, ids, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depth, 0);
    const status = framebufferStatus(gl, STATUS_SIGNATURE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(framebuffer);
    gl.deleteTexture(ids);
    gl.deleteTexture(depth);
    return status;
}
export class VisibilityBuffer {
    framebuffer: WebGLFramebuffer | null = null;
    ids: WebGLTexture | null = null;
    width = 0;
    height = 0;
    private depth: WebGLTexture | null = null;
    constructor(private readonly gl: GL) { }
    get allocated(): boolean {
        return this.ids !== null;
    }
    sync(depth: WebGLTexture, width: number, height: number): boolean {
        const targetWidth = Math.max(1, Math.floor(width));
        const targetHeight = Math.max(1, Math.floor(height));
        const reallocate = this.ids === null || targetWidth !== this.width || targetHeight !== this.height;
        if (reallocate) {
            this.release();
            this.allocate(targetWidth, targetHeight);
        }
        if (reallocate || depth !== this.depth)
            this.attachDepth(depth);
        return reallocate;
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
    release(): void {
        const { gl } = this;
        if (this.framebuffer)
            gl.deleteFramebuffer(this.framebuffer);
        if (this.ids)
            gl.deleteTexture(this.ids);
        this.framebuffer = null;
        this.ids = null;
        this.depth = null;
        this.width = 0;
        this.height = 0;
    }
    dispose(): void {
        this.release();
    }
    private allocate(width: number, height: number): void {
        const { gl } = this;
        const ids = gl.createTexture();
        const framebuffer = gl.createFramebuffer();
        if (!ids || !framebuffer)
            throw new Error('Não foi possível alocar o buffer de visibilidade.');
        allocateIdsStorage(gl, ids, width, height);
        this.width = width;
        this.height = height;
        this.ids = ids;
        this.framebuffer = framebuffer;
        this.depth = null;
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, ids, 0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    private attachDepth(depth: WebGLTexture): void {
        const { gl } = this;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depth, 0);
        const status = framebufferStatus(gl, STATUS_SIGNATURE);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        if (status !== gl.FRAMEBUFFER_COMPLETE) {
            this.release();
            throw new VisibilityBufferUnsupportedError(status);
        }
        this.depth = depth;
    }
}
