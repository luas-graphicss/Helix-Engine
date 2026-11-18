import * as vec3 from '@/engine/core/math/vec3';
import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import type { GizmoFrame } from '../gizmo-frame';
import type { GizmoLayout } from '../gizmo-handle';
import { directionToCamera } from '../view-basis';
import { addMoveArrows } from './move-handles';
import { addAxisRings } from './rotate-handles';
import { addUniformScaleCube } from './scale-handles';
const ARROW_END = 1;
const RING_RADIUS = 0.66;
const toCamera = vec3.create();
export function addTransformHandles(layout: GizmoLayout, frame: GizmoFrame, camera: PerspectiveCamera): void {
    directionToCamera(toCamera, camera, frame.origin);
    addAxisRings(layout, frame, RING_RADIUS);
    addMoveArrows(layout, frame, toCamera, ARROW_END);
    addUniformScaleCube(layout, frame);
}
