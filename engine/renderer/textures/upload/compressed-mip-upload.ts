import type { GL } from '@/engine/renderer/gl/context';
import type { CompressedMipChain } from '@/engine/renderer/textures/compression/compressed-mip-chain';
import { mipLevelSize } from '@/engine/renderer/textures/mips/mip-levels';
interface CompressedMipSource {
    readonly chain: CompressedMipChain;
    readonly internalFormat: number;
}
export function uploadCompressedMipChain(gl: GL, target: WebGLTexture, source: CompressedMipSource, topLevel: number): void {
    const { chain, internalFormat } = source;
    gl.bindTexture(gl.TEXTURE_2D, target);
    for (let level = topLevel; level < chain.levels.length; level++) {
        const width = mipLevelSize(chain.width, level);
        const height = mipLevelSize(chain.height, level);
        gl.compressedTexImage2D(gl.TEXTURE_2D, level - topLevel, internalFormat, width, height, 0, chain.levels[level]);
    }
}
