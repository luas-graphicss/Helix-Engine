import type { GL } from '@/engine/renderer/gl/context';
import type { ColorRenderTarget } from '@/engine/renderer/gl/color-render-target';
export class FlagReadback {
    mainVisible = 0;
    postVisible = 0;
    entries = 0;
    valid = false;
    private readonly buffers: [
        WebGLBuffer,
        WebGLBuffer
    ];
    private fence: WebGLSync | null = null;
    private pendingEntries = 0;
    private pendingBytes = 0;
    private cpu = new Uint8Array(0);
    constructor(private readonly gl: GL) {
        const a = gl.createBuffer();
        const b = gl.createBuffer();
        if (!a || !b)
            throw new Error('Não foi possível alocar os buffers de leitura.');
        this.buffers = [a, b];
    }
    request(flags: readonly [
        ColorRenderTarget,
        ColorRenderTarget
    ], entries: number): void {
        if (this.fence || entries === 0)
            return;
        const { gl } = this;
        const bytes = flags[0].width * flags[0].height * 4;
        for (let i = 0; i < 2; i++) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, flags[i].framebuffer);
            gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this.buffers[i]);
            gl.bufferData(gl.PIXEL_PACK_BUFFER, bytes, gl.STREAM_READ);
            gl.readPixels(0, 0, flags[i].width, flags[i].height, gl.RGBA, gl.UNSIGNED_BYTE, 0);
        }
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        this.fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        this.pendingEntries = entries;
        this.pendingBytes = bytes;
    }
    poll(): void {
        const { gl, fence } = this;
        if (!fence)
            return;
        if (gl.getSyncParameter(fence, gl.SYNC_STATUS) !== gl.SIGNALED)
            return;
        gl.deleteSync(fence);
        this.fence = null;
        if (this.cpu.length < this.pendingBytes)
            this.cpu = new Uint8Array(this.pendingBytes);
        const counts = [0, 0];
        for (let i = 0; i < 2; i++) {
            gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this.buffers[i]);
            gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, this.cpu, 0, this.pendingBytes);
            let count = 0;
            for (let e = 0; e < this.pendingEntries; e++)
                if (this.cpu[e * 4] > 127)
                    count++;
            counts[i] = count;
        }
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
        this.mainVisible = counts[0];
        this.postVisible = counts[1];
        this.entries = this.pendingEntries;
        this.valid = true;
    }
    dispose(): void {
        const { gl } = this;
        if (this.fence)
            gl.deleteSync(this.fence);
        for (const buffer of this.buffers)
            gl.deleteBuffer(buffer);
    }
}
