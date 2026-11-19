import type { MeshData } from '@/engine/renderer/geometry/mesh-data';
const restBySimulatedMesh = new WeakMap<MeshData, MeshData>();
export function trackSimulatedMesh(simulated: MeshData, rest: MeshData): void {
    restBySimulatedMesh.set(simulated, rest);
}
export function restMeshOf(mesh: MeshData): MeshData {
    return restBySimulatedMesh.get(mesh) ?? mesh;
}
