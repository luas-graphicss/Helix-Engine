import * as vec3 from '@/engine/core/math/vec3';
import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import type { GizmoFrame } from '../gizmo-frame';
import type { GizmoLayout } from '../gizmo-handle';
import { directionToCamera } from '../view-basis';
import { addMoveArrows, addMovePlanes } from './move-handles';
import { addAxisRings, addViewRing } from './rotate-handles';
import { addScaleTips, addUniformScaleCube } from './scale-handles';
const PLANE_NEAR = 0.2;
const PLANE_FAR = 0.36;
const ARROW_END = 0.86;
const RING_RADIUS = 0.66;
const VIEW_RING_RADIUS = 1.3;
const SCALE_TIP_DISTANCE = 1.08;
const toCamera = vec3.create();
export function addUniversalHandles(layout: GizmoLayout, frame: GizmoFrame, camera: PerspectiveCamera): void {
    directionToCamera(toCamera, camera, frame.origin);
    addViewRing(layout, frame, camera, VIEW_RING_RADIUS);
    addAxisRings(layout, frame, RING_RADIUS);
    addMovePlanes(layout, frame, toCamera, PLANE_NEAR, PLANE_FAR);
    addMoveArrows(layout, frame, toCamera, ARROW_END);
    addScaleTips(layout, frame, toCamera, SCALE_TIP_DISTANCE);
    addUniformScaleCube(layout, frame);
}
