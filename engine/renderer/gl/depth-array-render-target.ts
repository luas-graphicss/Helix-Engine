import type { GL } from './context';
export class DepthArrayRenderTarget {
    readonly texture: WebGLTexture;
    private readonly framebuffers: WebGLFramebuffer[] = [];
    constructor(private readonly gl: GL, readonly size: number, readonly layers: number) {
        const texture = gl.createTexture();
        if (!texture)
            throw new Error('Não foi possível alocar o array de profundidade.');
        this.texture = texture;
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, texture);
        gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.DEPTH_COMPONENT24, size, size, layers);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
        for (let layer = 0; layer < layers; layer++) {
            const framebuffer = gl.createFramebuffer();
            if (!framebuffer) {
                this.dispose();
                throw new Error('Não foi possível alocar o framebuffer de profundidade.');
            }
            this.framebuffers.push(framebuffer);
            gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
            gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, texture, 0, layer);
            gl.drawBuffers([gl.NONE]);
            gl.readBuffer(gl.NONE);
            const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
            if (status !== gl.FRAMEBUFFER_COMPLETE) {
                gl.bindFramebuffer(gl.FRAMEBUFFER, null);
                this.dispose();
                throw new Error(`Framebuffer de profundidade incompleto (0x${status.toString(16)}).`);
            }
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    bindLayer(layer: number): void {
        const { gl } = this;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers[layer]);
        gl.viewport(0, 0, this.size, this.size);
    }
    dispose(): void {
        for (const framebuffer of this.framebuffers)
            this.gl.deleteFramebuffer(framebuffer);
        this.framebuffers.length = 0;
        this.gl.deleteTexture(this.texture);
    }
}
