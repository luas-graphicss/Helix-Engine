import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import { AXIS_INDICES, type GizmoFrame } from '../gizmo-frame';
import type { GizmoLayout, HandleAction } from '../gizmo-handle';
import { directionToCamera } from '../view-basis';
import { isAxisEdgeOn, isPlaneEdgeOn, placeAxisSegment, placeOrientedPoint, placePlaneQuad, PLANE_PRIORITY, POINT_PRIORITY, SEGMENT_PRIORITY } from './handle-shapes';
const AXIS_IDS: readonly string[] = ['move.x', 'move.y', 'move.z'];
const PLANE_IDS: readonly string[] = ['move.yz', 'move.xz', 'move.xy'];
const VIEW_ID = 'move.view';
const AXIS_ACTIONS = AXIS_INDICES.map<HandleAction>((axis) => ({ kind: 'translateAxis', axis }));
const PLANE_ACTIONS = AXIS_INDICES.map<HandleAction>((normal) => ({ kind: 'translatePlane', normal }));
const VIEW_ACTION: HandleAction = { kind: 'translateView' };
const AXIS_START = 0.16;
const AXIS_END = 1;
const PLANE_NEAR = 0.28;
const PLANE_FAR = 0.5;
const CENTER_RADIUS = 0.07;
const toCamera = vec3.create();
export function addMovePlanes(layout: GizmoLayout, frame: GizmoFrame, towardCamera: Vec3, near: number, far: number): void {
    for (const normal of AXIS_INDICES) {
        if (!isPlaneEdgeOn(frame.axes[normal], towardCamera))
            placePlaneQuad(layout.add(PLANE_IDS[normal], 'fill', normal, PLANE_ACTIONS[normal], PLANE_PRIORITY), frame, normal, near, far);
    }
}
export function addMoveArrows(layout: GizmoLayout, frame: GizmoFrame, towardCamera: Vec3, end: number): void {
    for (const axis of AXIS_INDICES) {
        if (!isAxisEdgeOn(frame.axes[axis], towardCamera))
            placeAxisSegment(layout.add(AXIS_IDS[axis], 'arrow', axis, AXIS_ACTIONS[axis], SEGMENT_PRIORITY), frame, axis, AXIS_START, end);
    }
}
export function addMoveHandles(layout: GizmoLayout, frame: GizmoFrame, camera: PerspectiveCamera): void {
    directionToCamera(toCamera, camera, frame.origin);
    addMovePlanes(layout, frame, toCamera, PLANE_NEAR, PLANE_FAR);
    addMoveArrows(layout, frame, toCamera, AXIS_END);
    placeOrientedPoint(layout.add(VIEW_ID, 'disc', 'neutral', VIEW_ACTION, POINT_PRIORITY), frame, frame.origin, CENTER_RADIUS);
}
