import * as quat from '@/engine/core/math/quat';
import type { AnimationPath } from '@/engine/core/animation/animation-document';
import type { Entity } from '@/engine/core/scene/entity';
import type { TransformSnapshot } from '@/engine/editor/operations/transform-operations';
export function pathComponents(path: AnimationPath): 3 | 4 {
    return path === 'rotation' ? 4 : 3;
}
export function readJointPath(joint: Entity, path: AnimationPath, out = new Float32Array(pathComponents(path))): Float32Array {
    const { transform } = joint;
    switch (path) {
        case 'translation':
            out.set(transform.position);
            break;
        case 'rotation':
            quat.fromEulerDegrees(out, transform.rotation);
            break;
        case 'scale':
            out.set(transform.scale);
            break;
    }
    return out;
}
export function readSnapshotPath(snapshot: TransformSnapshot, path: AnimationPath, out = new Float32Array(pathComponents(path))): Float32Array {
    switch (path) {
        case 'translation':
            out.set(snapshot.position);
            break;
        case 'rotation':
            quat.fromEulerDegrees(out, snapshot.rotation);
            break;
        case 'scale':
            out.set(snapshot.scale);
            break;
    }
    return out;
}
export function writeJointPath(joint: Entity, path: AnimationPath, value: Float32Array): void {
    const { transform } = joint;
    switch (path) {
        case 'translation':
            transform.position.set(value.subarray(0, 3));
            break;
        case 'rotation':
            quat.toEulerDegrees(transform.rotation, value);
            break;
        case 'scale':
            transform.scale.set(value.subarray(0, 3));
            break;
    }
}
export function changedPaths(before: TransformSnapshot, after: TransformSnapshot, epsilon = 1e-5): AnimationPath[] {
    const differs = (a: Float32Array, b: Float32Array) => a.some((value, index) => Math.abs(value - b[index]) > epsilon);
    const paths: AnimationPath[] = [];
    if (differs(before.position, after.position))
        paths.push('translation');
    if (differs(before.rotation, after.rotation))
        paths.push('rotation');
    if (differs(before.scale, after.scale))
        paths.push('scale');
    return paths;
}
