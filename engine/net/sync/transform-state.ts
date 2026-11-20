import type { QuaternionTuple } from '../wire/quantize';
export type Vector3Tuple = [
    number,
    number,
    number
];
export interface TransformState {
    readonly position: Vector3Tuple;
    readonly rotation: QuaternionTuple;
    readonly scale: Vector3Tuple;
}
const POSITION_EPSILON = 1e-4;
const ROTATION_EPSILON = 1e-5;
const SCALE_EPSILON = 1e-4;
const NEARLY_PARALLEL = 0.9995;
export function createTransformState(): TransformState {
    return { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] };
}
export function copyTransformState(target: TransformState, source: TransformState): void {
    for (let axis = 0; axis < 3; axis++) {
        target.position[axis] = source.position[axis];
        target.scale[axis] = source.scale[axis];
    }
    for (let component = 0; component < 4; component++)
        target.rotation[component] = source.rotation[component];
}
export function cloneTransformState(source: TransformState): TransformState {
    const clone = createTransformState();
    copyTransformState(clone, source);
    return clone;
}
export function distanceSquared(a: ArrayLike<number>, b: ArrayLike<number>): number {
    const x = a[0] - b[0];
    const y = a[1] - b[1];
    const z = a[2] - b[2];
    return x * x + y * y + z * z;
}
function differs(a: ArrayLike<number>, b: ArrayLike<number>, count: number, epsilon: number): boolean {
    for (let index = 0; index < count; index++)
        if (Math.abs(a[index] - b[index]) > epsilon)
            return true;
    return false;
}
export function transformDiffers(a: TransformState, b: TransformState, compareScale: boolean): boolean {
    if (differs(a.position, b.position, 3, POSITION_EPSILON))
        return true;
    const alignment = Math.abs(a.rotation[0] * b.rotation[0] + a.rotation[1] * b.rotation[1] + a.rotation[2] * b.rotation[2] + a.rotation[3] * b.rotation[3]);
    if (1 - alignment > ROTATION_EPSILON)
        return true;
    return compareScale && differs(a.scale, b.scale, 3, SCALE_EPSILON);
}
function interpolateRotation(target: QuaternionTuple, from: QuaternionTuple, to: QuaternionTuple, ratio: number): void {
    let dot = from[0] * to[0] + from[1] * to[1] + from[2] * to[2] + from[3] * to[3];
    const direction = dot < 0 ? -1 : 1;
    dot *= direction;
    let fromWeight = 1 - ratio;
    let toWeight = ratio;
    if (dot < NEARLY_PARALLEL) {
        const angle = Math.acos(dot);
        const sine = Math.sin(angle);
        fromWeight = Math.sin((1 - ratio) * angle) / sine;
        toWeight = Math.sin(ratio * angle) / sine;
    }
    let lengthSquared = 0;
    for (let component = 0; component < 4; component++) {
        target[component] = from[component] * fromWeight + to[component] * direction * toWeight;
        lengthSquared += target[component] * target[component];
    }
    const length = Math.sqrt(lengthSquared) || 1;
    for (let component = 0; component < 4; component++)
        target[component] /= length;
}
export function interpolateTransform(target: TransformState, from: TransformState, to: TransformState, ratio: number): void {
    for (let axis = 0; axis < 3; axis++) {
        target.position[axis] = from.position[axis] + (to.position[axis] - from.position[axis]) * ratio;
        target.scale[axis] = from.scale[axis] + (to.scale[axis] - from.scale[axis]) * ratio;
    }
    interpolateRotation(target.rotation, from.rotation, to.rotation, ratio);
}
