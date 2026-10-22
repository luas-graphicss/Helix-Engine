import type { GL } from '@/engine/renderer/gl/context';
import type { FullscreenTriangle } from '@/engine/renderer/gl/fullscreen-triangle';
import { ShaderProgram } from '@/engine/renderer/gl/shader-program';
import { FULLSCREEN_VERTEX_SHADER } from '@/engine/renderer/shaders/chunks/fullscreen.glsl';
import { MYRIAD_HZB_VIEW_FRAGMENT_SHADER } from '../shaders/myriad-hzb.glsl';
import type { DepthPyramid } from './depth-pyramid';
export class DepthPyramidView {
    private readonly program: ShaderProgram;
    constructor(private readonly gl: GL, private readonly triangle: FullscreenTriangle) {
        this.program = new ShaderProgram(gl, FULLSCREEN_VERTEX_SHADER, MYRIAD_HZB_VIEW_FRAGMENT_SHADER);
    }
    draw(pyramid: DepthPyramid, level: number, width: number, height: number, near: number, far: number): number {
        const { gl, program } = this;
        if (!pyramid.texture || !pyramid.valid)
            return 0;
        program.use();
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, pyramid.texture);
        gl.uniform1i(program.uniform('u_hzb'), 0);
        gl.uniform1i(program.uniform('u_level'), Math.min(Math.max(level, 0), pyramid.levels - 1));
        gl.uniform2f(program.uniform('u_screenSize'), width, height);
        gl.uniform2f(program.uniform('u_hzbSize'), pyramid.width, pyramid.height);
        gl.uniform1f(program.uniform('u_near'), near);
        gl.uniform1f(program.uniform('u_far'), far);
        gl.disable(gl.DEPTH_TEST);
        this.triangle.draw();
        gl.enable(gl.DEPTH_TEST);
        return 1;
    }
    dispose(): void {
        this.program.dispose();
    }
}
