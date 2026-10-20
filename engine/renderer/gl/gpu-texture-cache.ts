import type { GL } from './context';
import type { Texture, TextureFilter, TextureWrap } from '@/engine/core/scene/texture';
interface CacheEntry {
    handle: WebGLTexture;
    version: number;
}
const MAX_ANISOTROPY = 8;
function createSolidTexture(gl: GL, r: number, g: number, b: number, a: number): WebGLTexture {
    const handle = gl.createTexture();
    if (!handle)
        throw new Error('Não foi possível alocar a textura de reserva.');
    gl.bindTexture(gl.TEXTURE_2D, handle);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([r, g, b, a]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return handle;
}
function wrapMode(gl: GL, wrap: TextureWrap): number {
    if (wrap === 'clamp')
        return gl.CLAMP_TO_EDGE;
    if (wrap === 'mirror')
        return gl.MIRRORED_REPEAT;
    return gl.REPEAT;
}
function minFilterMode(gl: GL, filter: TextureFilter): number {
    return filter === 'nearest' ? gl.NEAREST_MIPMAP_NEAREST : gl.LINEAR_MIPMAP_LINEAR;
}
export class GpuTextureCache {
    readonly white: WebGLTexture;
    readonly flatNormal: WebGLTexture;
    private readonly entries = new Map<number, CacheEntry>();
    private readonly anisotropic: EXT_texture_filter_anisotropic | null;
    private readonly maxAnisotropy: number;
    constructor(private readonly gl: GL) {
        this.white = createSolidTexture(gl, 255, 255, 255, 255);
        this.flatNormal = createSolidTexture(gl, 128, 128, 255, 255);
        this.anisotropic = gl.getExtension('EXT_texture_filter_anisotropic');
        this.maxAnisotropy = this.anisotropic
            ? Math.min(gl.getParameter(this.anisotropic.MAX_TEXTURE_MAX_ANISOTROPY_EXT) as number, MAX_ANISOTROPY)
            : 1;
    }
    resolve(texture: Texture): WebGLTexture | null {
        if (!texture.image)
            return null;
        const entry = this.entries.get(texture.id);
        if (entry && entry.version === texture.version)
            return entry.handle;
        const handle = entry?.handle ?? this.gl.createTexture();
        if (!handle)
            return null;
        this.upload(handle, texture);
        this.entries.set(texture.id, { handle, version: texture.version });
        return handle;
    }
    private upload(handle: WebGLTexture, texture: Texture): void {
        const { gl } = this;
        gl.bindTexture(gl.TEXTURE_2D, handle);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
        const internalFormat = texture.colorSpace === 'srgb' ? gl.SRGB8_ALPHA8 : gl.RGBA8;
        gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, gl.RGBA, gl.UNSIGNED_BYTE, texture.image as TexImageSource);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, minFilterMode(gl, texture.minFilter));
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, texture.magFilter === 'nearest' ? gl.NEAREST : gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapMode(gl, texture.wrapS));
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrapMode(gl, texture.wrapT));
        if (this.anisotropic && this.maxAnisotropy > 1) {
            gl.texParameterf(gl.TEXTURE_2D, this.anisotropic.TEXTURE_MAX_ANISOTROPY_EXT, this.maxAnisotropy);
        }
        gl.bindTexture(gl.TEXTURE_2D, null);
    }
    release(texture: Texture): void {
        const entry = this.entries.get(texture.id);
        if (!entry)
            return;
        this.gl.deleteTexture(entry.handle);
        this.entries.delete(texture.id);
    }
    dispose(): void {
        for (const entry of this.entries.values())
            this.gl.deleteTexture(entry.handle);
        this.entries.clear();
        this.gl.deleteTexture(this.white);
        this.gl.deleteTexture(this.flatNormal);
    }
}
