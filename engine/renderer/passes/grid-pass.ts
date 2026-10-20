import type { GL } from '@/engine/renderer/gl/context';
import { ShaderProgram } from '@/engine/renderer/gl/shader-program';
import type { FullscreenTriangle } from '@/engine/renderer/gl/fullscreen-triangle';
import { GRID_VERTEX_SHADER, GRID_FRAGMENT_SHADER } from '@/engine/renderer/shaders/grid.glsl';
import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
export class GridPass {
    private readonly program: ShaderProgram;
    constructor(private readonly gl: GL, private readonly triangle: FullscreenTriangle) {
        this.program = new ShaderProgram(gl, GRID_VERTEX_SHADER, GRID_FRAGMENT_SHADER);
    }
    render(camera: PerspectiveCamera): void {
        const { gl, program } = this;
        if (!camera.invertible)
            return;
        program.use();
        gl.uniformMatrix4fv(program.uniform('u_inverseViewProjection'), false, camera.inverseViewProjectionMatrix);
        gl.uniformMatrix4fv(program.uniform('u_viewProjection'), false, camera.viewProjectionMatrix);
        gl.uniform3fv(program.uniform('u_cameraPosition'), camera.position);
        gl.uniform1f(program.uniform('u_near'), camera.near);
        gl.uniform1f(program.uniform('u_far'), camera.far);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.depthMask(false);
        this.triangle.draw();
        gl.depthMask(true);
        gl.disable(gl.BLEND);
    }
    dispose(): void {
        this.program.dispose();
    }
}
