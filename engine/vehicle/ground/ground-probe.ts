import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import * as mat3 from '@/engine/core/math/mat3';
import type { Aabb } from '@/engine/core/math/aabb';
import type { RigidBody } from '@/engine/physics/body/rigid-body';
import type { ColliderShape, HeightfieldShape } from '@/engine/physics/shapes/collider-shape';
import type { PhysicsWorld } from '@/engine/physics/world/physics-world';
import { raycastHeightfield } from './ray-heightfield';
import { raycastMeshShape } from './ray-mesh';
import { raycastBox, raycastCapsule, raycastSphere } from './ray-primitives';
export interface GroundHit {
    body: RigidBody | null;
    distance: number;
    readonly point: Vec3;
    readonly normal: Vec3;
}
export function createGroundHit(): GroundHit {
    return { body: null, distance: 0, point: vec3.create(), normal: vec3.create(0, 1, 0) };
}
const localOrigin = vec3.create();
const localDirection = vec3.create();
const candidateNormal = vec3.create();
function raycastLocalShape(shape: Exclude<ColliderShape, HeightfieldShape>, origin: Vec3, direction: Vec3, maxDistance: number, outNormal: Vec3): number | null {
    switch (shape.kind) {
        case 'box':
            return raycastBox(shape, origin, direction, maxDistance, outNormal);
        case 'sphere':
            return raycastSphere(shape, origin, direction, maxDistance, outNormal);
        case 'capsule':
            return raycastCapsule(shape, origin, direction, maxDistance, outNormal);
        case 'mesh':
            return raycastMeshShape(shape, origin, direction, maxDistance, outNormal);
    }
}
function raycastBody(body: RigidBody, origin: Vec3, direction: Vec3, maxDistance: number, outNormal: Vec3): number | null {
    const { shape } = body;
    if (shape.kind === 'heightfield')
        return raycastHeightfield(shape, origin, direction, maxDistance, outNormal);
    vec3.subtract(localOrigin, origin, body.position);
    mat3.transformVec3Transposed(localOrigin, body.rotation, localOrigin);
    mat3.transformVec3Transposed(localDirection, body.rotation, direction);
    const distance = raycastLocalShape(shape, localOrigin, localDirection, maxDistance, outNormal);
    if (distance !== null)
        mat3.transformVec3(outNormal, body.rotation, outNormal);
    return distance;
}
function segmentTouchesBox(origin: Vec3, direction: Vec3, length: number, box: Aabb): boolean {
    for (let axis = 0; axis < 3; axis++) {
        const end = origin[axis] + direction[axis] * length;
        if (Math.max(origin[axis], end) < box.min[axis] || Math.min(origin[axis], end) > box.max[axis])
            return false;
    }
    return true;
}
export class GroundProbe {
    constructor(private readonly world: PhysicsWorld) { }
    cast(origin: Vec3, direction: Vec3, maxDistance: number, vehicle: RigidBody, out: GroundHit): boolean {
        const { bodies, layers } = this.world;
        out.body = null;
        out.distance = maxDistance;
        for (const body of bodies) {
            if (body === vehicle || body.outOfBounds)
                continue;
            if (!layers.pairCollides(vehicle.layer, vehicle.collisionMask, body.layer, body.collisionMask))
                continue;
            if (!segmentTouchesBox(origin, direction, out.distance, body.aabb))
                continue;
            const distance = raycastBody(body, origin, direction, out.distance, candidateNormal);
            if (distance === null)
                continue;
            out.body = body;
            out.distance = distance;
            vec3.copy(out.normal, candidateNormal);
        }
        if (!out.body)
            return false;
        vec3.scaleAndAdd(out.point, origin, direction, out.distance);
        return true;
    }
}
