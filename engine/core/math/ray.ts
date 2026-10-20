import * as vec3 from './vec3';
import type { Vec3 } from './vec3';
import type { Mat4 } from './mat4';
import type { Aabb } from './aabb';
export interface Ray {
    origin: Vec3;
    direction: Vec3;
}
export function createRay(): Ray {
    return { origin: vec3.create(), direction: vec3.create(0, 0, -1) };
}
export function transformRay(out: Ray, ray: Ray, matrix: Mat4): Ray {
    const ox = ray.origin[0], oy = ray.origin[1], oz = ray.origin[2];
    const dx = ray.direction[0], dy = ray.direction[1], dz = ray.direction[2];
    const w = matrix[3] * ox + matrix[7] * oy + matrix[11] * oz + matrix[15] || 1;
    out.origin[0] = (matrix[0] * ox + matrix[4] * oy + matrix[8] * oz + matrix[12]) / w;
    out.origin[1] = (matrix[1] * ox + matrix[5] * oy + matrix[9] * oz + matrix[13]) / w;
    out.origin[2] = (matrix[2] * ox + matrix[6] * oy + matrix[10] * oz + matrix[14]) / w;
    out.direction[0] = matrix[0] * dx + matrix[4] * dy + matrix[8] * dz;
    out.direction[1] = matrix[1] * dx + matrix[5] * dy + matrix[9] * dz;
    out.direction[2] = matrix[2] * dx + matrix[6] * dy + matrix[10] * dz;
    return out;
}
export function intersectRayAabb(ray: Ray, box: Aabb): number | null {
    let tMin = -Infinity;
    let tMax = Infinity;
    for (let axis = 0; axis < 3; axis++) {
        const origin = ray.origin[axis];
        const direction = ray.direction[axis];
        if (Math.abs(direction) < 1e-8) {
            if (origin < box.min[axis] || origin > box.max[axis])
                return null;
            continue;
        }
        const inv = 1 / direction;
        let t1 = (box.min[axis] - origin) * inv;
        let t2 = (box.max[axis] - origin) * inv;
        if (t1 > t2)
            [t1, t2] = [t2, t1];
        tMin = Math.max(tMin, t1);
        tMax = Math.min(tMax, t2);
        if (tMin > tMax)
            return null;
    }
    if (tMax < 0)
        return null;
    return tMin >= 0 ? tMin : tMax;
}
