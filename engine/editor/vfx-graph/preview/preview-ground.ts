import type { Mat4 } from '@/engine/core/math/mat4';
import type { GL } from '@/engine/renderer/gl/context';
import { ShaderProgram } from '@/engine/renderer/gl/shader-program';
import { GROUND_FRAGMENT, GROUND_VERTEX } from './preview-shaders.glsl';
const CORNERS = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
const EXTENT_METERS = 30;
export class PreviewGround {
    private readonly program: ShaderProgram;
    private readonly array: WebGLVertexArrayObject;
    private readonly corners: WebGLBuffer;
    constructor(private readonly gl: GL) {
        const array = gl.createVertexArray();
        const corners = gl.createBuffer();
        if (!array || !corners)
            throw new Error('Não foi possível alocar o chão da pré-visualização.');
        this.array = array;
        this.corners = corners;
        this.program = new ShaderProgram(gl, GROUND_VERTEX, GROUND_FRAGMENT);
        gl.bindVertexArray(array);
        gl.bindBuffer(gl.ARRAY_BUFFER, corners);
        gl.bufferData(gl.ARRAY_BUFFER, CORNERS, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.bindVertexArray(null);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }
    draw(viewProjection: Mat4): void {
        const { gl, program } = this;
        program.use();
        gl.uniformMatrix4fv(program.uniform('u_viewProjection'), false, viewProjection);
        gl.uniform1f(program.uniform('u_extent'), EXTENT_METERS);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE);
        gl.bindVertexArray(this.array);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.bindVertexArray(null);
        gl.disable(gl.BLEND);
    }
    dispose(): void {
        this.program.dispose();
        this.gl.deleteBuffer(this.corners);
        this.gl.deleteVertexArray(this.array);
    }
}
