export interface PackedMyriadMesh {
    readonly clusterCount: number;
    readonly groupCount: number;
    readonly vertexCount: number;
    readonly leafTriangles: number;
    readonly totalTriangles: number;
    readonly levelCount: number;
    readonly vertexData: Uint32Array;
    readonly triangleData: Uint8Array;
    readonly clusterSphere: Float32Array;
    readonly clusterBounds: Float32Array;
    readonly clusterInfo: Uint32Array;
    readonly clusterGeneratingGroup: Int32Array;
    readonly clusterTriangleCount: Uint16Array;
    readonly clusterLevel: Uint8Array;
    readonly groupSphere: Float32Array;
    readonly groupError: Float32Array;
    readonly groupChildStart: Uint32Array;
    readonly groupChildren: Uint32Array;
    readonly roots: Uint32Array;
    readonly buildMs: number;
}
export function packedMeshTransferables(mesh: PackedMyriadMesh): ArrayBuffer[] {
    const buffers = [
        mesh.vertexData,
        mesh.triangleData,
        mesh.clusterSphere,
        mesh.clusterBounds,
        mesh.clusterInfo,
        mesh.clusterGeneratingGroup,
        mesh.clusterTriangleCount,
        mesh.clusterLevel,
        mesh.groupSphere,
        mesh.groupError,
        mesh.groupChildStart,
        mesh.groupChildren,
        mesh.roots,
    ].map((array) => array.buffer as ArrayBuffer);
    return Array.from(new Set(buffers));
}
export function packedMeshBytes(mesh: PackedMyriadMesh): number {
    return mesh.vertexData.byteLength + mesh.triangleData.byteLength + mesh.clusterSphere.byteLength + mesh.clusterBounds.byteLength + mesh.clusterInfo.byteLength;
}
