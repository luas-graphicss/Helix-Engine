import * as vec3 from './vec3';
import type { Vec3 } from './vec3';
import type { Mat4 } from './mat4';
export interface Aabb {
    min: Vec3;
    max: Vec3;
}
export function create(): Aabb {
    return {
        min: vec3.create(Infinity, Infinity, Infinity),
        max: vec3.create(-Infinity, -Infinity, -Infinity),
    };
}
export function reset(out: Aabb): Aabb {
    vec3.set(out.min, Infinity, Infinity, Infinity);
    vec3.set(out.max, -Infinity, -Infinity, -Infinity);
    return out;
}
export function isEmpty(box: Aabb): boolean {
    return box.min[0] > box.max[0] || box.min[1] > box.max[1] || box.min[2] > box.max[2];
}
export function intersects(a: Aabb, b: Aabb): boolean {
    return (a.min[0] <= b.max[0] && b.min[0] <= a.max[0] &&
        a.min[1] <= b.max[1] && b.min[1] <= a.max[1] &&
        a.min[2] <= b.max[2] && b.min[2] <= a.max[2]);
}
export function union(out: Aabb, a: Aabb, b: Aabb): Aabb {
    for (let axis = 0; axis < 3; axis++) {
        out.min[axis] = Math.min(a.min[axis], b.min[axis]);
        out.max[axis] = Math.max(a.max[axis], b.max[axis]);
    }
    return out;
}
export function center(out: Vec3, box: Aabb): Vec3 {
    out[0] = (box.min[0] + box.max[0]) * 0.5;
    out[1] = (box.min[1] + box.max[1]) * 0.5;
    out[2] = (box.min[2] + box.max[2]) * 0.5;
    return out;
}
export function halfDiagonal(box: Aabb): number {
    return vec3.distance(box.min, box.max) * 0.5;
}
export function distanceToPoint(box: Aabb, point: Vec3): number {
    let squared = 0;
    for (let axis = 0; axis < 3; axis++) {
        const value = point[axis];
        if (value < box.min[axis])
            squared += (box.min[axis] - value) ** 2;
        else if (value > box.max[axis])
            squared += (value - box.max[axis]) ** 2;
    }
    return Math.sqrt(squared);
}
export function transform(out: Aabb, box: Aabb, matrix: Mat4): Aabb {
    const minX = box.min[0], minY = box.min[1], minZ = box.min[2];
    const maxX = box.max[0], maxY = box.max[1], maxZ = box.max[2];
    for (let row = 0; row < 3; row++) {
        const ax = matrix[row] * minX, bx = matrix[row] * maxX;
        const ay = matrix[4 + row] * minY, by = matrix[4 + row] * maxY;
        const az = matrix[8 + row] * minZ, bz = matrix[8 + row] * maxZ;
        const translation = matrix[12 + row];
        out.min[row] = translation + Math.min(ax, bx) + Math.min(ay, by) + Math.min(az, bz);
        out.max[row] = translation + Math.max(ax, bx) + Math.max(ay, by) + Math.max(az, bz);
    }
    return out;
}
