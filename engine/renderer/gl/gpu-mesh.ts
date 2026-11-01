import type { GL } from './context';
import type { InstanceLayout } from './instance-layout';
import type { InstanceBuffer } from './instance-buffer';
import type { MeshData, MeshSkinning } from '@/engine/renderer/geometry/mesh-data';
import { resolveTangents, TANGENT_COMPONENTS } from '@/engine/renderer/geometry/tangent-frame';
export const ATTRIB_POSITION = 0;
export const ATTRIB_NORMAL = 1;
export const ATTRIB_UV = 2;
export const ATTRIB_SKIN = 14;
export const ATTRIB_TANGENT = 15;
const POSITION_SIZE = 3;
const NORMAL_SIZE = 3;
const UV_SIZE = 2;
const INFLUENCES = 4;
const FLOAT_BYTES = 4;
const UINT_BYTES = 4;
const WEIGHT_SCALE = 0xffff;
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
type MeshIndices = Uint16Array | Uint32Array;
function packSkinning(skinning: MeshSkinning): Uint32Array {
    const packed = new Uint32Array(skinning.joints.length);
    for (let i = 0; i < packed.length; i++) {
        const weight = Math.round(Math.min(Math.max(skinning.weights[i], 0), 1) * WEIGHT_SCALE);
        packed[i] = ((skinning.joints[i] & 0xffff) << 16) | weight;
    }
    return packed;
}
function buildEdgeIndices(indices: MeshIndices): MeshIndices {
    const edges = indices instanceof Uint32Array ? new Uint32Array(indices.length * 2) : new Uint16Array(indices.length * 2);
    for (let triangle = 0, edge = 0; triangle + 2 < indices.length; triangle += 3, edge += 6) {
        const a = indices[triangle];
        const b = indices[triangle + 1];
        const c = indices[triangle + 2];
        edges[edge] = a;
        edges[edge + 1] = b;
        edges[edge + 2] = b;
        edges[edge + 3] = c;
        edges[edge + 4] = c;
        edges[edge + 5] = a;
    }
    return edges;
}
export class GpuMesh {
    indexCount: number;
    indexType: number;
    private vertexFloats: number;
    private uvFloats: number;
    readonly positionBuffer: WebGLBuffer;
    readonly normalBuffer: WebGLBuffer;
    readonly uvBuffer: WebGLBuffer;
    readonly tangentBuffer: WebGLBuffer;
    readonly indexBuffer: WebGLBuffer;
    readonly skinBuffer: WebGLBuffer | null;
    private readonly vao: WebGLVertexArrayObject;
    private readonly instancedVaos = new Map<InstanceLayout, WebGLVertexArrayObject>();
    private indices: MeshIndices;
    private edgeBuffer: WebGLBuffer | null = null;
    private edgeCount = 0;
    constructor(private readonly gl: GL, data: MeshData) {
        this.positionBuffer = createBuffer(gl, gl.ARRAY_BUFFER, data.positions);
        this.normalBuffer = createBuffer(gl, gl.ARRAY_BUFFER, data.normals);
        this.uvBuffer = createBuffer(gl, gl.ARRAY_BUFFER, data.uvs);
        this.tangentBuffer = createBuffer(gl, gl.ARRAY_BUFFER, resolveTangents(data));
        this.skinBuffer = data.skinning ? createBuffer(gl, gl.ARRAY_BUFFER, packSkinning(data.skinning)) : null;
        this.indexBuffer = createBuffer(gl, gl.ELEMENT_ARRAY_BUFFER, data.indices);
        this.indices = data.indices;
        this.indexCount = data.indices.length;
        this.indexType = data.indices instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
        this.vertexFloats = data.positions.length;
        this.uvFloats = data.uvs.length;
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
        gl.bindBuffer(gl.ARRAY_BUFFER, this.tangentBuffer);
        gl.enableVertexAttribArray(ATTRIB_TANGENT);
        gl.vertexAttribPointer(ATTRIB_TANGENT, TANGENT_COMPONENTS, gl.FLOAT, false, 0, firstVertex * TANGENT_COMPONENTS * FLOAT_BYTES);
        if (this.skinBuffer) {
            gl.bindBuffer(gl.ARRAY_BUFFER, this.skinBuffer);
            gl.enableVertexAttribArray(ATTRIB_SKIN);
            gl.vertexAttribIPointer(ATTRIB_SKIN, INFLUENCES, gl.UNSIGNED_INT, 0, firstVertex * INFLUENCES * UINT_BYTES);
        }
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    }
    update(data: MeshData): void {
        const gl = this.gl;
        const sameTopology = data.indices.length === this.indexCount && data.positions.length === this.vertexFloats && data.uvs.length === this.uvFloats;
        const indexType = data.indices instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
        const tangents = resolveTangents(data);
        this.indices = data.indices;
        this.releaseEdges();
        if (sameTopology && indexType === this.indexType) {
            gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, data.positions);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, data.normals);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer);
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, data.uvs);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.tangentBuffer);
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, tangents);
            gl.bindBuffer(gl.ARRAY_BUFFER, null);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
            gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, 0, data.indices);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
            return;
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, data.positions, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, data.normals, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, data.uvs, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.tangentBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, tangents, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data.indices, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
        this.indexCount = data.indices.length;
        this.indexType = indexType;
        this.vertexFloats = data.positions.length;
        this.uvFloats = data.uvs.length;
    }
    draw(): void {
        const gl = this.gl;
        gl.bindVertexArray(this.vao);
        gl.drawElements(gl.TRIANGLES, this.indexCount, this.indexType, 0);
        gl.bindVertexArray(null);
    }
    drawInstanced(instances: InstanceBuffer, firstInstance: number, count: number): void {
        const { gl } = this;
        this.bindInstanced(instances, firstInstance);
        gl.drawElementsInstanced(gl.TRIANGLES, this.indexCount, this.indexType, 0, count);
        gl.bindVertexArray(null);
    }
    drawEdgesInstanced(instances: InstanceBuffer, firstInstance: number, count: number): void {
        const { gl } = this;
        this.bindInstanced(instances, firstInstance);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.edges());
        gl.drawElementsInstanced(gl.LINES, this.edgeCount, this.indexType, 0, count);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        gl.bindVertexArray(null);
    }
    private bindInstanced(instances: InstanceBuffer, firstInstance: number): void {
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
    }
    private edges(): WebGLBuffer {
        if (this.edgeBuffer)
            return this.edgeBuffer;
        const edges = buildEdgeIndices(this.indices);
        this.edgeBuffer = createBuffer(this.gl, this.gl.ELEMENT_ARRAY_BUFFER, edges);
        this.edgeCount = edges.length;
        return this.edgeBuffer;
    }
    private releaseEdges(): void {
        if (!this.edgeBuffer)
            return;
        this.gl.deleteBuffer(this.edgeBuffer);
        this.edgeBuffer = null;
        this.edgeCount = 0;
    }
    dispose(): void {
        const { gl } = this;
        gl.deleteBuffer(this.positionBuffer);
        gl.deleteBuffer(this.normalBuffer);
        gl.deleteBuffer(this.uvBuffer);
        gl.deleteBuffer(this.tangentBuffer);
        if (this.skinBuffer)
            gl.deleteBuffer(this.skinBuffer);
        gl.deleteBuffer(this.indexBuffer);
        this.releaseEdges();
        gl.deleteVertexArray(this.vao);
        for (const vao of this.instancedVaos.values())
            gl.deleteVertexArray(vao);
        this.instancedVaos.clear();
    }
}
