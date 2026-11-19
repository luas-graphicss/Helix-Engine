import type { GL } from './context';
import type { InstanceLayout } from './instance-layout';
import type { InstanceBuffer } from './instance-buffer';
import type { MeshData, MeshSkinning } from '@/engine/renderer/geometry/mesh-data';
import { packUnitInterval, packUnitVectors } from '@/engine/renderer/geometry/compression/vertex-packing';
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
const PACKED_VECTOR_SIZE = 4;
const PACKED_VECTOR_BYTES = 4;
const PACKED_UV_BYTES = 4;
const WEIGHT_SCALE = 0xffff;
interface VertexFormat {
    readonly size: number;
    readonly type: number;
    readonly normalized: boolean;
    readonly bytes: number;
}
interface VertexStream {
    readonly data: ArrayBufferView;
    readonly format: VertexFormat;
}
interface VertexStreams {
    readonly normals: VertexStream;
    readonly uvs: VertexStream;
    readonly tangents: VertexStream;
}
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
function floatFormat(gl: GL, size: number): VertexFormat {
    return { size, type: gl.FLOAT, normalized: false, bytes: size * FLOAT_BYTES };
}
function buildVertexStreams(gl: GL, data: MeshData, compressed: boolean): VertexStreams {
    const tangents = resolveTangents(data);
    if (!compressed) {
        return {
            normals: { data: data.normals, format: floatFormat(gl, NORMAL_SIZE) },
            uvs: { data: data.uvs, format: floatFormat(gl, UV_SIZE) },
            tangents: { data: tangents, format: floatFormat(gl, TANGENT_COMPONENTS) },
        };
    }
    const packedVector: VertexFormat = { size: PACKED_VECTOR_SIZE, type: gl.INT_2_10_10_10_REV, normalized: true, bytes: PACKED_VECTOR_BYTES };
    const unitUvs = packUnitInterval(data.uvs);
    return {
        normals: { data: packUnitVectors(data.normals, NORMAL_SIZE), format: packedVector },
        uvs: unitUvs
            ? { data: unitUvs, format: { size: UV_SIZE, type: gl.UNSIGNED_SHORT, normalized: true, bytes: PACKED_UV_BYTES } }
            : { data: data.uvs, format: floatFormat(gl, UV_SIZE) },
        tangents: { data: packUnitVectors(tangents, TANGENT_COMPONENTS), format: packedVector },
    };
}
export class GpuMesh {
    indexCount: number;
    indexType: number;
    byteLength = 0;
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
    private readonly skinBytes: number;
    private indices: MeshIndices;
    private normalFormat: VertexFormat;
    private uvFormat: VertexFormat;
    private tangentFormat: VertexFormat;
    private edgeBuffer: WebGLBuffer | null = null;
    private edgeCount = 0;
    constructor(private readonly gl: GL, data: MeshData, readonly compressed = false) {
        const streams = buildVertexStreams(gl, data, compressed);
        const skin = data.skinning ? packSkinning(data.skinning) : null;
        this.positionBuffer = createBuffer(gl, gl.ARRAY_BUFFER, data.positions);
        this.normalBuffer = createBuffer(gl, gl.ARRAY_BUFFER, streams.normals.data);
        this.uvBuffer = createBuffer(gl, gl.ARRAY_BUFFER, streams.uvs.data);
        this.tangentBuffer = createBuffer(gl, gl.ARRAY_BUFFER, streams.tangents.data);
        this.skinBuffer = skin ? createBuffer(gl, gl.ARRAY_BUFFER, skin) : null;
        this.skinBytes = skin?.byteLength ?? 0;
        this.indexBuffer = createBuffer(gl, gl.ELEMENT_ARRAY_BUFFER, data.indices);
        this.indices = data.indices;
        this.indexCount = data.indices.length;
        this.indexType = data.indices instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
        this.vertexFloats = data.positions.length;
        this.uvFloats = data.uvs.length;
        this.normalFormat = streams.normals.format;
        this.uvFormat = streams.uvs.format;
        this.tangentFormat = streams.tangents.format;
        this.measure(data, streams);
        this.vao = createVao(gl);
        gl.bindVertexArray(this.vao);
        this.bindVertexAttributes();
        gl.bindVertexArray(null);
    }
    bindVertexAttributes(firstVertex = 0): void {
        const { gl, normalFormat, uvFormat, tangentFormat } = this;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.enableVertexAttribArray(ATTRIB_POSITION);
        gl.vertexAttribPointer(ATTRIB_POSITION, POSITION_SIZE, gl.FLOAT, false, 0, firstVertex * POSITION_SIZE * FLOAT_BYTES);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
        gl.enableVertexAttribArray(ATTRIB_NORMAL);
        gl.vertexAttribPointer(ATTRIB_NORMAL, normalFormat.size, normalFormat.type, normalFormat.normalized, 0, firstVertex * normalFormat.bytes);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer);
        gl.enableVertexAttribArray(ATTRIB_UV);
        gl.vertexAttribPointer(ATTRIB_UV, uvFormat.size, uvFormat.type, uvFormat.normalized, 0, firstVertex * uvFormat.bytes);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.tangentBuffer);
        gl.enableVertexAttribArray(ATTRIB_TANGENT);
        gl.vertexAttribPointer(ATTRIB_TANGENT, tangentFormat.size, tangentFormat.type, tangentFormat.normalized, 0, firstVertex * tangentFormat.bytes);
        if (this.skinBuffer) {
            gl.bindBuffer(gl.ARRAY_BUFFER, this.skinBuffer);
            gl.enableVertexAttribArray(ATTRIB_SKIN);
            gl.vertexAttribIPointer(ATTRIB_SKIN, INFLUENCES, gl.UNSIGNED_INT, 0, firstVertex * INFLUENCES * UINT_BYTES);
        }
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    }
    update(data: MeshData): void {
        const gl = this.gl;
        const streams = buildVertexStreams(gl, data, this.compressed);
        const sameFormats = streams.uvs.format.type === this.uvFormat.type;
        const sameTopology = data.indices.length === this.indexCount && data.positions.length === this.vertexFloats && data.uvs.length === this.uvFloats;
        const indexType = data.indices instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
        this.indices = data.indices;
        this.releaseEdges();
        this.measure(data, streams);
        if (sameTopology && sameFormats && indexType === this.indexType) {
            gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, data.positions);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, streams.normals.data);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer);
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, streams.uvs.data);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.tangentBuffer);
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, streams.tangents.data);
            gl.bindBuffer(gl.ARRAY_BUFFER, null);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
            gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, 0, data.indices);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
            return;
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, data.positions, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, streams.normals.data, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, streams.uvs.data, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.tangentBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, streams.tangents.data, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data.indices, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
        this.indexCount = data.indices.length;
        this.indexType = indexType;
        this.vertexFloats = data.positions.length;
        this.uvFloats = data.uvs.length;
        if (!sameFormats)
            this.adoptUvFormat(streams.uvs.format);
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
    private measure(data: MeshData, streams: VertexStreams): void {
        this.byteLength = data.positions.byteLength + streams.normals.data.byteLength + streams.uvs.data.byteLength + streams.tangents.data.byteLength + data.indices.byteLength + this.skinBytes;
    }
    private adoptUvFormat(format: VertexFormat): void {
        const { gl } = this;
        this.uvFormat = format;
        for (const vao of this.instancedVaos.values())
            gl.deleteVertexArray(vao);
        this.instancedVaos.clear();
        gl.bindVertexArray(this.vao);
        this.bindVertexAttributes();
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
