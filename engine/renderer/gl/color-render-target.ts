import type { GL } from './context';
import { framebufferStatus } from './framebuffer-status';
export type ColorFormat = 'rgba8' | 'rgba16f' | 'rg11b10f';
export function colorInternalFormat(gl: GL, format: ColorFormat): number {
    switch (format) {
        case 'rgba16f':
            return gl.RGBA16F;
        case 'rg11b10f':
            return gl.R11F_G11F_B10F;
        default:
            return gl.RGBA8;
    }
}
export function clearHdrColor(gl: GL, format: ColorFormat, hdrColor: readonly [
    number,
    number,
    number
], encodedRange: number): void {
    if (format === 'rgba8') {
        const encode = (value: number) => Math.sqrt(Math.min(1, Math.max(0, value / encodedRange)));
        gl.clearColor(encode(hdrColor[0]), encode(hdrColor[1]), encode(hdrColor[2]), 1);
    }
    else {
        gl.clearColor(hdrColor[0], hdrColor[1], hdrColor[2], 1);
    }
    gl.clear(gl.COLOR_BUFFER_BIT);
}
export interface ColorRenderTargetOptions {
    width: number;
    height: number;
    format: ColorFormat;
    filter?: 'linear' | 'nearest';
    wrapS?: 'clamp' | 'repeat';
}
export class ColorRenderTarget {
    framebuffer!: WebGLFramebuffer;
    texture!: WebGLTexture;
    width = 0;
    height = 0;
    readonly format: ColorFormat;
    private readonly filter: number;
    private readonly wrapS: number;
    constructor(private readonly gl: GL, options: ColorRenderTargetOptions) {
        this.format = options.format;
        this.filter = options.filter === 'nearest' ? gl.NEAREST : gl.LINEAR;
        this.wrapS = options.wrapS === 'repeat' ? gl.REPEAT : gl.CLAMP_TO_EDGE;
        this.allocate(options.width, options.height);
    }
    resize(width: number, height: number): boolean {
        if (width === this.width && height === this.height)
            return false;
        this.dispose();
        this.allocate(width, height);
        return true;
    }
    bind(): void {
        const { gl } = this;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
        gl.viewport(0, 0, this.width, this.height);
    }
    dispose(): void {
        this.gl.deleteFramebuffer(this.framebuffer);
        this.gl.deleteTexture(this.texture);
    }
    private allocate(width: number, height: number): void {
        const { gl } = this;
        const texture = gl.createTexture();
        const framebuffer = gl.createFramebuffer();
        if (!texture || !framebuffer)
            throw new Error('Não foi possível alocar o alvo de cor.');
        this.width = Math.max(1, Math.floor(width));
        this.height = Math.max(1, Math.floor(height));
        this.texture = texture;
        this.framebuffer = framebuffer;
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texStorage2D(gl.TEXTURE_2D, 1, colorInternalFormat(gl, this.format), this.width, this.height);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, this.filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, this.filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, this.wrapS);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
        const status = framebufferStatus(gl, `color:${this.format}`);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        if (status !== gl.FRAMEBUFFER_COMPLETE) {
            this.dispose();
            throw new Error(`Framebuffer de cor incompleto (0x${status.toString(16)}).`);
        }
    }
}
