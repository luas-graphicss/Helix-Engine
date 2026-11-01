import type { GL } from '@/engine/renderer/gl/context';
import { ShaderProgram } from '@/engine/renderer/gl/shader-program';
import { GRID_VERTEX_SHADER, GRID_FRAGMENT_SHADER, GRID_FADE_END_FRACTION } from '@/engine/renderer/shaders/grid.glsl';
import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
const QUAD_VERTICES = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
const EXTENT_FRACTION = GRID_FADE_END_FRACTION + 0.05;
export class GridPass {
    private readonly program: ShaderProgram;
    private readonly vao: WebGLVertexArrayObject;
    private readonly buffer: WebGLBuffer;
    constructor(private readonly gl: GL) {
        this.program = new ShaderProgram(gl, GRID_VERTEX_SHADER, GRID_FRAGMENT_SHADER);
        const vao = gl.createVertexArray();
        const buffer = gl.createBuffer();
        if (!vao || !buffer)
            throw new Error('Não foi possível alocar o quad da grade.');
        this.vao = vao;
        this.buffer = buffer;
        gl.bindVertexArray(vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, QUAD_VERTICES, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.bindVertexArray(null);
    }
    render(camera: PerspectiveCamera): void {
        const { gl, program } = this;
        if (!camera.invertible)
            return;
        program.use();
        gl.uniformMatrix4fv(program.uniform('u_viewProjection'), false, camera.viewProjectionMatrix);
        gl.uniform3fv(program.uniform('u_cameraPosition'), camera.position);
        gl.uniform1f(program.uniform('u_far'), camera.far);
        gl.uniform1f(program.uniform('u_extent'), camera.far * EXTENT_FRACTION);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.depthMask(false);
        gl.disable(gl.CULL_FACE);
        gl.bindVertexArray(this.vao);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.bindVertexArray(null);
        gl.enable(gl.CULL_FACE);
        gl.depthMask(true);
        gl.disable(gl.BLEND);
    }
    dispose(): void {
        this.program.dispose();
        this.gl.deleteBuffer(this.buffer);
        this.gl.deleteVertexArray(this.vao);
    }
}
