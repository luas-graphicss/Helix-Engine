import type { TextureColorSpace } from '@/engine/core/scene/texture';
import type { GL } from '@/engine/renderer/gl/context';
export function applyImageUnpackState(gl: GL): void {
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
}
export function imageInternalFormat(gl: GL, colorSpace: TextureColorSpace): number {
    return colorSpace === 'srgb' ? gl.SRGB8_ALPHA8 : gl.RGBA8;
}
