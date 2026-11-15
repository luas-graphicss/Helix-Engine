import type { GL } from '@/engine/renderer/gl/context';
import { colorInternalFormat, type ColorFormat } from '@/engine/renderer/gl/color-render-target';
export const CUBE_FACE_COUNT = 6;
export interface ProbeCubemapLayout {
    size: number;
    levels: number;
    format: ColorFormat;
}
export function createProbeCubemap(gl: GL, layout: ProbeCubemapLayout): WebGLTexture {
    const texture = gl.createTexture();
    if (!texture)
        throw new Error('Não foi possível alocar o cubemap da sonda de reflexo.');
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
    gl.texStorage2D(gl.TEXTURE_CUBE_MAP, layout.levels, colorInternalFormat(gl, layout.format), layout.size, layout.size);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
    return texture;
}
