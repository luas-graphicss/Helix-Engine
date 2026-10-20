import * as vec3 from '@/engine/core/math/vec3';
import type { RigidBody } from '@/engine/physics/body/rigid-body';
import type { ColliderKind } from '@/engine/physics/shapes/collider-shape';
import { collideSphereBox, collideSphereCapsule, collideSphereSphere } from './collide-sphere';
import { collideCapsuleBox, collideCapsuleCapsule } from './collide-capsule';
import { collideBoxBox } from './collide-box-box';
import type { ContactResult } from './manifold';
const KIND_ORDER: Record<ColliderKind, number> = { sphere: 0, capsule: 1, box: 2 };
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
            else
                collideSphereBox(first.position, shapeA, second.position, second.rotation, shapeB, margin, out);
            break;
        case 'capsule':
            if (shapeB.kind === 'capsule') {
                collideCapsuleCapsule(first.position, first.rotation, shapeA, second.position, second.rotation, shapeB, margin, out);
            }
            else if (shapeB.kind === 'box') {
                collideCapsuleBox(first.position, first.rotation, shapeA, second.position, second.rotation, shapeB, margin, out);
            }
            break;
        case 'box':
            if (shapeB.kind === 'box') {
                collideBoxBox(first.position, first.rotation, shapeA, second.position, second.rotation, shapeB, margin, linearSlop, out);
            }
            break;
    }
    if (out.count === 0)
        return false;
    if (flip)
        vec3.scale(out.normal, out.normal, -1);
    return true;
}
