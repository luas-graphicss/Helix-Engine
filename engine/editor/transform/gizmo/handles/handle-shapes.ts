import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import { nextAxis, previousAxis, type AxisIndex, type GizmoFrame } from '../gizmo-frame';
import type { GizmoHandle } from '../gizmo-handle';
export const SEGMENT_PRIORITY = 1;
export const PLANE_PRIORITY = 2;
export const POINT_PRIORITY = 3;
const AXIS_EDGE_ON_ALIGNMENT = 0.985;
const PLANE_EDGE_ON_ALIGNMENT = 0.14;
const QUAD_CORNERS: readonly (readonly [boolean, boolean])[] = [[false, false], [true, false], [true, true], [false, true]];
export function isAxisEdgeOn(axis: Vec3, toCamera: Vec3): boolean {
    return Math.abs(vec3.dot(axis, toCamera)) > AXIS_EDGE_ON_ALIGNMENT;
}
export function isPlaneEdgeOn(normal: Vec3, toCamera: Vec3): boolean {
    return Math.abs(vec3.dot(normal, toCamera)) < PLANE_EDGE_ON_ALIGNMENT;
}
export function placeAxisSegment(handle: GizmoHandle, frame: GizmoFrame, axis: AxisIndex, start: number, end: number): void {
    const [from, to, sideU, sideV] = handle.points;
    vec3.scaleAndAdd(from, frame.origin, frame.axes[axis], start * frame.size);
    vec3.scaleAndAdd(to, frame.origin, frame.axes[axis], end * frame.size);
    vec3.copy(sideU, frame.axes[nextAxis(axis)]);
    vec3.copy(sideV, frame.axes[previousAxis(axis)]);
}
export function placePlaneQuad(handle: GizmoHandle, frame: GizmoFrame, normal: AxisIndex, near: number, far: number): void {
    const alongU = frame.axes[nextAxis(normal)];
    const alongV = frame.axes[previousAxis(normal)];
    for (let index = 0; index < QUAD_CORNERS.length; index++) {
        const corner = handle.points[index];
        vec3.scaleAndAdd(corner, frame.origin, alongU, (QUAD_CORNERS[index][0] ? far : near) * frame.size);
        vec3.scaleAndAdd(corner, corner, alongV, (QUAD_CORNERS[index][1] ? far : near) * frame.size);
    }
}
export function placeOrientedPoint(handle: GizmoHandle, frame: GizmoFrame, center: Vec3, radius: number): void {
    vec3.copy(handle.points[0], center);
    vec3.copy(handle.points[1], frame.axes[0]);
    vec3.copy(handle.points[2], frame.axes[1]);
    handle.radius = radius * frame.size;
}
