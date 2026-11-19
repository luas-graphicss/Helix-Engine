import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { BoxShape, CapsuleShape, SphereShape } from '@/engine/physics/shapes/collider-shape';
const PARALLEL_EPSILON = 1e-9;
const capOrigin = vec3.create();
const capNormal = vec3.create();
function hitAtOrigin(outNormal: Vec3, direction: Vec3): number {
    vec3.scale(outNormal, direction, -1);
    return 0;
}
function raycastBall(radius: number, origin: Vec3, direction: Vec3, maxDistance: number, outNormal: Vec3): number | null {
    const approach = vec3.dot(origin, direction);
    const offset = vec3.dot(origin, origin) - radius * radius;
    if (offset <= 0)
        return hitAtOrigin(outNormal, direction);
    if (approach > 0)
        return null;
    const discriminant = approach * approach - offset;
    if (discriminant < 0)
        return null;
    const distance = -approach - Math.sqrt(discriminant);
    if (distance > maxDistance)
        return null;
    vec3.scaleAndAdd(outNormal, origin, direction, distance);
    vec3.scale(outNormal, outNormal, 1 / radius);
    return distance;
}
function raycastCap(shape: CapsuleShape, side: 1 | -1, origin: Vec3, direction: Vec3, maxDistance: number, outNormal: Vec3): number | null {
    vec3.set(capOrigin, origin[0], origin[1] - side * shape.halfHeight, origin[2]);
    const distance = raycastBall(shape.radius, capOrigin, direction, maxDistance, capNormal);
    if (distance === null)
        return null;
    vec3.copy(outNormal, capNormal);
    return distance;
}
function raycastCapsuleSide(shape: CapsuleShape, origin: Vec3, direction: Vec3, maxDistance: number, outNormal: Vec3): number | null {
    const { radius, halfHeight } = shape;
    const spread = direction[0] * direction[0] + direction[2] * direction[2];
    if (spread < PARALLEL_EPSILON)
        return null;
    const approach = origin[0] * direction[0] + origin[2] * direction[2];
    const offset = origin[0] * origin[0] + origin[2] * origin[2] - radius * radius;
    const discriminant = approach * approach - spread * offset;
    if (discriminant < 0)
        return null;
    const distance = (-approach - Math.sqrt(discriminant)) / spread;
    if (distance < 0 || distance > maxDistance || Math.abs(origin[1] + direction[1] * distance) > halfHeight)
        return null;
    vec3.set(outNormal, (origin[0] + direction[0] * distance) / radius, 0, (origin[2] + direction[2] * distance) / radius);
    return distance;
}
export function raycastSphere(shape: SphereShape, origin: Vec3, direction: Vec3, maxDistance: number, outNormal: Vec3): number | null {
    return raycastBall(shape.radius, origin, direction, maxDistance, outNormal);
}
export function raycastBox(shape: BoxShape, origin: Vec3, direction: Vec3, maxDistance: number, outNormal: Vec3): number | null {
    const half = shape.halfExtents;
    let enter = -Infinity;
    let exit = Infinity;
    let enterAxis = -1;
    for (let axis = 0; axis < 3; axis++) {
        const start = origin[axis];
        const slope = direction[axis];
        if (Math.abs(slope) < PARALLEL_EPSILON) {
            if (Math.abs(start) > half[axis])
                return null;
            continue;
        }
        const facing = Math.sign(slope) * half[axis];
        const near = (-facing - start) / slope;
        const far = (facing - start) / slope;
        if (near > enter) {
            enter = near;
            enterAxis = axis;
        }
        exit = Math.min(exit, far);
        if (enter > exit)
            return null;
    }
    if (exit < 0 || enter > maxDistance)
        return null;
    if (enter <= 0 || enterAxis === -1)
        return hitAtOrigin(outNormal, direction);
    vec3.set(outNormal, 0, 0, 0);
    outNormal[enterAxis] = -Math.sign(direction[enterAxis]);
    return enter;
}
export function raycastCapsule(shape: CapsuleShape, origin: Vec3, direction: Vec3, maxDistance: number, outNormal: Vec3): number | null {
    const insideSide = origin[0] * origin[0] + origin[2] * origin[2] <= shape.radius * shape.radius;
    if (insideSide && Math.abs(origin[1]) <= shape.halfHeight)
        return hitAtOrigin(outNormal, direction);
    let nearest = raycastCapsuleSide(shape, origin, direction, maxDistance, outNormal);
    nearest = raycastCap(shape, 1, origin, direction, nearest ?? maxDistance, outNormal) ?? nearest;
    return raycastCap(shape, -1, origin, direction, nearest ?? maxDistance, outNormal) ?? nearest;
}
