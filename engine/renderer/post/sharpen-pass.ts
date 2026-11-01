import type { GL } from '@/engine/renderer/gl/context';
import type { FullscreenTriangle } from '@/engine/renderer/gl/fullscreen-triangle';
import { ShaderProgram } from '@/engine/renderer/gl/shader-program';
import { FULLSCREEN_VERTEX_SHADER } from '@/engine/renderer/shaders/chunks/fullscreen.glsl';
import { SHARPEN_FRAGMENT_SHADER } from '@/engine/renderer/shaders/post/sharpen.glsl';
const COLOR_UNIT = 0;
export class SharpenPass {
    private readonly program: ShaderProgram;
    constructor(private readonly gl: GL, private readonly triangle: FullscreenTriangle) {
        this.program = new ShaderProgram(gl, FULLSCREEN_VERTEX_SHADER, SHARPEN_FRAGMENT_SHADER);
    }
    render(color: WebGLTexture, width: number, height: number, sharpness: number, target: WebGLFramebuffer | null = null): void {
        const { gl, program, triangle } = this;
        gl.bindFramebuffer(gl.FRAMEBUFFER, target);
        gl.viewport(0, 0, width, height);
        program.use();
        gl.activeTexture(gl.TEXTURE0 + COLOR_UNIT);
        gl.bindTexture(gl.TEXTURE_2D, color);
        gl.uniform1i(program.uniform('u_color'), COLOR_UNIT);
        gl.uniform1f(program.uniform('u_sharpness'), Math.min(1, Math.max(0, sharpness)));
        triangle.draw();
        gl.bindTexture(gl.TEXTURE_2D, null);
    }
    dispose(): void {
        this.program.dispose();
    }
}
