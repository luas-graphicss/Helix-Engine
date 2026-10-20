import type { GL } from './context';
interface TextureDataOptions {
    data: Uint8Array;
    width: number;
    height: number;
}
export function createRepeatingTexture2D(gl: GL, { data, width, height }: TextureDataOptions): WebGLTexture {
    const texture = gl.createTexture();
    if (!texture)
        throw new Error('Não foi possível alocar a textura 2D.');
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, width, height);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return texture;
}
export function createRepeatingTexture3D(gl: GL, { data, width, height, depth }: TextureDataOptions & {
    depth: number;
}): WebGLTexture {
    const texture = gl.createTexture();
    if (!texture)
        throw new Error('Não foi possível alocar a textura 3D.');
    gl.bindTexture(gl.TEXTURE_3D, texture);
    gl.texStorage3D(gl.TEXTURE_3D, 1, gl.RGBA8, width, height, depth);
    gl.texSubImage3D(gl.TEXTURE_3D, 0, 0, 0, 0, width, height, depth, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.REPEAT);
    gl.bindTexture(gl.TEXTURE_3D, null);
    return texture;
}
