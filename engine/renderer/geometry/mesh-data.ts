export interface MeshData {
    readonly name: string;
    readonly positions: Float32Array;
    readonly normals: Float32Array;
    readonly uvs: Float32Array;
    readonly indices: Uint16Array | Uint32Array;
    readonly skinning?: MeshSkinning;
}
export interface MeshSkinning {
    readonly joints: Uint16Array;
    readonly weights: Float32Array;
}
export function createIndexArray(indices: ArrayLike<number>, vertexCount: number): Uint16Array | Uint32Array {
    return vertexCount > 0xffff ? new Uint32Array(indices) : new Uint16Array(indices);
}
export function createMeshData(name: string, positions: ArrayLike<number>, normals: ArrayLike<number>, uvs: ArrayLike<number>, indices: ArrayLike<number>): MeshData {
    return {
        name,
        positions: new Float32Array(positions),
        normals: new Float32Array(normals),
        uvs: new Float32Array(uvs),
        indices: createIndexArray(indices, positions.length / 3),
    };
}
export function getVertexCount(mesh: MeshData): number {
    return mesh.positions.length / 3;
}
export function getTriangleCount(mesh: MeshData): number {
    return mesh.indices.length / 3;
}
const meshVersions = new WeakMap<MeshData, number>();
export function markMeshDirty(mesh: MeshData): void {
    meshVersions.set(mesh, (meshVersions.get(mesh) ?? 0) + 1);
}
export function getMeshVersion(mesh: MeshData): number {
    return meshVersions.get(mesh) ?? 0;
}
