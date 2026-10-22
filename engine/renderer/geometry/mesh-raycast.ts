import type { Ray } from '@/engine/core/math/ray';
import type { MeshData } from './mesh-data';
const PARALLEL_EPSILON = 1e-12;
export function raycastMesh(ray: Ray, mesh: MeshData, maxDistance = Infinity): number | null {
    const { positions, indices } = mesh;
    const ox = ray.origin[0], oy = ray.origin[1], oz = ray.origin[2];
    const dx = ray.direction[0], dy = ray.direction[1], dz = ray.direction[2];
    let best = maxDistance;
    let hit = false;
    for (let i = 0; i < indices.length; i += 3) {
        const a = indices[i] * 3;
        const b = indices[i + 1] * 3;
        const c = indices[i + 2] * 3;
        const ax = positions[a], ay = positions[a + 1], az = positions[a + 2];
        const e1x = positions[b] - ax, e1y = positions[b + 1] - ay, e1z = positions[b + 2] - az;
        const e2x = positions[c] - ax, e2y = positions[c + 1] - ay, e2z = positions[c + 2] - az;
        const px = dy * e2z - dz * e2y;
        const py = dz * e2x - dx * e2z;
        const pz = dx * e2y - dy * e2x;
        const det = e1x * px + e1y * py + e1z * pz;
        if (det > -PARALLEL_EPSILON && det < PARALLEL_EPSILON)
            continue;
        const inv = 1 / det;
        const sx = ox - ax, sy = oy - ay, sz = oz - az;
        const u = (sx * px + sy * py + sz * pz) * inv;
        if (u < 0 || u > 1)
            continue;
        const qx = sy * e1z - sz * e1y;
        const qy = sz * e1x - sx * e1z;
        const qz = sx * e1y - sy * e1x;
        const v = (dx * qx + dy * qy + dz * qz) * inv;
        if (v < 0 || u + v > 1)
            continue;
        const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
        if (t > 0 && t < best) {
            best = t;
            hit = true;
        }
    }
    return hit ? best : null;
}
