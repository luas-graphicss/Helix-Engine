import * as aabb from '@/engine/core/math/aabb';
import type { Aabb } from '@/engine/core/math/aabb';
import type { Vec3 } from '@/engine/core/math/vec3';
type HeightSampler = (x: number, z: number) => number;
interface SphereCollider {
    readonly kind: 'sphere';
    readonly bounds: Aabb;
    readonly center: Vec3;
    readonly radius: number;
}
export interface CapsuleCollider {
    readonly kind: 'capsule';
    readonly bounds: Aabb;
    readonly start: Vec3;
    readonly end: Vec3;
    readonly radius: number;
}
export interface BoxCollider {
    readonly kind: 'box';
    readonly bounds: Aabb;
    readonly center: Vec3;
    readonly axes: Float32Array;
    readonly halfExtents: Vec3;
}
export interface HeightfieldCollider {
    readonly kind: 'heightfield';
    readonly bounds: Aabb;
    readonly heightAt: HeightSampler;
}
export type ClothCollider = SphereCollider | CapsuleCollider | BoxCollider | HeightfieldCollider;
export function createSphereCollider(center: Vec3, radius: number): SphereCollider {
    const bounds = aabb.create();
    for (let axis = 0; axis < 3; axis++) {
        bounds.min[axis] = center[axis] - radius;
        bounds.max[axis] = center[axis] + radius;
    }
    return { kind: 'sphere', bounds, center, radius };
}
export function createCapsuleCollider(start: Vec3, end: Vec3, radius: number): CapsuleCollider {
    const bounds = aabb.create();
    for (let axis = 0; axis < 3; axis++) {
        bounds.min[axis] = Math.min(start[axis], end[axis]) - radius;
        bounds.max[axis] = Math.max(start[axis], end[axis]) + radius;
    }
    return { kind: 'capsule', bounds, start, end, radius };
}
export function createBoxCollider(center: Vec3, axes: Float32Array, halfExtents: Vec3): BoxCollider {
    const bounds = aabb.create();
    for (let axis = 0; axis < 3; axis++) {
        const reach = Math.abs(axes[axis]) * halfExtents[0] + Math.abs(axes[3 + axis]) * halfExtents[1] + Math.abs(axes[6 + axis]) * halfExtents[2];
        bounds.min[axis] = center[axis] - reach;
        bounds.max[axis] = center[axis] + reach;
    }
    return { kind: 'box', bounds, center, axes, halfExtents };
}
export function createHeightfieldCollider(bounds: Aabb, heightAt: HeightSampler): HeightfieldCollider {
    return { kind: 'heightfield', bounds, heightAt };
}
