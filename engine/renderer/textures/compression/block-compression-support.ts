import type { TextureColorSpace } from '@/engine/core/scene/texture';
import type { GL } from '@/engine/renderer/gl/context';
import type { BlockFormat } from './block-format';
export type BlockInternalFormats = Readonly<Record<BlockFormat, number>>;
export interface BlockCompressionSupport {
    readonly formats: Readonly<Record<TextureColorSpace, BlockInternalFormats | null>>;
}
export function detectBlockCompression(gl: GL): BlockCompressionSupport | null {
    const linear = gl.getExtension('WEBGL_compressed_texture_s3tc');
    const srgb = gl.getExtension('WEBGL_compressed_texture_s3tc_srgb');
    if (!linear && !srgb)
        return null;
    return {
        formats: {
            linear: linear ? { bc1: linear.COMPRESSED_RGB_S3TC_DXT1_EXT, bc3: linear.COMPRESSED_RGBA_S3TC_DXT5_EXT } : null,
            srgb: srgb ? { bc1: srgb.COMPRESSED_SRGB_S3TC_DXT1_EXT, bc3: srgb.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT } : null,
        },
    };
}
