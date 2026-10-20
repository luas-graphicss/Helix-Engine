import * as mat4 from '@/engine/core/math/mat4';
import type { Mat4 } from '@/engine/core/math/mat4';
import * as mat3 from '@/engine/core/math/mat3';
import { createIndexArray, type MeshData } from './mesh-data';
const normal3 = mat3.create();
function determinant3(m: Mat4): number {
    return (m[0] * (m[5] * m[10] - m[6] * m[9]) - m[4] * (m[1] * m[10] - m[2] * m[9]) + m[8] * (m[1] * m[6] - m[2] * m[5]));
}
export function transformMeshData(mesh: MeshData, matrix: Mat4, name = mesh.name): MeshData {
    const positions = new Float32Array(mesh.positions.length);
    const normals = new Float32Array(mesh.normals.length);
    const normalMatrix = mat4.normalMatrix(normal3, matrix);
    for (let i = 0; i < positions.length; i += 3) {
        const x = mesh.positions[i], y = mesh.positions[i + 1], z = mesh.positions[i + 2];
        positions[i] = matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12];
        positions[i + 1] = matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13];
        positions[i + 2] = matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14];
        const nx = mesh.normals[i], ny = mesh.normals[i + 1], nz = mesh.normals[i + 2];
        let tx = nx, ty = ny, tz = nz;
        if (normalMatrix) {
            tx = normalMatrix[0] * nx + normalMatrix[3] * ny + normalMatrix[6] * nz;
            ty = normalMatrix[1] * nx + normalMatrix[4] * ny + normalMatrix[7] * nz;
            tz = normalMatrix[2] * nx + normalMatrix[5] * ny + normalMatrix[8] * nz;
        }
        const length = Math.hypot(tx, ty, tz) || 1;
        normals[i] = tx / length;
        normals[i + 1] = ty / length;
        normals[i + 2] = tz / length;
    }
    const indices = mesh.indices.slice();
    if (determinant3(matrix) < 0) {
        for (let i = 0; i < indices.length; i += 3) {
            const b = indices[i + 1];
            indices[i + 1] = indices[i + 2];
            indices[i + 2] = b;
        }
    }
    return { name, positions, normals, uvs: mesh.uvs.slice(), indices };
}
export function mergeMeshData(name: string, meshes: readonly MeshData[]): MeshData {
    let vertexCount = 0;
    let indexCount = 0;
    for (const mesh of meshes) {
        vertexCount += mesh.positions.length / 3;
        indexCount += mesh.indices.length;
    }
    const positions = new Float32Array(vertexCount * 3);
    const normals = new Float32Array(vertexCount * 3);
    const uvs = new Float32Array(vertexCount * 2);
    const indices = new Uint32Array(indexCount);
    let vertexOffset = 0;
    let indexOffset = 0;
    for (const mesh of meshes) {
        positions.set(mesh.positions, vertexOffset * 3);
        normals.set(mesh.normals, vertexOffset * 3);
        if (mesh.uvs.length === (mesh.positions.length / 3) * 2)
            uvs.set(mesh.uvs, vertexOffset * 2);
        for (let i = 0; i < mesh.indices.length; i++)
            indices[indexOffset + i] = mesh.indices[i] + vertexOffset;
        vertexOffset += mesh.positions.length / 3;
        indexOffset += mesh.indices.length;
    }
    return { name, positions, normals, uvs, indices: createIndexArray(indices, vertexCount) };
}
