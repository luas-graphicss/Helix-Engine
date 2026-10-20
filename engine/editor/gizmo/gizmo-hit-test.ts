import * as vec3 from '@/engine/core/math/vec3';
import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import { AXIS_INDEX, PLANE_AXES, type GizmoAxisHandle, type GizmoFrame, type GizmoHandle, type GizmoMode, type GizmoPlaneHandle, } from '@/engine/renderer/gizmo/gizmo-frame';
import { GIZMO_AXIS_START, GIZMO_PLANE_MAX, GIZMO_PLANE_MIN, GIZMO_RING_RADIUS } from '@/engine/renderer/geometry/gizmo-geometry';
import { createScreenPoint, distanceToSegment2D, pointInConvexQuad2D, projectToScreen } from './screen-space';
const AXIS_TOLERANCE_PX = 9;
const RING_TOLERANCE_PX = 8;
const CENTER_RADIUS_PX = 11;
const RING_SAMPLES = 64;
const AXES: readonly GizmoAxisHandle[] = ['x', 'y', 'z'];
const PLANES: readonly GizmoPlaneHandle[] = ['xy', 'yz', 'xz'];
const PLANE_CORNERS: readonly (readonly [
    number,
    number
])[] = [
    [GIZMO_PLANE_MIN, GIZMO_PLANE_MIN],
    [GIZMO_PLANE_MAX, GIZMO_PLANE_MIN],
    [GIZMO_PLANE_MAX, GIZMO_PLANE_MAX],
    [GIZMO_PLANE_MIN, GIZMO_PLANE_MAX],
];
const worldPoint = vec3.create();
const screenA = createScreenPoint();
const screenB = createScreenPoint();
const quad = new Float32Array(8);
export interface ViewportSize {
    width: number;
    height: number;
}
export function hitTestGizmo(mode: GizmoMode, frame: GizmoFrame, camera: PerspectiveCamera, px: number, py: number, viewport: ViewportSize): GizmoHandle | null {
    if (!camera.invertible)
        return null;
    if (mode === 'translate') {
        for (const plane of PLANES) {
            if (hitPlane(plane, frame, camera, px, py, viewport))
                return plane;
        }
    }
    if (mode === 'scale' && projectToScreen(screenA, camera.viewProjectionMatrix, frame.origin, viewport.width, viewport.height)) {
        if (Math.hypot(px - screenA[0], py - screenA[1]) <= CENTER_RADIUS_PX)
            return 'uniform';
    }
    let best: GizmoHandle | null = null;
    let bestDistance = mode === 'rotate' ? RING_TOLERANCE_PX : AXIS_TOLERANCE_PX;
    for (const axis of AXES) {
        const distance = mode === 'rotate' ? ringDistance(axis, frame, camera, px, py, viewport) : axisDistance(axis, frame, camera, px, py, viewport);
        if (distance <= bestDistance) {
            bestDistance = distance;
            best = axis;
        }
    }
    return best;
}
function axisDistance(handle: GizmoAxisHandle, frame: GizmoFrame, camera: PerspectiveCamera, px: number, py: number, viewport: ViewportSize): number {
    const axis = frame.axes[AXIS_INDEX[handle]];
    vec3.scaleAndAdd(worldPoint, frame.origin, axis, frame.size * GIZMO_AXIS_START);
    if (!projectToScreen(screenA, camera.viewProjectionMatrix, worldPoint, viewport.width, viewport.height))
        return Infinity;
    vec3.scaleAndAdd(worldPoint, frame.origin, axis, frame.size);
    if (!projectToScreen(screenB, camera.viewProjectionMatrix, worldPoint, viewport.width, viewport.height))
        return Infinity;
    return distanceToSegment2D(px, py, screenA[0], screenA[1], screenB[0], screenB[1]);
}
function hitPlane(handle: GizmoPlaneHandle, frame: GizmoFrame, camera: PerspectiveCamera, px: number, py: number, viewport: ViewportSize): boolean {
    const [i, j] = PLANE_AXES[handle];
    for (let corner = 0; corner < 4; corner++) {
        const [s, t] = PLANE_CORNERS[corner];
        vec3.scaleAndAdd(worldPoint, frame.origin, frame.axes[i], frame.size * s);
        vec3.scaleAndAdd(worldPoint, worldPoint, frame.axes[j], frame.size * t);
        if (!projectToScreen(screenA, camera.viewProjectionMatrix, worldPoint, viewport.width, viewport.height))
            return false;
        quad[corner * 2] = screenA[0];
        quad[corner * 2 + 1] = screenA[1];
    }
    return pointInConvexQuad2D(px, py, quad);
}
function ringDistance(handle: GizmoAxisHandle, frame: GizmoFrame, camera: PerspectiveCamera, px: number, py: number, viewport: ViewportSize): number {
    const normalIndex = AXIS_INDEX[handle];
    const u = frame.axes[(normalIndex + 1) % 3];
    const v = frame.axes[(normalIndex + 2) % 3];
    const radius = frame.size * GIZMO_RING_RADIUS;
    let best = Infinity;
    let hasPrevious = false;
    for (let sample = 0; sample <= RING_SAMPLES; sample++) {
        const theta = (sample / RING_SAMPLES) * Math.PI * 2;
        vec3.scaleAndAdd(worldPoint, frame.origin, u, Math.cos(theta) * radius);
        vec3.scaleAndAdd(worldPoint, worldPoint, v, Math.sin(theta) * radius);
        const projected = projectToScreen(screenB, camera.viewProjectionMatrix, worldPoint, viewport.width, viewport.height);
        if (projected && hasPrevious) {
            best = Math.min(best, distanceToSegment2D(px, py, screenA[0], screenA[1], screenB[0], screenB[1]));
        }
        hasPrevious = projected;
        screenA[0] = screenB[0];
        screenA[1] = screenB[1];
    }
    return best;
}
