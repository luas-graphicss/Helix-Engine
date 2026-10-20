import type { GL } from './context';
const VERTICES = new Float32Array([-1, -1, 3, -1, -1, 3]);
export class FullscreenTriangle {
    private readonly vao: WebGLVertexArrayObject;
    private readonly buffer: WebGLBuffer;
    constructor(private readonly gl: GL) {
        const vao = gl.createVertexArray();
        const buffer = gl.createBuffer();
        if (!vao || !buffer)
            throw new Error('Não foi possível alocar o triângulo de tela cheia.');
        this.vao = vao;
        this.buffer = buffer;
        gl.bindVertexArray(vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, VERTICES, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.bindVertexArray(null);
    }
    draw(): void {
        const { gl } = this;
        gl.bindVertexArray(this.vao);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.bindVertexArray(null);
    }
    dispose(): void {
        this.gl.deleteBuffer(this.buffer);
        this.gl.deleteVertexArray(this.vao);
    }
}
