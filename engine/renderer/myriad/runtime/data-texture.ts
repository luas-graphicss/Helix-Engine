import type { GL } from '@/engine/renderer/gl/context';
export type DataTexelFormat = 'rgba32ui' | 'rgba8ui' | 'rgba32f';
interface FormatInfo {
    internal: number;
    format: number;
    type: number;
    bytesPerTexel: number;
}
function formatInfo(gl: GL, format: DataTexelFormat): FormatInfo {
    switch (format) {
        case 'rgba32ui':
            return { internal: gl.RGBA32UI, format: gl.RGBA_INTEGER, type: gl.UNSIGNED_INT, bytesPerTexel: 16 };
        case 'rgba8ui':
            return { internal: gl.RGBA8UI, format: gl.RGBA_INTEGER, type: gl.UNSIGNED_BYTE, bytesPerTexel: 4 };
        case 'rgba32f':
            return { internal: gl.RGBA32F, format: gl.RGBA, type: gl.FLOAT, bytesPerTexel: 16 };
    }
}
const ELEMENTS_PER_TEXEL = 4;
export class DataTexture {
    texture: WebGLTexture;
    rows = 0;
    private readonly info: FormatInfo;
    constructor(private readonly gl: GL, readonly width: number, format: DataTexelFormat, rows: number) {
        this.info = formatInfo(gl, format);
        this.texture = this.allocate(rows);
    }
    get capacityTexels(): number {
        return this.rows * this.width;
    }
    get bytes(): number {
        return this.capacityTexels * this.info.bytesPerTexel;
    }
    ensureRows(rows: number): boolean {
        if (rows <= this.rows)
            return false;
        this.gl.deleteTexture(this.texture);
        this.texture = this.allocate(rows);
        return true;
    }
    upload(base: number, count: number, data: ArrayBufferView, srcTexel = 0): void {
        const { gl, width, info } = this;
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        let remaining = count;
        let texel = base;
        let src = srcTexel;
        while (remaining > 0) {
            const x = texel % width;
            const y = Math.floor(texel / width);
            if (x === 0 && remaining >= width) {
                const fullRows = Math.floor(remaining / width);
                gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, y, width, fullRows, info.format, info.type, data as ArrayBufferView<ArrayBuffer>, src * ELEMENTS_PER_TEXEL);
                const sent = fullRows * width;
                texel += sent;
                src += sent;
                remaining -= sent;
            }
            else {
                const sent = Math.min(remaining, width - x);
                gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, sent, 1, info.format, info.type, data as ArrayBufferView<ArrayBuffer>, src * ELEMENTS_PER_TEXEL);
                texel += sent;
                src += sent;
                remaining -= sent;
            }
        }
        gl.bindTexture(gl.TEXTURE_2D, null);
    }
    private allocate(rows: number): WebGLTexture {
        const { gl, info } = this;
        const texture = gl.createTexture();
        if (!texture)
            throw new Error('Não foi possível alocar a textura de dados.');
        this.rows = rows;
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texStorage2D(gl.TEXTURE_2D, 1, info.internal, this.width, rows);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);
        return texture;
    }
    dispose(): void {
        this.gl.deleteTexture(this.texture);
    }
}
