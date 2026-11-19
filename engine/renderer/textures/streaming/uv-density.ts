import { getMeshVersion, type MeshData } from '@/engine/renderer/geometry/mesh-data';
interface DensityEntry {
    version: number;
    density: number;
}
const densities = new WeakMap<MeshData, DensityEntry>();
function measureUvDensity(mesh: MeshData): number {
    const { positions, uvs, indices } = mesh;
    let surfaceArea = 0;
    let uvArea = 0;
    for (let index = 0; index + 2 < indices.length; index += 3) {
        const a = indices[index];
        const b = indices[index + 1];
        const c = indices[index + 2];
        const abX = positions[b * 3] - positions[a * 3];
        const abY = positions[b * 3 + 1] - positions[a * 3 + 1];
        const abZ = positions[b * 3 + 2] - positions[a * 3 + 2];
        const acX = positions[c * 3] - positions[a * 3];
        const acY = positions[c * 3 + 1] - positions[a * 3 + 1];
        const acZ = positions[c * 3 + 2] - positions[a * 3 + 2];
        const crossX = abY * acZ - abZ * acY;
        const crossY = abZ * acX - abX * acZ;
        const crossZ = abX * acY - abY * acX;
        surfaceArea += Math.sqrt(crossX * crossX + crossY * crossY + crossZ * crossZ);
        const abU = uvs[b * 2] - uvs[a * 2];
        const abV = uvs[b * 2 + 1] - uvs[a * 2 + 1];
        const acU = uvs[c * 2] - uvs[a * 2];
        const acV = uvs[c * 2 + 1] - uvs[a * 2 + 1];
        uvArea += Math.abs(abU * acV - acU * abV);
    }
    return surfaceArea > 0 && uvArea > 0 ? Math.sqrt(uvArea / surfaceArea) : 0;
}
export function uvDensity(mesh: MeshData): number {
    const version = getMeshVersion(mesh);
    const entry = densities.get(mesh);
    if (entry && entry.version === version)
        return entry.density;
    const density = measureUvDensity(mesh);
    densities.set(mesh, { version, density });
    return density;
}
