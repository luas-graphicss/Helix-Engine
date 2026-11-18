import type { Vec3 } from '@/engine/core/math/vec3';
import type { GizmoFrame } from '../gizmo-frame';
import type { GizmoLayout, HandleAction } from '../gizmo-handle';
import { placeOrientedPoint, POINT_PRIORITY } from './handle-shapes';
export const VERTEX_GRIP_ID = 'snap.vertex';
const GRIP_ACTION: HandleAction = { kind: 'translateVertex' };
const GRIP_PRIORITY = POINT_PRIORITY + 1;
const GRIP_RADIUS = 0.04;
export function addVertexGrip(layout: GizmoLayout, frame: GizmoFrame, vertex: Vec3): void {
    placeOrientedPoint(layout.add(VERTEX_GRIP_ID, 'cube', 'accent', GRIP_ACTION, GRIP_PRIORITY), frame, vertex, GRIP_RADIUS);
}
