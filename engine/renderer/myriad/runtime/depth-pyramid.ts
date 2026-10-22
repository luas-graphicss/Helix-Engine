import type { GL } from '@/engine/renderer/gl/context';
import type { FullscreenTriangle } from '@/engine/renderer/gl/fullscreen-triangle';
import { ShaderProgram } from '@/engine/renderer/gl/shader-program';
import { FULLSCREEN_VERTEX_SHADER } from '@/engine/renderer/shaders/chunks/fullscreen.glsl';
import { MYRIAD_HZB_REDUCE_FRAGMENT_SHADER } from '../shaders/myriad-hzb.glsl';
export class DepthPyramid {
    readonly supported: boolean;
    valid = false;
    texture: WebGLTexture | null = null;
    width = 0;
    height = 0;
    levels = 0;
    private readonly framebuffer: WebGLFramebuffer | null;
    private readonly program: ShaderProgram | null;
    constructor(private readonly gl: GL, private readonly triangle: FullscreenTriangle) {
        this.supported = gl.getExtension('EXT_color_buffer_float') !== null;
        this.framebuffer = this.supported ? gl.createFramebuffer() : null;
        this.program = this.supported ? new ShaderProgram(gl, FULLSCREEN_VERTEX_SHADER, MYRIAD_HZB_REDUCE_FRAGMENT_SHADER) : null;
    }
    build(depth: WebGLTexture, depthWidth: number, depthHeight: number): number {
        const { gl, program, framebuffer } = this;
        if (!program || !framebuffer)
            return 0;
        this.resize(Math.max(1, depthWidth >> 1), Math.max(1, depthHeight >> 1));
        const texture = this.texture as WebGLTexture;
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        program.use();
        gl.uniform1i(program.uniform('u_source'), 0);
        gl.activeTexture(gl.TEXTURE0);
        gl.disable(gl.DEPTH_TEST);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
        gl.viewport(0, 0, this.width, this.height);
        gl.bindTexture(gl.TEXTURE_2D, depth);
        gl.uniform2i(program.uniform('u_sourceSize'), depthWidth, depthHeight);
        this.triangle.draw();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        let sourceWidth = this.width;
        let sourceHeight = this.height;
        for (let level = 1; level < this.levels; level++) {
            const width = Math.max(1, sourceWidth >> 1);
            const height = Math.max(1, sourceHeight >> 1);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_BASE_LEVEL, level - 1);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAX_LEVEL, level - 1);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, level);
            gl.viewport(0, 0, width, height);
            gl.uniform2i(program.uniform('u_sourceSize'), sourceWidth, sourceHeight);
            this.triangle.draw();
            sourceWidth = width;
            sourceHeight = height;
        }
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_BASE_LEVEL, 0);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAX_LEVEL, this.levels - 1);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.enable(gl.DEPTH_TEST);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        this.valid = true;
        return this.levels;
    }
    invalidate(): void {
        this.valid = false;
    }
    private resize(width: number, height: number): void {
        if (width === this.width && height === this.height && this.texture)
            return;
        const { gl } = this;
        if (this.texture)
            gl.deleteTexture(this.texture);
        const texture = gl.createTexture();
        if (!texture)
            throw new Error('Não foi possível alocar a pirâmide de profundidade.');
        this.texture = texture;
        this.width = width;
        this.height = height;
        this.levels = Math.floor(Math.log2(Math.max(width, height))) + 1;
        this.valid = false;
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texStorage2D(gl.TEXTURE_2D, this.levels, gl.R32F, width, height);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAX_LEVEL, this.levels - 1);
        gl.bindTexture(gl.TEXTURE_2D, null);
    }
    dispose(): void {
        const { gl } = this;
        if (this.texture)
            gl.deleteTexture(this.texture);
        if (this.framebuffer)
            gl.deleteFramebuffer(this.framebuffer);
        this.program?.dispose();
        this.texture = null;
        this.valid = false;
    }
}
