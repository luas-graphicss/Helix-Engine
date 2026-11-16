import { getLocalBounds } from '@/engine/renderer/geometry/bounds';
import { getMeshVersion, type MeshData } from '@/engine/renderer/geometry/mesh-data';
const AXIS_ALIGNMENT = 0.999;
const SURFACE_SLACK = 1e-3;
const MAX_VERTICES = 16384;
const FACE_COUNT = 6;
export interface MirrorFace {
    readonly axis: number;
    readonly sign: number;
}
interface FaceEntry {
    version: number;
    faces: readonly MirrorFace[];
}
const NO_FACES: readonly MirrorFace[] = [];
const entries = new WeakMap<MeshData, FaceEntry>();
function dominantAxis(x: number, y: number, z: number): number {
    const ax = Math.abs(x);
    const ay = Math.abs(y);
    const az = Math.abs(z);
    if (ax >= ay && ax >= az)
        return 0;
    return ay >= az ? 1 : 2;
}
function findFlatFaces(mesh: MeshData): readonly MirrorFace[] {
    const { positions, normals } = mesh;
    const vertexCount = positions.length / 3;
    if (mesh.skinning || vertexCount === 0 || vertexCount > MAX_VERTICES || normals.length !== positions.length)
        return NO_FACES;
    const bounds = getLocalBounds(mesh);
    const slack = SURFACE_SLACK * Math.max(bounds.max[0] - bounds.min[0], bounds.max[1] - bounds.min[1], bounds.max[2] - bounds.min[2]);
    let found = 0;
    for (let vertex = 0; vertex < vertexCount; vertex++) {
        const base = vertex * 3;
        const nx = normals[base];
        const ny = normals[base + 1];
        const nz = normals[base + 2];
        const axis = dominantAxis(nx, ny, nz);
        const component = normals[base + axis];
        if (Math.abs(component) < AXIS_ALIGNMENT * Math.hypot(nx, ny, nz) || component === 0)
            return NO_FACES;
        const outward = component > 0;
        const surface = outward ? bounds.max[axis] : bounds.min[axis];
        if (Math.abs(positions[base + axis] - surface) > slack)
            return NO_FACES;
        found |= 1 << (axis * 2 + (outward ? 1 : 0));
    }
    const faces: MirrorFace[] = [];
    for (let index = 0; index < FACE_COUNT; index++) {
        if (found & (1 << index))
            faces.push({ axis: index >> 1, sign: index & 1 ? 1 : -1 });
    }
    return faces;
}
export function flatFacesOf(mesh: MeshData): readonly MirrorFace[] {
    const version = getMeshVersion(mesh);
    let entry = entries.get(mesh);
    if (!entry || entry.version !== version) {
        entry = { version, faces: findFlatFaces(mesh) };
        entries.set(mesh, entry);
    }
    return entry.faces;
}
