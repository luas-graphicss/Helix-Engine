import type { GL } from './context';
import { clearHdrColor, colorInternalFormat, type ColorFormat } from './color-render-target';
import { framebufferStatus } from './framebuffer-status';
export class SceneRenderTarget {
    framebuffer!: WebGLFramebuffer;
    color!: WebGLTexture;
    depth!: WebGLTexture;
    width = 0;
    height = 0;
    constructor(private readonly gl: GL, readonly format: ColorFormat) {
        this.allocate(1, 1);
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
    clear(hdrColor: readonly [
        number,
        number,
        number
    ], encodedRange: number, clearColor = true): void {
        const { gl } = this;
        gl.clear(gl.DEPTH_BUFFER_BIT);
        if (clearColor)
            clearHdrColor(gl, this.format, hdrColor, encodedRange);
    }
    dispose(): void {
        const { gl } = this;
        gl.deleteFramebuffer(this.framebuffer);
        gl.deleteTexture(this.color);
        gl.deleteTexture(this.depth);
    }
    private allocate(width: number, height: number): void {
        const { gl } = this;
        const color = gl.createTexture();
        const depth = gl.createTexture();
        const framebuffer = gl.createFramebuffer();
        if (!color || !depth || !framebuffer)
            throw new Error('Não foi possível alocar o alvo da cena.');
        this.width = Math.max(1, Math.floor(width));
        this.height = Math.max(1, Math.floor(height));
        this.color = color;
        this.depth = depth;
        this.framebuffer = framebuffer;
        gl.bindTexture(gl.TEXTURE_2D, color);
        gl.texStorage2D(gl.TEXTURE_2D, 1, colorInternalFormat(gl, this.format), this.width, this.height);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, depth);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT32F, this.width, this.height);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.NONE);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, color, 0);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depth, 0);
        const status = framebufferStatus(gl, `scene:${this.format}`);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        if (status !== gl.FRAMEBUFFER_COMPLETE) {
            this.dispose();
            throw new Error(`Alvo da cena incompleto (0x${status.toString(16)}).`);
        }
    }
}
export class OverlayRenderTarget {
    framebuffer!: WebGLFramebuffer;
    compositeFramebuffer!: WebGLFramebuffer;
    color!: WebGLTexture;
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
        const status = framebufferStatus(gl, 'overlay:color+depth');
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        if (status !== gl.FRAMEBUFFER_COMPLETE)
            throw new Error(`Alvo de overlay incompleto (0x${status.toString(16)}).`);
    }
    bind(): void {
        const { gl } = this;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
        gl.viewport(0, 0, this.width, this.height);
    }
    bindForComposite(): void {
        const { gl } = this;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.compositeFramebuffer);
        gl.viewport(0, 0, this.width, this.height);
    }
    dispose(): void {
        const { gl } = this;
        gl.deleteFramebuffer(this.framebuffer);
        gl.deleteFramebuffer(this.compositeFramebuffer);
        gl.deleteTexture(this.color);
        this.depth = null;
    }
    private allocate(width: number, height: number): void {
        const { gl } = this;
        const color = gl.createTexture();
        const framebuffer = gl.createFramebuffer();
        const compositeFramebuffer = gl.createFramebuffer();
        if (!color || !framebuffer || !compositeFramebuffer)
            throw new Error('Não foi possível alocar o alvo de overlay.');
        this.width = Math.max(1, Math.floor(width));
        this.height = Math.max(1, Math.floor(height));
        this.color = color;
        this.framebuffer = framebuffer;
        this.compositeFramebuffer = compositeFramebuffer;
        gl.bindTexture(gl.TEXTURE_2D, color);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, this.width, this.height);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, color, 0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, compositeFramebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, color, 0);
        const status = framebufferStatus(gl, 'overlay:color');
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        if (status !== gl.FRAMEBUFFER_COMPLETE)
            throw new Error(`Alvo de overlay incompleto (0x${status.toString(16)}).`);
    }
}
