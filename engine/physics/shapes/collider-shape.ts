import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { Mat3 } from '@/engine/core/math/mat3';
import type { Aabb } from '@/engine/core/math/aabb';
export type ColliderKind = 'box' | 'sphere' | 'capsule';
export interface BoxShape {
    readonly kind: 'box';
    readonly halfExtents: Vec3;
}
export interface SphereShape {
    readonly kind: 'sphere';
    readonly radius: number;
}
export interface CapsuleShape {
    readonly kind: 'capsule';
    readonly radius: number;
    readonly halfHeight: number;
}
export type ColliderShape = BoxShape | SphereShape | CapsuleShape;
export const MIN_SHAPE_EXTENT = 0.005;
export function createBoxShape(halfX: number, halfY: number, halfZ: number): BoxShape {
    return {
        kind: 'box',
        halfExtents: vec3.create(Math.max(halfX, MIN_SHAPE_EXTENT), Math.max(halfY, MIN_SHAPE_EXTENT), Math.max(halfZ, MIN_SHAPE_EXTENT)),
    };
}
export function createSphereShape(radius: number): SphereShape {
    return { kind: 'sphere', radius: Math.max(radius, MIN_SHAPE_EXTENT) };
}
export function createCapsuleShape(radius: number, halfHeight: number): CapsuleShape {
    return { kind: 'capsule', radius: Math.max(radius, MIN_SHAPE_EXTENT), halfHeight: Math.max(halfHeight, 0) };
}
export function shapeVolume(shape: ColliderShape): number {
    switch (shape.kind) {
        case 'box':
            return 8 * shape.halfExtents[0] * shape.halfExtents[1] * shape.halfExtents[2];
        case 'sphere':
            return (4 / 3) * Math.PI * shape.radius ** 3;
        case 'capsule':
            return Math.PI * shape.radius ** 2 * (2 * shape.halfHeight) + (4 / 3) * Math.PI * shape.radius ** 3;
    }
}
export function shapeMaxExtent(shape: ColliderShape): number {
    switch (shape.kind) {
        case 'box':
            return vec3.length(shape.halfExtents);
        case 'sphere':
            return shape.radius;
        case 'capsule':
            return shape.halfHeight + shape.radius;
    }
}
export function computeShapeAabb(out: Aabb, shape: ColliderShape, position: Vec3, rotation: Mat3, margin: number): Aabb {
    let ex: number;
    let ey: number;
    let ez: number;
    switch (shape.kind) {
        case 'sphere':
            ex = ey = ez = shape.radius;
            break;
        case 'box': {
            const h = shape.halfExtents;
            ex = Math.abs(rotation[0]) * h[0] + Math.abs(rotation[3]) * h[1] + Math.abs(rotation[6]) * h[2];
            ey = Math.abs(rotation[1]) * h[0] + Math.abs(rotation[4]) * h[1] + Math.abs(rotation[7]) * h[2];
            ez = Math.abs(rotation[2]) * h[0] + Math.abs(rotation[5]) * h[1] + Math.abs(rotation[8]) * h[2];
            break;
        }
        case 'capsule': {
            const axisY = shape.halfHeight;
            ex = Math.abs(rotation[3]) * axisY + shape.radius;
            ey = Math.abs(rotation[4]) * axisY + shape.radius;
            ez = Math.abs(rotation[5]) * axisY + shape.radius;
            break;
        }
    }
    out.min[0] = position[0] - ex - margin;
    out.min[1] = position[1] - ey - margin;
    out.min[2] = position[2] - ez - margin;
    out.max[0] = position[0] + ex + margin;
    out.max[1] = position[1] + ey + margin;
    out.max[2] = position[2] + ez + margin;
    return out;
}
