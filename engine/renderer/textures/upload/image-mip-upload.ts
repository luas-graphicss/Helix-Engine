import type { TextureColorSpace } from '@/engine/core/scene/texture';
import type { GL } from '@/engine/renderer/gl/context';
import { mipLevelCount, mipLevelSize } from '@/engine/renderer/textures/mips/mip-levels';
import { applyImageUnpackState, imageInternalFormat } from './image-transfer';
export interface ImageMipSource {
    readonly image: TexImageSource;
    readonly colorSpace: TextureColorSpace;
    readonly width: number;
    readonly height: number;
}
function uploadFullChainToBound(gl: GL, source: ImageMipSource): void {
    gl.texImage2D(gl.TEXTURE_2D, 0, imageInternalFormat(gl, source.colorSpace), gl.RGBA, gl.UNSIGNED_BYTE, source.image);
    gl.generateMipmap(gl.TEXTURE_2D);
}
function copyLevelsFrom(gl: GL, full: WebGLTexture, target: WebGLTexture, source: ImageMipSource, topLevel: number): void {
    const internalFormat = imageInternalFormat(gl, source.colorSpace);
    const levels = mipLevelCount(source.width, source.height);
    gl.bindTexture(gl.TEXTURE_2D, target);
    for (let level = topLevel; level < levels; level++) {
        const width = mipLevelSize(source.width, level);
        const height = mipLevelSize(source.height, level);
        gl.framebufferTexture2D(gl.READ_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, full, level);
        gl.texImage2D(gl.TEXTURE_2D, level - topLevel, internalFormat, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.copyTexSubImage2D(gl.TEXTURE_2D, level - topLevel, 0, 0, 0, 0, width, height);
    }
}
export function uploadImageMipChain(gl: GL, target: WebGLTexture, source: ImageMipSource, topLevel: number): void {
    applyImageUnpackState(gl);
    if (topLevel === 0) {
        gl.bindTexture(gl.TEXTURE_2D, target);
        uploadFullChainToBound(gl, source);
        return;
    }
    const full = gl.createTexture();
    const framebuffer = gl.createFramebuffer();
    if (!full || !framebuffer)
        throw new Error('Não foi possível alocar a textura temporária de redução de mips.');
    const previousFramebuffer = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING) as WebGLFramebuffer | null;
    gl.bindTexture(gl.TEXTURE_2D, full);
    uploadFullChainToBound(gl, source);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, framebuffer);
    copyLevelsFrom(gl, full, target, source, topLevel);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, previousFramebuffer);
    gl.deleteFramebuffer(framebuffer);
    gl.deleteTexture(full);
}
