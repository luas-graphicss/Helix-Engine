import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import * as quat from '@/engine/core/math/quat';
import type { RigidBody } from '@/engine/physics/body/rigid-body';
import { createJointDefinition, type JointDefinition, type JointType } from './joint-settings';
export interface WorldJointFrame {
    anchor?: Vec3;
    anchorA?: Vec3;
    anchorB?: Vec3;
    axis?: Vec3;
    secondaryAxis?: Vec3;
}
const inverseA = quat.create();
const inverseB = quat.create();
const scratch = vec3.create();
const WORLD_UP = vec3.create(0, 1, 0);
function toLocalPoint(out: Vec3, inverse: quat.Quat, origin: Vec3, worldPoint: Vec3): Vec3 {
    vec3.subtract(scratch, worldPoint, origin);
    return quat.rotateVec3(out, inverse, scratch);
}
function toLocalDirection(out: Vec3, inverse: quat.Quat, worldDirection: Vec3): Vec3 {
    return quat.rotateVec3(out, inverse, worldDirection);
}
export function defineJointFromWorld(type: JointType, bodyA: RigidBody, bodyB: RigidBody | null, frame: WorldJointFrame, overrides: Partial<JointDefinition> = {}): JointDefinition {
    const definition = createJointDefinition(type, overrides);
    const positionB = bodyB ? bodyB.position : vec3.create();
    const orientationB = bodyB ? bodyB.orientation : quat.create();
    quat.conjugate(inverseA, bodyA.orientation);
    quat.conjugate(inverseB, orientationB);
    const anchor = frame.anchor ?? positionB;
    const anchorA = frame.anchorA ?? anchor;
    const anchorB = frame.anchorB ?? anchor;
    toLocalPoint(definition.localAnchorA, inverseA, bodyA.position, anchorA);
    toLocalPoint(definition.localAnchorB, inverseB, positionB, anchorB);
    const axis = frame.axis && vec3.length(frame.axis) > 1e-9 ? vec3.normalize(vec3.create(), frame.axis) : WORLD_UP;
    toLocalDirection(definition.localAxisA, inverseA, axis);
    toLocalDirection(definition.localAxisB, inverseB, axis);
    if (frame.secondaryAxis && vec3.length(frame.secondaryAxis) > 1e-9) {
        const secondary = vec3.normalize(vec3.create(), frame.secondaryAxis);
        toLocalDirection(definition.localSecondaryA, inverseA, secondary);
        toLocalDirection(definition.localSecondaryB, inverseB, secondary);
    }
    else {
        const pick = Math.abs(axis[1]) < 0.9 ? vec3.create(0, 1, 0) : vec3.create(1, 0, 0);
        const secondary = vec3.normalize(vec3.create(), vec3.cross(vec3.create(), pick, axis));
        toLocalDirection(definition.localSecondaryA, inverseA, secondary);
        toLocalDirection(definition.localSecondaryB, inverseB, secondary);
    }
    quat.multiply(definition.referenceRotation, inverseA, orientationB);
    quat.normalize(definition.referenceRotation, definition.referenceRotation);
    if (type === 'distance' && overrides.length === undefined)
        definition.length = vec3.distance(anchorA, anchorB);
    return definition;
}
