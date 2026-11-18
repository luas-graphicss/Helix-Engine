import * as vec3 from '@/engine/core/math/vec3';
import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import { AXIS_INDICES, type GizmoFrame } from '../gizmo-frame';
import type { GizmoLayout, HandleAction } from '../gizmo-handle';
import { directionToCamera } from '../view-basis';
import { isAxisEdgeOn, isPlaneEdgeOn, placeAxisSegment, placeOrientedPoint, placePlaneQuad, PLANE_PRIORITY, POINT_PRIORITY, SEGMENT_PRIORITY } from './handle-shapes';
const AXIS_IDS: readonly string[] = ['scale.x', 'scale.y', 'scale.z'];
const PLANE_IDS: readonly string[] = ['scale.yz', 'scale.xz', 'scale.xy'];
const UNIFORM_ID = 'scale.uniform';
const AXIS_ACTIONS = AXIS_INDICES.map<HandleAction>((axis) => ({ kind: 'scaleAxis', axis }));
const PLANE_ACTIONS = AXIS_INDICES.map<HandleAction>((normal) => ({ kind: 'scalePlane', normal }));
const UNIFORM_ACTION: HandleAction = { kind: 'scaleUniform' };
const AXIS_START = 0.16;
const AXIS_END = 0.92;
const PLANE_NEAR = 0.28;
const PLANE_FAR = 0.5;
const CENTER_RADIUS = 0.075;
const toCamera = vec3.create();
export function addScaleHandles(layout: GizmoLayout, frame: GizmoFrame, camera: PerspectiveCamera): void {
    directionToCamera(toCamera, camera, frame.origin);
    for (const normal of AXIS_INDICES) {
        if (!isPlaneEdgeOn(frame.axes[normal], toCamera))
            placePlaneQuad(layout.add(PLANE_IDS[normal], 'fill', normal, PLANE_ACTIONS[normal], PLANE_PRIORITY), frame, normal, PLANE_NEAR, PLANE_FAR);
    }
    for (const axis of AXIS_INDICES) {
        if (!isAxisEdgeOn(frame.axes[axis], toCamera))
            placeAxisSegment(layout.add(AXIS_IDS[axis], 'stem', axis, AXIS_ACTIONS[axis], SEGMENT_PRIORITY), frame, axis, AXIS_START, AXIS_END);
    }
    placeOrientedPoint(layout.add(UNIFORM_ID, 'cube', 'neutral', UNIFORM_ACTION, POINT_PRIORITY), frame, frame.origin, CENTER_RADIUS);
}
