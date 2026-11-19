import * as mat3 from '@/engine/core/math/mat3';
import * as mat4 from '@/engine/core/math/mat4';
import type { Mat4 } from '@/engine/core/math/mat4';
import { getMeshVersion, markMeshDirty, type MeshData } from '@/engine/renderer/geometry/mesh-data';
import { resolveTangents, TANGENT_COMPONENTS } from '@/engine/renderer/geometry/tangent-frame';
const INITIAL_VERTICES = 1024;
const INITIAL_INDICES = 4096;
export interface MergedMeshData {
    name: string;
    positions: Float32Array;
    normals: Float32Array;
    uvs: Float32Array;
    tangents: Float32Array;
    indices: Uint32Array;
    readonly dynamic: boolean;
}
interface CachedTangents {
    version: number;
    tangents: Float32Array;
}
const tangentCache = new WeakMap<MeshData, CachedTangents>();
function sourceTangents(mesh: MeshData): Float32Array {
    const version = getMeshVersion(mesh);
    const cached = tangentCache.get(mesh);
    if (cached && cached.version === version)
        return cached.tangents;
    const tangents = resolveTangents(mesh);
    tangentCache.set(mesh, { version, tangents });
    return tangents;
}
function grown(source: Float32Array, required: number): Float32Array {
    if (source.length >= required)
        return source;
    let length = source.length;
    while (length < required)
        length *= 2;
    const target = new Float32Array(length);
    target.set(source);
    return target;
}
export function createMergedMeshData(name: string, dynamic = false): MergedMeshData {
    return { name, positions: new Float32Array(0), normals: new Float32Array(0), uvs: new Float32Array(0), tangents: new Float32Array(0), indices: new Uint32Array(0), dynamic };
}
export class MergedMeshBuilder {
    vertexCount = 0;
    indexCount = 0;
    private positions: Float32Array = new Float32Array(INITIAL_VERTICES * 3);
    private normals: Float32Array = new Float32Array(INITIAL_VERTICES * 3);
    private uvs: Float32Array = new Float32Array(INITIAL_VERTICES * 2);
    private tangents: Float32Array = new Float32Array(INITIAL_VERTICES * TANGENT_COMPONENTS);
    private indices: Uint32Array = new Uint32Array(INITIAL_INDICES);
    private readonly normalMatrix = mat3.create();
    reset(): void {
        this.vertexCount = 0;
        this.indexCount = 0;
    }
    append(mesh: MeshData, world: Mat4): void {
        const count = mesh.positions.length / 3;
        const first = this.vertexCount;
        this.reserve(first + count, this.indexCount + mesh.indices.length);
        const { positions, normals, uvs, tangents, indices } = this;
        const normal = mat4.normalMatrix(this.normalMatrix, world) ?? mat3.identity(this.normalMatrix);
        const meshTangents = sourceTangents(mesh);
        for (let vertex = 0; vertex < count; vertex++) {
            const source = vertex * 3;
            const target = (first + vertex) * 3;
            const x = mesh.positions[source];
            const y = mesh.positions[source + 1];
            const z = mesh.positions[source + 2];
            positions[target] = world[0] * x + world[4] * y + world[8] * z + world[12];
            positions[target + 1] = world[1] * x + world[5] * y + world[9] * z + world[13];
            positions[target + 2] = world[2] * x + world[6] * y + world[10] * z + world[14];
            const nx = mesh.normals[source];
            const ny = mesh.normals[source + 1];
            const nz = mesh.normals[source + 2];
            normals[target] = normal[0] * nx + normal[3] * ny + normal[6] * nz;
            normals[target + 1] = normal[1] * nx + normal[4] * ny + normal[7] * nz;
            normals[target + 2] = normal[2] * nx + normal[5] * ny + normal[8] * nz;
            const sourceTangent = vertex * TANGENT_COMPONENTS;
            const targetTangent = (first + vertex) * TANGENT_COMPONENTS;
            const tx = meshTangents[sourceTangent];
            const ty = meshTangents[sourceTangent + 1];
            const tz = meshTangents[sourceTangent + 2];
            tangents[targetTangent] = world[0] * tx + world[4] * ty + world[8] * tz;
            tangents[targetTangent + 1] = world[1] * tx + world[5] * ty + world[9] * tz;
            tangents[targetTangent + 2] = world[2] * tx + world[6] * ty + world[10] * tz;
            tangents[targetTangent + 3] = meshTangents[sourceTangent + 3];
        }
        if (mesh.uvs.length === count * 2)
            uvs.set(mesh.uvs, first * 2);
        else
            uvs.fill(0, first * 2, (first + count) * 2);
        for (let index = 0; index < mesh.indices.length; index++)
            indices[this.indexCount + index] = mesh.indices[index] + first;
        this.vertexCount += count;
        this.indexCount += mesh.indices.length;
    }
    writeTo(target: MergedMeshData): void {
        const { vertexCount, indexCount } = this;
        target.positions = this.positions.slice(0, vertexCount * 3);
        target.normals = this.normals.slice(0, vertexCount * 3);
        target.uvs = this.uvs.slice(0, vertexCount * 2);
        target.tangents = this.tangents.slice(0, vertexCount * TANGENT_COMPONENTS);
        target.indices = this.indices.slice(0, indexCount);
        markMeshDirty(target);
    }
    viewInto(target: MergedMeshData): void {
        const { vertexCount, indexCount } = this;
        target.positions = this.positions.subarray(0, vertexCount * 3);
        target.normals = this.normals.subarray(0, vertexCount * 3);
        target.uvs = this.uvs.subarray(0, vertexCount * 2);
        target.tangents = this.tangents.subarray(0, vertexCount * TANGENT_COMPONENTS);
        target.indices = this.indices.subarray(0, indexCount);
        markMeshDirty(target);
    }
    private reserve(vertices: number, indexTotal: number): void {
        this.positions = grown(this.positions, vertices * 3);
        this.normals = grown(this.normals, vertices * 3);
        this.uvs = grown(this.uvs, vertices * 2);
        this.tangents = grown(this.tangents, vertices * TANGENT_COMPONENTS);
        if (this.indices.length >= indexTotal)
            return;
        let length = this.indices.length;
        while (length < indexTotal)
            length *= 2;
        const indices = new Uint32Array(length);
        indices.set(this.indices);
        this.indices = indices;
    }
}
