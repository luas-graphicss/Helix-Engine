import type { GL } from './context';
export interface PixelRect {
    x: number;
    y: number;
    width: number;
    height: number;
}
export class SceneColorCapture {
    private texture: WebGLTexture | null = null;
    private width = 0;
    private height = 0;
    constructor(private readonly gl: GL) { }
    capture(width: number, height: number, rect: PixelRect): WebGLTexture {
        const { gl } = this;
        const texture = this.texture ?? this.create();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        if (width !== this.width || height !== this.height) {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB8, width, height, 0, gl.RGB, gl.UNSIGNED_BYTE, null);
            this.width = width;
            this.height = height;
        }
        const x0 = Math.max(0, Math.floor(rect.x));
        const y0 = Math.max(0, Math.floor(rect.y));
        const x1 = Math.min(width, Math.ceil(rect.x + rect.width));
        const y1 = Math.min(height, Math.ceil(rect.y + rect.height));
        if (x1 > x0 && y1 > y0)
            gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, x0, y0, x0, y0, x1 - x0, y1 - y0);
        return texture;
    }
    private create(): WebGLTexture {
        const { gl } = this;
        const texture = gl.createTexture();
        if (!texture)
            throw new Error('Não foi possível criar a textura de cor da cena.');
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        this.texture = texture;
        return texture;
    }
    dispose(): void {
        if (this.texture)
            this.gl.deleteTexture(this.texture);
        this.texture = null;
        this.width = 0;
        this.height = 0;
    }
}
