import type { Mat4 } from '@/engine/core/math/mat4';
import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
const direction = vec3.create();
const sideA = vec3.create();
const sideB = vec3.create();
const normal = vec3.create();
function setColumn(out: Mat4, column: 0 | 1 | 2, axis: Vec3, length: number): void {
    const offset = column * 4;
    out[offset] = axis[0] * length;
    out[offset + 1] = axis[1] * length;
    out[offset + 2] = axis[2] * length;
    out[offset + 3] = 0;
}
function setTranslation(out: Mat4, origin: Vec3): void {
    out[12] = origin[0];
    out[13] = origin[1];
    out[14] = origin[2];
    out[15] = 1;
}
function perpendicular(out: Vec3, axis: Vec3): Vec3 {
    const x = Math.abs(axis[0]);
    const y = Math.abs(axis[1]);
    const z = Math.abs(axis[2]);
    if (x <= y && x <= z)
        vec3.set(out, 0, -axis[2], axis[1]);
    else if (y <= z)
        vec3.set(out, -axis[2], 0, axis[0]);
    else
        vec3.set(out, -axis[1], axis[0], 0);
    return vec3.normalize(out, out);
}
export function basisMatrix(out: Mat4, origin: Vec3, x: Vec3, y: Vec3, z: Vec3, lengthX: number, lengthY: number, lengthZ: number): void {
    setColumn(out, 0, x, lengthX);
    setColumn(out, 1, y, lengthY);
    setColumn(out, 2, z, lengthZ);
    setTranslation(out, origin);
}
export function segmentMatrix(out: Mat4, start: Vec3, end: Vec3, radius: number): boolean {
    vec3.subtract(direction, end, start);
    const length = vec3.length(direction);
    if (length < 1e-9)
        return false;
    vec3.scale(direction, direction, 1 / length);
    perpendicular(sideA, direction);
    vec3.cross(sideB, direction, sideA);
    basisMatrix(out, start, direction, sideA, sideB, length, radius, radius);
    return true;
}
export function quadMatrix(out: Mat4, corner: Vec3, alongU: Vec3, alongV: Vec3): void {
    vec3.subtract(sideA, alongU, corner);
    vec3.subtract(sideB, alongV, corner);
    vec3.cross(normal, sideA, sideB);
    vec3.normalize(normal, normal);
    basisMatrix(out, corner, sideA, sideB, normal, 1, 1, 1);
}
