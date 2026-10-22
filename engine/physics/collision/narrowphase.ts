import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { Mat3 } from '@/engine/core/math/mat3';
import type { RigidBody } from '@/engine/physics/body/rigid-body';
import type { CapsuleShape, ShapeKind, SphereShape } from '@/engine/physics/shapes/collider-shape';
import { collideSphereBox, collideSphereCapsule, collideSphereSphere } from './collide-sphere';
import { collideCapsuleBox, collideCapsuleCapsule } from './collide-capsule';
import { collideBoxBox } from './collide-box-box';
import { collideBoxHeightfield, collideCapsuleHeightfield, collideSphereHeightfield } from './collide-heightfield';
import { collideBoxMesh, collideCapsuleMesh, collideSphereMesh } from './collide-mesh';
import type { ContactResult } from './manifold';
const KIND_ORDER: Record<ShapeKind, number> = { sphere: 0, capsule: 1, box: 2, mesh: 3, heightfield: 4 };
export function collideCapsuleWithBody(position: Vec3, rotation: Mat3, capsule: CapsuleShape, body: RigidBody, margin: number, out: ContactResult): boolean {
    out.reset();
    const shape = body.shape;
    switch (shape.kind) {
        case 'sphere':
            collideSphereCapsule(body.position, shape, position, rotation, capsule, margin, out);
            if (out.count > 0)
                vec3.scale(out.normal, out.normal, -1);
            break;
        case 'capsule':
            collideCapsuleCapsule(position, rotation, capsule, body.position, body.rotation, shape, margin, out);
            break;
        case 'box':
            collideCapsuleBox(position, rotation, capsule, body.position, body.rotation, shape, margin, out);
            break;
        case 'heightfield':
            collideCapsuleHeightfield(position, rotation, capsule, shape, margin, out);
            break;
        case 'mesh':
            collideCapsuleMesh(position, rotation, capsule, body.position, body.rotation, shape, margin, out);
            break;
    }
    return out.count > 0;
}
export function collideSphereWithBody(center: Vec3, sphere: SphereShape, body: RigidBody, margin: number, out: ContactResult): boolean {
    out.reset();
    const shape = body.shape;
    switch (shape.kind) {
        case 'sphere':
            collideSphereSphere(center, sphere, body.position, shape, margin, out);
            break;
        case 'capsule':
            collideSphereCapsule(center, sphere, body.position, body.rotation, shape, margin, out);
            break;
        case 'box':
            collideSphereBox(center, sphere, body.position, body.rotation, shape, margin, out);
            break;
        case 'heightfield':
            collideSphereHeightfield(center, sphere, shape, margin, out);
            break;
        case 'mesh':
            collideSphereMesh(center, sphere, body.position, body.rotation, shape, margin, out);
            break;
    }
    return out.count > 0;
}
export function collideBodies(bodyA: RigidBody, bodyB: RigidBody, margin: number, linearSlop: number, out: ContactResult): boolean {
    out.reset();
    const flip = KIND_ORDER[bodyA.shape.kind] > KIND_ORDER[bodyB.shape.kind];
    const first = flip ? bodyB : bodyA;
    const second = flip ? bodyA : bodyB;
    const shapeA = first.shape;
    const shapeB = second.shape;
    switch (shapeA.kind) {
        case 'sphere':
            if (shapeB.kind === 'sphere')
                collideSphereSphere(first.position, shapeA, second.position, shapeB, margin, out);
            else if (shapeB.kind === 'capsule')
                collideSphereCapsule(first.position, shapeA, second.position, second.rotation, shapeB, margin, out);
            else if (shapeB.kind === 'box')
                collideSphereBox(first.position, shapeA, second.position, second.rotation, shapeB, margin, out);
            else if (shapeB.kind === 'mesh')
                collideSphereMesh(first.position, shapeA, second.position, second.rotation, shapeB, margin, out);
            else
                collideSphereHeightfield(first.position, shapeA, shapeB, margin, out);
            break;
        case 'capsule':
            if (shapeB.kind === 'capsule') {
                collideCapsuleCapsule(first.position, first.rotation, shapeA, second.position, second.rotation, shapeB, margin, out);
            }
            else if (shapeB.kind === 'box') {
                collideCapsuleBox(first.position, first.rotation, shapeA, second.position, second.rotation, shapeB, margin, out);
            }
            else if (shapeB.kind === 'mesh') {
                collideCapsuleMesh(first.position, first.rotation, shapeA, second.position, second.rotation, shapeB, margin, out);
            }
            else if (shapeB.kind === 'heightfield') {
                collideCapsuleHeightfield(first.position, first.rotation, shapeA, shapeB, margin, out);
            }
            break;
        case 'box':
            if (shapeB.kind === 'box') {
                collideBoxBox(first.position, first.rotation, shapeA, second.position, second.rotation, shapeB, margin, linearSlop, out);
            }
            else if (shapeB.kind === 'mesh') {
                collideBoxMesh(first.position, first.rotation, shapeA, second.position, second.rotation, shapeB, margin, out);
            }
            else if (shapeB.kind === 'heightfield') {
                collideBoxHeightfield(first.position, first.rotation, shapeA, shapeB, margin, out);
            }
            break;
        case 'mesh':
        case 'heightfield':
            break;
    }
    if (out.count === 0)
        return false;
    if (flip)
        vec3.scale(out.normal, out.normal, -1);
    return true;
}
