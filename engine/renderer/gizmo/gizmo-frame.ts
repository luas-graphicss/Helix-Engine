import * as mat4 from '@/engine/core/math/mat4';
import * as vec3 from '@/engine/core/math/vec3';
import type { Mat4 } from '@/engine/core/math/mat4';
import type { Vec3 } from '@/engine/core/math/vec3';
import { degToRad } from '@/engine/core/math/scalar';
import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
export type GizmoMode = 'translate' | 'rotate' | 'scale';
export type GizmoAxisHandle = 'x' | 'y' | 'z';
export type GizmoPlaneHandle = 'xy' | 'yz' | 'xz';
export type GizmoHandle = GizmoAxisHandle | GizmoPlaneHandle | 'uniform';
export const AXIS_INDEX: Record<GizmoAxisHandle, 0 | 1 | 2> = { x: 0, y: 1, z: 2 };
export const PLANE_AXES: Record<GizmoPlaneHandle, readonly [
    0 | 1 | 2,
    0 | 1 | 2
]> = { xy: [0, 1], yz: [1, 2], xz: [0, 2] };
export const GIZMO_SCREEN_FRACTION = 0.17;
export interface GizmoFrame {
    origin: Vec3;
    axes: [
        Vec3,
        Vec3,
        Vec3
    ];
    size: number;
    model: Mat4;
}
export function createGizmoFrame(): GizmoFrame {
    return { origin: vec3.create(), axes: [vec3.create(), vec3.create(), vec3.create()], size: 1, model: mat4.create() };
}
export function copyGizmoFrame(out: GizmoFrame, frame: GizmoFrame): GizmoFrame {
    vec3.copy(out.origin, frame.origin);
    for (let i = 0; i < 3; i++)
        vec3.copy(out.axes[i], frame.axes[i]);
    out.size = frame.size;
    mat4.copy(out.model, frame.model);
    return out;
}
const forward = vec3.create();
const toOrigin = vec3.create();
export function computeGizmoFrame(out: GizmoFrame, worldMatrix: Mat4, camera: PerspectiveCamera, localAxes: boolean): boolean {
    mat4.getTranslation(out.origin, worldMatrix);
    vec3.subtract(forward, camera.target, camera.position);
    vec3.normalize(forward, forward);
    vec3.subtract(toOrigin, out.origin, camera.position);
    const depth = vec3.dot(toOrigin, forward);
    if (depth <= camera.near)
        return false;
    out.size = depth * Math.tan(degToRad(camera.fovDegrees) / 2) * 2 * GIZMO_SCREEN_FRACTION;
    for (let i = 0; i < 3; i++) {
        const axis = out.axes[i];
        vec3.set(axis, i === 0 ? 1 : 0, i === 1 ? 1 : 0, i === 2 ? 1 : 0);
        if (!localAxes)
            continue;
        const column = i * 4;
        const length = Math.hypot(worldMatrix[column], worldMatrix[column + 1], worldMatrix[column + 2]);
        if (length < 1e-6)
            continue;
        vec3.set(axis, worldMatrix[column] / length, worldMatrix[column + 1] / length, worldMatrix[column + 2] / length);
    }
    const model = out.model;
    for (let i = 0; i < 3; i++) {
        const axis = out.axes[i];
        model[i * 4] = axis[0] * out.size;
        model[i * 4 + 1] = axis[1] * out.size;
        model[i * 4 + 2] = axis[2] * out.size;
        model[i * 4 + 3] = 0;
    }
    model[12] = out.origin[0];
    model[13] = out.origin[1];
    model[14] = out.origin[2];
    model[15] = 1;
    return true;
}
