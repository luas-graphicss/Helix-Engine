import type { Texture, TextureFilter, TextureWrap } from '@/engine/core/scene/texture';
import type { GL } from '@/engine/renderer/gl/context';
const MAX_ANISOTROPY = 16;
function wrapMode(gl: GL, wrap: TextureWrap): number {
    if (wrap === 'clamp')
        return gl.CLAMP_TO_EDGE;
    if (wrap === 'mirror')
        return gl.MIRRORED_REPEAT;
    return gl.REPEAT;
}
function baseFilter(gl: GL, filter: TextureFilter): number {
    return filter === 'nearest' ? gl.NEAREST : gl.LINEAR;
}
function mipFilter(gl: GL, filter: TextureFilter): number {
    return filter === 'nearest' ? gl.NEAREST_MIPMAP_NEAREST : gl.LINEAR_MIPMAP_LINEAR;
}
export class TextureSampling {
    private readonly anisotropic: EXT_texture_filter_anisotropic | null;
    private readonly maxAnisotropy: number;
    constructor(private readonly gl: GL) {
        this.anisotropic = gl.getExtension('EXT_texture_filter_anisotropic');
        this.maxAnisotropy = this.anisotropic
            ? Math.min(gl.getParameter(this.anisotropic.MAX_TEXTURE_MAX_ANISOTROPY_EXT) as number, MAX_ANISOTROPY)
            : 1;
    }
    applyToBound(texture: Texture): void {
        const { gl } = this;
        const mipmapped = !texture.dynamic;
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mipmapped ? mipFilter(gl, texture.minFilter) : baseFilter(gl, texture.minFilter));
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, baseFilter(gl, texture.magFilter));
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapMode(gl, texture.wrapS));
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrapMode(gl, texture.wrapT));
        if (this.anisotropic && this.maxAnisotropy > 1 && mipmapped)
            gl.texParameterf(gl.TEXTURE_2D, this.anisotropic.TEXTURE_MAX_ANISOTROPY_EXT, this.maxAnisotropy);
    }
}
