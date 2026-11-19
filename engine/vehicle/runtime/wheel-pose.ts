import * as vec3 from '@/engine/core/math/vec3';
import * as quat from '@/engine/core/math/quat';
import type { Entity } from '@/engine/core/scene/entity';
import type { RigidBody } from '@/engine/physics/body/rigid-body';
import { BUMP_TRAVEL_RATIO } from '../suspension/suspension-force';
import type { WheelRig, WheelState } from './wheel-state';
const AXLE = vec3.create(1, 0, 0);
const UP = vec3.create(0, 1, 0);
const lift = vec3.create();
const steer = quat.create();
const spin = quat.create();
const turn = quat.create();
const parentToBody = quat.create();
const local = quat.create();
function axisScale(x: number, y: number, z: number): number {
    return Math.hypot(x, y, z) || 1;
}
export function captureWheelRig(entity: Entity, body: RigidBody): WheelRig {
    const { parent, transform } = entity;
    const bodyToParent = quat.copy(quat.create(), body.orientation);
    const parentScale = vec3.create(1, 1, 1);
    if (parent) {
        const matrix = parent.worldMatrix;
        quat.fromMat4Rotation(parentToBody, matrix);
        quat.conjugate(parentToBody, parentToBody);
        quat.multiply(bodyToParent, parentToBody, body.orientation);
        vec3.set(parentScale, axisScale(matrix[0], matrix[1], matrix[2]), axisScale(matrix[4], matrix[5], matrix[6]), axisScale(matrix[8], matrix[9], matrix[10]));
    }
    return {
        restPosition: vec3.copy(vec3.create(), transform.position),
        restEuler: vec3.copy(vec3.create(), transform.rotation),
        restRotation: quat.fromEulerDegrees(quat.create(), transform.rotation),
        bodyToParent,
        parentScale,
    };
}
export function writeWheelPose(wheel: WheelState): void {
    const { rig, entity, settings } = wheel;
    const { position, rotation } = entity.transform;
    vec3.set(lift, 0, Math.min(wheel.compression, settings.suspensionTravel * BUMP_TRAVEL_RATIO), 0);
    quat.rotateVec3(lift, rig.bodyToParent, lift);
    position[0] = rig.restPosition[0] + lift[0] / rig.parentScale[0];
    position[1] = rig.restPosition[1] + lift[1] / rig.parentScale[1];
    position[2] = rig.restPosition[2] + lift[2] / rig.parentScale[2];
    quat.fromAxisAngle(steer, UP, -wheel.steerAngle);
    quat.fromAxisAngle(spin, AXLE, wheel.spinAngle);
    quat.multiply(turn, steer, spin);
    quat.conjugate(parentToBody, rig.bodyToParent);
    quat.multiply(turn, rig.bodyToParent, turn);
    quat.multiply(turn, turn, parentToBody);
    quat.multiply(local, turn, rig.restRotation);
    quat.toEulerDegrees(rotation, local);
}
export function restoreWheelPose(wheel: WheelState): void {
    const { rig, entity } = wheel;
    vec3.copy(entity.transform.position, rig.restPosition);
    vec3.copy(entity.transform.rotation, rig.restEuler);
}
