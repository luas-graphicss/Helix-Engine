import type { Ray } from '@/engine/core/math/ray';
import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
const PARALLEL_EPSILON = 1e-6;
const GRAZING_EPSILON = 1e-5;
const offset = vec3.create();
const turned = vec3.create();
export function closestParamOnLine(lineOrigin: Vec3, lineDirection: Vec3, ray: Ray): number | null {
    vec3.subtract(offset, lineOrigin, ray.origin);
    const alignment = vec3.dot(lineDirection, ray.direction);
    const denominator = 1 - alignment * alignment;
    if (denominator < PARALLEL_EPSILON)
        return null;
    return (alignment * vec3.dot(ray.direction, offset) - vec3.dot(lineDirection, offset)) / denominator;
}
export function intersectRayPlane(out: Vec3, ray: Ray, planeOrigin: Vec3, normal: Vec3): boolean {
    const denominator = vec3.dot(normal, ray.direction);
    if (Math.abs(denominator) < GRAZING_EPSILON)
        return false;
    vec3.subtract(offset, planeOrigin, ray.origin);
    const distance = vec3.dot(offset, normal) / denominator;
    if (distance < 0)
        return false;
    vec3.scaleAndAdd(out, ray.origin, ray.direction, distance);
    return true;
}
export function signedAngleAround(axis: Vec3, from: Vec3, to: Vec3): number {
    vec3.cross(turned, from, to);
    return Math.atan2(vec3.dot(turned, axis), vec3.dot(from, to));
}
export function wrapAngle(angle: number): number {
    return angle - Math.round(angle / (Math.PI * 2)) * Math.PI * 2;
}
