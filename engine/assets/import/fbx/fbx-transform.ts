import * as mat4 from '@/engine/core/math/mat4';
import * as vec3 from '@/engine/core/math/vec3';
import type { Mat4 } from '@/engine/core/math/mat4';
import type { Vec3 } from '@/engine/core/math/vec3';
import { degToRad } from '@/engine/core/math/scalar';
import type { FbxProperties } from './fbx-node';
const ZERO = vec3.create(0, 0, 0);
const ONE = vec3.create(1, 1, 1);
const AXES: readonly Vec3[] = [vec3.create(1, 0, 0), vec3.create(0, 1, 0), vec3.create(0, 0, 1)];
const ROTATION_ORDERS: ReadonlyArray<readonly [
    number,
    number,
    number
]> = [
    [0, 1, 2],
    [0, 2, 1],
    [1, 2, 0],
    [1, 0, 2],
    [2, 0, 1],
    [2, 1, 0],
];
const translation = vec3.create();
const rotation = vec3.create();
const scaling = vec3.create();
const preRotation = vec3.create();
const postRotation = vec3.create();
const rotationOffset = vec3.create();
const rotationPivot = vec3.create();
const scalingOffset = vec3.create();
const scalingPivot = vec3.create();
const offset = vec3.create();
const step = mat4.create();
const axisStep = mat4.create();
export interface FbxLocalTransform {
    matrix: Mat4;
    approximatedRotationOrder: boolean;
}
function eulerMatrix(out: Mat4, degrees: Vec3, order: number): Mat4 {
    const [first, second, third] = ROTATION_ORDERS[order] ?? ROTATION_ORDERS[0];
    mat4.fromAxisAngle(out, AXES[third], degToRad(degrees[third]));
    mat4.fromAxisAngle(axisStep, AXES[second], degToRad(degrees[second]));
    mat4.multiply(out, out, axisStep);
    mat4.fromAxisAngle(axisStep, AXES[first], degToRad(degrees[first]));
    return mat4.multiply(out, out, axisStep);
}
function appendTranslation(out: Mat4, x: number, y: number, z: number): void {
    if (x === 0 && y === 0 && z === 0)
        return;
    mat4.fromTranslationRotationScale(step, vec3.set(offset, x, y, z), ZERO, ONE);
    mat4.multiply(out, out, step);
}
export function readFbxLocalTransform(out: Mat4, properties: FbxProperties): FbxLocalTransform {
    properties.vector3(translation, 'Lcl Translation', ZERO);
    properties.vector3(rotation, 'Lcl Rotation', ZERO);
    properties.vector3(scaling, 'Lcl Scaling', ONE);
    properties.vector3(preRotation, 'PreRotation', ZERO);
    properties.vector3(postRotation, 'PostRotation', ZERO);
    properties.vector3(rotationOffset, 'RotationOffset', ZERO);
    properties.vector3(rotationPivot, 'RotationPivot', ZERO);
    properties.vector3(scalingOffset, 'ScalingOffset', ZERO);
    properties.vector3(scalingPivot, 'ScalingPivot', ZERO);
    const order = properties.number('RotationOrder', 0);
    const approximatedRotationOrder = order < 0 || order >= ROTATION_ORDERS.length;
    mat4.identity(out);
    appendTranslation(out, translation[0] + rotationOffset[0] + rotationPivot[0], translation[1] + rotationOffset[1] + rotationPivot[1], translation[2] + rotationOffset[2] + rotationPivot[2]);
    if (preRotation[0] || preRotation[1] || preRotation[2])
        mat4.multiply(out, out, eulerMatrix(step, preRotation, order));
    if (rotation[0] || rotation[1] || rotation[2])
        mat4.multiply(out, out, eulerMatrix(step, rotation, order));
    if (postRotation[0] || postRotation[1] || postRotation[2]) {
        eulerMatrix(step, postRotation, order);
        if (mat4.invert(step, step))
            mat4.multiply(out, out, step);
    }
    appendTranslation(out, -rotationPivot[0] + scalingOffset[0] + scalingPivot[0], -rotationPivot[1] + scalingOffset[1] + scalingPivot[1], -rotationPivot[2] + scalingOffset[2] + scalingPivot[2]);
    if (scaling[0] !== 1 || scaling[1] !== 1 || scaling[2] !== 1) {
        mat4.fromTranslationRotationScale(step, ZERO, ZERO, scaling);
        mat4.multiply(out, out, step);
    }
    appendTranslation(out, -scalingPivot[0], -scalingPivot[1], -scalingPivot[2]);
    return { matrix: out, approximatedRotationOrder };
}
export function readFbxGeometricTransform(out: Mat4, properties: FbxProperties): Mat4 | null {
    properties.vector3(translation, 'GeometricTranslation', ZERO);
    properties.vector3(rotation, 'GeometricRotation', ZERO);
    properties.vector3(scaling, 'GeometricScaling', ONE);
    const identity = !translation[0] && !translation[1] && !translation[2] &&
        !rotation[0] && !rotation[1] && !rotation[2] &&
        scaling[0] === 1 && scaling[1] === 1 && scaling[2] === 1;
    if (identity)
        return null;
    return mat4.fromTranslationRotationScale(out, translation, rotation, scaling);
}
