import * as mat4 from '@/engine/core/math/mat4';
import * as quat from '@/engine/core/math/quat';
import * as vec3 from '@/engine/core/math/vec3';
import { AXIS_INDICES, type AxisIndex, type GizmoAxes } from '../gizmo/gizmo-frame';
import type { TargetState } from './target-state';
import type { TransformDelta } from './transform-delta';
type AxisPermutation = readonly [AxisIndex, AxisIndex, AxisIndex];
const PERMUTATIONS: readonly AxisPermutation[] = [
    [0, 1, 2],
    [0, 2, 1],
    [1, 0, 2],
    [1, 2, 0],
    [2, 0, 1],
    [2, 1, 0],
];
const worldPosition = vec3.create();
const offset = vec3.create();
const rotation = quat.create();
const turn = quat.create();
const parentConjugate = quat.create();
function matchLocalAxes(worldAxes: GizmoAxes, frameAxes: GizmoAxes): AxisPermutation {
    let best = PERMUTATIONS[0];
    let bestAlignment = -1;
    for (const permutation of PERMUTATIONS) {
        let alignment = 0;
        for (const axis of AXIS_INDICES)
            alignment += Math.abs(vec3.dot(frameAxes[axis], worldAxes[permutation[axis]]));
        if (alignment > bestAlignment) {
            bestAlignment = alignment;
            best = permutation;
        }
    }
    return best;
}
function scaleTarget(state: TargetState, delta: TransformDelta): void {
    const { scale } = state.entity.transform;
    const localAxis = matchLocalAxes(state.worldAxes, delta.scaleAxes);
    for (const axis of AXIS_INDICES) {
        const factor = delta.scale[axis];
        scale[localAxis[axis]] = state.scale[localAxis[axis]] * factor;
        if (!delta.sharedPivot)
            continue;
        vec3.subtract(offset, worldPosition, delta.pivot);
        vec3.scaleAndAdd(worldPosition, worldPosition, delta.scaleAxes[axis], (factor - 1) * vec3.dot(offset, delta.scaleAxes[axis]));
    }
}
function rotateTarget(state: TargetState, delta: TransformDelta): void {
    if (delta.sharedPivot) {
        vec3.subtract(offset, worldPosition, delta.pivot);
        vec3.rotateAroundAxis(offset, offset, delta.rotationAxis, delta.rotationAngle);
        vec3.add(worldPosition, delta.pivot, offset);
    }
    quat.fromAxisAngle(turn, delta.rotationAxis, delta.rotationAngle);
    quat.fromEulerDegrees(rotation, state.rotation);
    quat.multiply(rotation, state.parentRotation, rotation);
    quat.multiply(rotation, turn, rotation);
    quat.conjugate(parentConjugate, state.parentRotation);
    quat.multiply(rotation, parentConjugate, rotation);
    quat.toEulerDegreesNear(state.entity.transform.rotation, rotation, state.rotation);
}
export function applyTransformDelta(state: TargetState, delta: TransformDelta): void {
    const { transform } = state.entity;
    const { translation } = delta;
    const scaled = delta.scale[0] !== 1 || delta.scale[1] !== 1 || delta.scale[2] !== 1;
    const rotated = delta.rotationAngle !== 0;
    const translated = translation[0] !== 0 || translation[1] !== 0 || translation[2] !== 0;
    vec3.copy(worldPosition, state.worldPosition);
    vec3.copy(transform.scale, state.scale);
    vec3.copy(transform.rotation, state.rotation);
    if (scaled)
        scaleTarget(state, delta);
    if (rotated)
        rotateTarget(state, delta);
    if (!translated && !(delta.sharedPivot && (scaled || rotated))) {
        vec3.copy(transform.position, state.position);
        return;
    }
    vec3.add(worldPosition, worldPosition, translation);
    mat4.transformPoint(transform.position, state.parentInverse, worldPosition);
}
