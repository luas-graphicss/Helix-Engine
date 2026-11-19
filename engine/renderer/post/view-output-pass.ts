import { linearToSrgb } from '@/engine/core/color/srgb';
import type { GL } from '@/engine/renderer/gl/context';
import type { FullscreenTriangle } from '@/engine/renderer/gl/fullscreen-triangle';
import { ShaderProgram } from '@/engine/renderer/gl/shader-program';
import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import { FULLSCREEN_VERTEX_SHADER } from '@/engine/renderer/shaders/chunks/fullscreen.glsl';
import { VIEW_OUTPUT_BACKDROP, VIEW_OUTPUT_COVERAGE, VIEW_OUTPUT_DEPTH, VIEW_OUTPUT_FRAGMENT_SHADER } from '@/engine/renderer/shaders/post/view-output.glsl';
const DEPTH_UNIT = 0;
export class ViewOutputPass {
    private readonly program: ShaderProgram;
    constructor(private readonly gl: GL, private readonly triangle: FullscreenTriangle) {
        this.program = new ShaderProgram(gl, FULLSCREEN_VERTEX_SHADER, VIEW_OUTPUT_FRAGMENT_SHADER);
    }
    wanted(camera: PerspectiveCamera): boolean {
        return camera.content === 'depth' || camera.backdrop !== 'scene';
    }
    render(camera: PerspectiveCamera, depth: WebGLTexture, width: number, height: number): void {
        const { gl, program } = this;
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, width, height);
        program.use();
        gl.activeTexture(gl.TEXTURE0 + DEPTH_UNIT);
        gl.bindTexture(gl.TEXTURE_2D, depth);
        gl.uniform1i(program.uniform('u_depth'), DEPTH_UNIT);
        gl.uniform2f(program.uniform('u_inverseResolution'), 1 / width, 1 / height);
        gl.uniform3f(program.uniform('u_clip'), camera.near, camera.far, camera.orthographic ? 1 : 0);
        const color = camera.backdropColor;
        gl.uniform4f(program.uniform('u_color'), linearToSrgb(color[0]), linearToSrgb(color[1]), linearToSrgb(color[2]), 1);
        if (camera.content === 'depth') {
            gl.uniform1i(program.uniform('u_mode'), VIEW_OUTPUT_DEPTH);
            this.triangle.draw();
        }
        else if (camera.backdrop === 'transparent') {
            gl.uniform1i(program.uniform('u_mode'), VIEW_OUTPUT_COVERAGE);
            gl.colorMask(false, false, false, true);
            this.triangle.draw();
            gl.colorMask(true, true, true, true);
        }
        else {
            gl.uniform1i(program.uniform('u_mode'), VIEW_OUTPUT_BACKDROP);
            this.triangle.draw();
        }
        gl.bindTexture(gl.TEXTURE_2D, null);
    }
    dispose(): void {
        this.program.dispose();
    }
}
