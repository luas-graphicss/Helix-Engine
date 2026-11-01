import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { GL } from './context';
const ATTRIB_POSITION = 0;
const ATTRIB_COLOR = 1;
const POSITION_SIZE = 3;
const COLOR_SIZE = 4;
const VERTEX_FLOATS = POSITION_SIZE + COLOR_SIZE;
const FLOAT_BYTES = 4;
const STRIDE = VERTEX_FLOATS * FLOAT_BYTES;
const INITIAL_VERTICES = 2048;
const pointA = vec3.create();
const pointB = vec3.create();
export class LineBatch {
    private data = new Float32Array(INITIAL_VERTICES * VERTEX_FLOATS);
    private floats = 0;
    private uploadedVertices = 0;
    private capacityBytes = 0;
    private readonly buffer: WebGLBuffer;
    private readonly vao: WebGLVertexArrayObject;
    constructor(private readonly gl: GL) {
        const buffer = gl.createBuffer();
        const vao = gl.createVertexArray();
        if (!buffer || !vao)
            throw new Error('Não foi possível criar o lote de linhas.');
        this.buffer = buffer;
        this.vao = vao;
        gl.bindVertexArray(vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.enableVertexAttribArray(ATTRIB_POSITION);
        gl.vertexAttribPointer(ATTRIB_POSITION, POSITION_SIZE, gl.FLOAT, false, STRIDE, 0);
        gl.enableVertexAttribArray(ATTRIB_COLOR);
        gl.vertexAttribPointer(ATTRIB_COLOR, COLOR_SIZE, gl.FLOAT, false, STRIDE, POSITION_SIZE * FLOAT_BYTES);
        gl.bindVertexArray(null);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }
    get vertexCount(): number {
        return this.floats / VERTEX_FLOATS;
    }
    begin(): void {
        this.floats = 0;
    }
    segment(a: Vec3, b: Vec3, color: Vec3, alpha: number): void {
        this.vertex(a, color, alpha);
        this.vertex(b, color, alpha);
    }
    circle(center: Vec3, axisU: Vec3, axisV: Vec3, radius: number, color: Vec3, alpha: number, segments = 32): void {
        this.arc(center, axisU, axisV, radius, 0, Math.PI * 2, color, alpha, segments);
    }
    arc(center: Vec3, axisU: Vec3, axisV: Vec3, radius: number, from: number, to: number, color: Vec3, alpha: number, segments = 24): void {
        const step = (to - from) / segments;
        pointOnCircle(pointA, center, axisU, axisV, radius, from);
        for (let i = 1; i <= segments; i++) {
            pointOnCircle(pointB, center, axisU, axisV, radius, from + step * i);
            this.segment(pointA, pointB, color, alpha);
            vec3.copy(pointA, pointB);
        }
    }
    upload(): void {
        const { gl } = this;
        const bytes = this.floats * FLOAT_BYTES;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
        if (bytes > this.capacityBytes) {
            gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
            this.capacityBytes = this.data.byteLength;
        }
        if (bytes > 0)
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data, 0, this.floats);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        this.uploadedVertices = this.vertexCount;
    }
    draw(): boolean {
        if (this.uploadedVertices === 0)
            return false;
        const { gl } = this;
        gl.bindVertexArray(this.vao);
        gl.drawArrays(gl.LINES, 0, this.uploadedVertices);
        gl.bindVertexArray(null);
        return true;
    }
    dispose(): void {
        this.gl.deleteBuffer(this.buffer);
        this.gl.deleteVertexArray(this.vao);
    }
    private vertex(position: Vec3, color: Vec3, alpha: number): void {
        if (this.floats + VERTEX_FLOATS > this.data.length)
            this.grow();
        const d = this.data;
        let o = this.floats;
        d[o++] = position[0];
        d[o++] = position[1];
        d[o++] = position[2];
        d[o++] = color[0];
        d[o++] = color[1];
        d[o++] = color[2];
        d[o++] = alpha;
        this.floats = o;
    }
    private grow(): void {
        const next = new Float32Array(this.data.length * 2);
        next.set(this.data);
        this.data = next;
    }
}
function pointOnCircle(out: Vec3, center: Vec3, axisU: Vec3, axisV: Vec3, radius: number, angle: number): Vec3 {
    const u = Math.cos(angle) * radius;
    const v = Math.sin(angle) * radius;
    out[0] = center[0] + axisU[0] * u + axisV[0] * v;
    out[1] = center[1] + axisU[1] * u + axisV[1] * v;
    out[2] = center[2] + axisU[2] * u + axisV[2] * v;
    return out;
}
