import * as vec3 from '@/engine/core/math/vec3';
import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import { AXIS_INDICES, nextAxis, previousAxis, type GizmoFrame } from '../gizmo-frame';
import type { GizmoLayout, HandleAction } from '../gizmo-handle';
import { cameraRight, cameraUp } from '../view-basis';
import { SEGMENT_PRIORITY } from './handle-shapes';
const AXIS_IDS: readonly string[] = ['rotate.x', 'rotate.y', 'rotate.z'];
const VIEW_ID = 'rotate.view';
const AXIS_ACTIONS = AXIS_INDICES.map<HandleAction>((axis) => ({ kind: 'rotateAxis', axis }));
const VIEW_ACTION: HandleAction = { kind: 'rotateView' };
const AXIS_RING_RADIUS = 1;
const VIEW_RING_RADIUS = 1.16;
export function addViewRing(layout: GizmoLayout, frame: GizmoFrame, camera: PerspectiveCamera, radius: number): void {
    const view = layout.add(VIEW_ID, 'ring', 'neutral', VIEW_ACTION, SEGMENT_PRIORITY);
    vec3.copy(view.points[0], frame.origin);
    cameraRight(view.points[1], camera);
    cameraUp(view.points[2], camera);
    view.radius = radius * frame.size;
}
export function addAxisRings(layout: GizmoLayout, frame: GizmoFrame, radius: number): void {
    for (const axis of AXIS_INDICES) {
        const ring = layout.add(AXIS_IDS[axis], 'ring', axis, AXIS_ACTIONS[axis], SEGMENT_PRIORITY);
        vec3.copy(ring.points[0], frame.origin);
        vec3.copy(ring.points[1], frame.axes[nextAxis(axis)]);
        vec3.copy(ring.points[2], frame.axes[previousAxis(axis)]);
        ring.radius = radius * frame.size;
        ring.frontOnly = true;
    }
}
export function addRotateHandles(layout: GizmoLayout, frame: GizmoFrame, camera: PerspectiveCamera): void {
    addViewRing(layout, frame, camera, VIEW_RING_RADIUS);
    addAxisRings(layout, frame, AXIS_RING_RADIUS);
}
