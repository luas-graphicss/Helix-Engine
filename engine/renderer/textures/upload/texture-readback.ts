import type { GL } from '@/engine/renderer/gl/context';
import { applyImageUnpackState } from './image-transfer';
const RGBA_BYTES_PER_PIXEL = 4;
export function readImagePixels(gl: GL, image: TexImageSource, width: number, height: number): Uint8Array<ArrayBuffer> {
    const scratch = gl.createTexture();
    const framebuffer = gl.createFramebuffer();
    if (!scratch || !framebuffer)
        throw new Error('Não foi possível alocar a textura temporária de leitura de pixels.');
    const previousFramebuffer = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING) as WebGLFramebuffer | null;
    const previousPackBuffer = gl.getParameter(gl.PIXEL_PACK_BUFFER_BINDING) as WebGLBuffer | null;
    const pixels = new Uint8Array(width * height * RGBA_BYTES_PER_PIXEL);
    applyImageUnpackState(gl);
    gl.bindTexture(gl.TEXTURE_2D, scratch);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.READ_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, scratch, 0);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, previousPackBuffer);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, previousFramebuffer);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.deleteFramebuffer(framebuffer);
    gl.deleteTexture(scratch);
    return pixels;
}
