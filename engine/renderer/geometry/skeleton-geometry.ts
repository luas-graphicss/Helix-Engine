import { createMeshData, type MeshData } from './mesh-data';
import { createSphere, createTorus } from './primitives';
export interface SkeletonGeometrySet {
    readonly bone: MeshData;
    readonly joint: MeshData;
    readonly ring: MeshData;
}
const BONE_BULGE_AT = 0.18;
const BONE_HALF_WIDTH = 0.5;
function createBoneOctahedron(): MeshData {
    const base: [
        number,
        number,
        number
    ] = [0, 0, 0];
    const tip: [
        number,
        number,
        number
    ] = [0, 1, 0];
    const w = BONE_HALF_WIDTH;
    const ring: Array<[
        number,
        number,
        number
    ]> = [
        [w, BONE_BULGE_AT, 0],
        [0, BONE_BULGE_AT, w],
        [-w, BONE_BULGE_AT, 0],
        [0, BONE_BULGE_AT, -w],
    ];
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const pushTriangle = (a: [
        number,
        number,
        number
    ], b: [
        number,
        number,
        number
    ], c: [
        number,
        number,
        number
    ]) => {
        const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
        const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
        let nx = uy * vz - uz * vy;
        let ny = uz * vx - ux * vz;
        let nz = ux * vy - uy * vx;
        const length = Math.hypot(nx, ny, nz) || 1;
        nx /= length;
        ny /= length;
        nz /= length;
        const start = positions.length / 3;
        for (const point of [a, b, c]) {
            positions.push(point[0], point[1], point[2]);
            normals.push(nx, ny, nz);
            uvs.push(0, 0);
        }
        indices.push(start, start + 1, start + 2);
    };
    for (let i = 0; i < 4; i++) {
        const current = ring[i];
        const next = ring[(i + 1) % 4];
        pushTriangle(base, next, current);
        pushTriangle(tip, current, next);
    }
    return createMeshData('Osso', positions, normals, uvs, indices);
}
export function createSkeletonGeometry(): SkeletonGeometrySet {
    return {
        bone: createBoneOctahedron(),
        joint: createSphere(1, 12, 8),
        ring: createTorus(1, 0.12, 24, 10),
    };
}
