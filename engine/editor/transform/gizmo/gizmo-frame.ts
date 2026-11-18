import { degToRad } from '@/engine/core/math/scalar';
import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
export type AxisIndex = 0 | 1 | 2;
export type GizmoAxes = readonly [Vec3, Vec3, Vec3];
export interface GizmoFrame {
    readonly origin: Vec3;
    readonly axes: GizmoAxes;
    size: number;
}
export const AXIS_INDICES: readonly AxisIndex[] = [0, 1, 2];
export const AXIS_LABELS: readonly string[] = ['X', 'Y', 'Z'];
const GIZMO_SCREEN_FRACTION = 0.17;
const forward = vec3.create();
const toOrigin = vec3.create();
export function createGizmoAxes(): GizmoAxes {
    return [vec3.create(1, 0, 0), vec3.create(0, 1, 0), vec3.create(0, 0, 1)];
}
export function copyGizmoAxes(out: GizmoAxes, axes: GizmoAxes): GizmoAxes {
    for (const axis of AXIS_INDICES)
        vec3.copy(out[axis], axes[axis]);
    return out;
}
export function createGizmoFrame(): GizmoFrame {
    return { origin: vec3.create(), axes: createGizmoAxes(), size: 1 };
}
export function copyGizmoFrame(out: GizmoFrame, frame: GizmoFrame): GizmoFrame {
    vec3.copy(out.origin, frame.origin);
    copyGizmoAxes(out.axes, frame.axes);
    out.size = frame.size;
    return out;
}
export function nextAxis(axis: AxisIndex): AxisIndex {
    return ((axis + 1) % 3) as AxisIndex;
}
export function previousAxis(axis: AxisIndex): AxisIndex {
    return ((axis + 2) % 3) as AxisIndex;
}
export function gizmoSizeAt(origin: Vec3, camera: PerspectiveCamera, scale: number): number | null {
    vec3.subtract(forward, camera.target, camera.position);
    vec3.normalize(forward, forward);
    vec3.subtract(toOrigin, origin, camera.position);
    const depth = vec3.dot(toOrigin, forward);
    if (depth <= camera.near)
        return null;
    return depth * Math.tan(degToRad(camera.fovDegrees) / 2) * 2 * GIZMO_SCREEN_FRACTION * scale;
}
