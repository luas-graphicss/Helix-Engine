import type { GL } from './context';
import type { InstanceLayout } from './instance-layout';
import type { InstanceBuffer } from './instance-buffer';
import type { MeshData } from '@/engine/renderer/geometry/mesh-data';
export const ATTRIB_POSITION = 0;
export const ATTRIB_NORMAL = 1;
export const ATTRIB_UV = 2;
const POSITION_SIZE = 3;
const NORMAL_SIZE = 3;
const UV_SIZE = 2;
const FLOAT_BYTES = 4;
function createBuffer(gl: GL, target: number, data: ArrayBufferView): WebGLBuffer {
    const buffer = gl.createBuffer();
    if (!buffer)
        throw new Error('Não foi possível criar um buffer da malha.');
    gl.bindBuffer(target, buffer);
    gl.bufferData(target, data, gl.STATIC_DRAW);
    return buffer;
}
function createVao(gl: GL): WebGLVertexArrayObject {
    const vao = gl.createVertexArray();
    if (!vao)
        throw new Error('Não foi possível criar o VAO.');
    return vao;
}
export class GpuMesh {
    readonly indexCount: number;
    readonly indexType: number;
    readonly positionBuffer: WebGLBuffer;
    readonly normalBuffer: WebGLBuffer;
    readonly uvBuffer: WebGLBuffer;
    readonly indexBuffer: WebGLBuffer;
    private readonly vao: WebGLVertexArrayObject;
    private readonly instancedVaos = new Map<InstanceLayout, WebGLVertexArrayObject>();
    constructor(private readonly gl: GL, data: MeshData) {
        this.positionBuffer = createBuffer(gl, gl.ARRAY_BUFFER, data.positions);
        this.normalBuffer = createBuffer(gl, gl.ARRAY_BUFFER, data.normals);
        this.uvBuffer = createBuffer(gl, gl.ARRAY_BUFFER, data.uvs);
        this.indexBuffer = createBuffer(gl, gl.ELEMENT_ARRAY_BUFFER, data.indices);
        this.indexCount = data.indices.length;
        this.indexType = data.indices instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
        this.vao = createVao(gl);
        gl.bindVertexArray(this.vao);
        this.bindVertexAttributes();
        gl.bindVertexArray(null);
    }
    bindVertexAttributes(firstVertex = 0): void {
        const { gl } = this;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.enableVertexAttribArray(ATTRIB_POSITION);
        gl.vertexAttribPointer(ATTRIB_POSITION, POSITION_SIZE, gl.FLOAT, false, 0, firstVertex * POSITION_SIZE * FLOAT_BYTES);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
        gl.enableVertexAttribArray(ATTRIB_NORMAL);
        gl.vertexAttribPointer(ATTRIB_NORMAL, NORMAL_SIZE, gl.FLOAT, false, 0, firstVertex * NORMAL_SIZE * FLOAT_BYTES);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer);
        gl.enableVertexAttribArray(ATTRIB_UV);
        gl.vertexAttribPointer(ATTRIB_UV, UV_SIZE, gl.FLOAT, false, 0, firstVertex * UV_SIZE * FLOAT_BYTES);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    }
    update(data: MeshData): void {
        const gl = this.gl;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, data.positions);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, data.normals);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }
    draw(): void {
        const gl = this.gl;
        gl.bindVertexArray(this.vao);
        gl.drawElements(gl.TRIANGLES, this.indexCount, this.indexType, 0);
        gl.bindVertexArray(null);
    }
    drawInstanced(instances: InstanceBuffer, firstInstance: number, count: number): void {
        const { gl } = this;
        const { layout } = instances;
        let vao = this.instancedVaos.get(layout);
        if (!vao) {
            vao = createVao(gl);
            gl.bindVertexArray(vao);
            this.bindVertexAttributes();
            this.instancedVaos.set(layout, vao);
        }
        else {
            gl.bindVertexArray(vao);
        }
        layout.bind(gl, instances.buffer, firstInstance);
        gl.drawElementsInstanced(gl.TRIANGLES, this.indexCount, this.indexType, 0, count);
        gl.bindVertexArray(null);
    }
    dispose(): void {
        const { gl } = this;
        gl.deleteBuffer(this.positionBuffer);
        gl.deleteBuffer(this.normalBuffer);
        gl.deleteBuffer(this.uvBuffer);
        gl.deleteBuffer(this.indexBuffer);
        gl.deleteVertexArray(this.vao);
        for (const vao of this.instancedVaos.values())
            gl.deleteVertexArray(vao);
        this.instancedVaos.clear();
    }
}
