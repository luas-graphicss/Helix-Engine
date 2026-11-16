import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
export interface MirrorPlane {
    readonly normal: Vec3;
    offset: number;
}
export function createMirrorPlane(): MirrorPlane {
    return { normal: vec3.create(0, 1, 0), offset: 0 };
}
export function planeDistance(plane: MirrorPlane, point: Vec3): number {
    return vec3.dot(plane.normal, point) - plane.offset;
}
export function reflectPoint(out: Vec3, plane: MirrorPlane, point: Vec3): Vec3 {
    return vec3.scaleAndAdd(out, point, plane.normal, -2 * planeDistance(plane, point));
}
export function reflectDirection(out: Vec3, plane: MirrorPlane, direction: Vec3): Vec3 {
    return vec3.scaleAndAdd(out, direction, plane.normal, -2 * vec3.dot(plane.normal, direction));
}
