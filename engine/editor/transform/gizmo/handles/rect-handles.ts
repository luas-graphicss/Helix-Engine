import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import { computeOrientedBounds, createOrientedBounds } from '../../selection/selection-bounds';
import type { TransformTargets } from '../../selection/transform-targets';
import { AXIS_INDICES, nextAxis, previousAxis, type AxisIndex, type GizmoFrame } from '../gizmo-frame';
import type { GizmoHandle, GizmoLayout } from '../gizmo-handle';
import { directionToCamera } from '../view-basis';
import { POINT_PRIORITY, SEGMENT_PRIORITY } from './handle-shapes';
import { addMoveHandles } from './move-handles';
type Side = -1 | 1;
interface RectCorner {
    readonly id: string;
    readonly u: Side;
    readonly v: Side;
}
interface RectEdge {
    readonly id: string;
    readonly across: 'u' | 'v';
    readonly side: Side;
}
interface RectShape {
    readonly center: Vec3;
    readonly alongU: Vec3;
    readonly alongV: Vec3;
    halfU: number;
    halfV: number;
}
const AREA_ID = 'rect.area';
const ROTATE_ID = 'rect.rotate';
const ROTATE_STEM_ID = 'rect.rotate.stem';
const PIVOT_ID = 'rect.pivot';
const CORNERS: readonly RectCorner[] = [
    { id: 'rect.bottomLeft', u: -1, v: -1 },
    { id: 'rect.bottomRight', u: 1, v: -1 },
    { id: 'rect.topRight', u: 1, v: 1 },
    { id: 'rect.topLeft', u: -1, v: 1 },
];
const EDGES: readonly RectEdge[] = [
    { id: 'rect.left', across: 'u', side: -1 },
    { id: 'rect.right', across: 'u', side: 1 },
    { id: 'rect.bottom', across: 'v', side: -1 },
    { id: 'rect.top', across: 'v', side: 1 },
];
const AREA_PRIORITY = 0;
const MIN_HALF_EXTENT = 1e-4;
const CORNER_RADIUS = 0.045;
const ROTATE_KNOB_RADIUS = 0.05;
const ROTATE_REACH = 0.3;
const PIVOT_RADIUS = 0.03;
const bounds = createOrientedBounds();
const toCamera = vec3.create();
const shape: RectShape = { center: vec3.create(), alongU: vec3.create(), alongV: vec3.create(), halfU: 0, halfV: 0 };
function facingAxis(frame: GizmoFrame, towardCamera: Vec3): AxisIndex {
    let facing: AxisIndex = 0;
    let alignment = -1;
    for (const axis of AXIS_INDICES) {
        const candidate = Math.abs(vec3.dot(frame.axes[axis], towardCamera));
        if (candidate > alignment) {
            alignment = candidate;
            facing = axis;
        }
    }
    return facing;
}
function rectPoint(out: Vec3, u: number, v: number): Vec3 {
    vec3.scaleAndAdd(out, shape.center, shape.alongU, u * shape.halfU);
    return vec3.scaleAndAdd(out, out, shape.alongV, v * shape.halfV);
}
function addArea(layout: GizmoLayout, normal: AxisIndex): void {
    const area = layout.add(AREA_ID, 'area', 'neutral', { kind: 'translatePlane', normal }, AREA_PRIORITY);
    CORNERS.forEach((corner, index) => rectPoint(area.points[index], corner.u, corner.v));
}
function addEdges(layout: GizmoLayout, normal: AxisIndex): void {
    for (const edge of EDGES) {
        const acrossU = edge.across === 'u';
        const axis = acrossU ? nextAxis(normal) : previousAxis(normal);
        const handle = layout.add(edge.id, 'line', 'neutral', { kind: 'rectEdge', normal, axis }, SEGMENT_PRIORITY);
        rectPoint(handle.points[0], acrossU ? edge.side : -1, acrossU ? -1 : edge.side);
        rectPoint(handle.points[1], acrossU ? edge.side : 1, acrossU ? 1 : edge.side);
        rectPoint(handle.points[2], acrossU ? edge.side : 0, acrossU ? 0 : edge.side);
        rectPoint(handle.points[3], acrossU ? -edge.side : 0, acrossU ? 0 : -edge.side);
    }
}
function addCorners(layout: GizmoLayout, frame: GizmoFrame, normal: AxisIndex): void {
    for (const corner of CORNERS) {
        const handle = layout.add(corner.id, 'disc', 'neutral', { kind: 'rectCorner', normal }, POINT_PRIORITY);
        rectPoint(handle.points[0], corner.u, corner.v);
        vec3.copy(handle.points[2], handle.points[0]);
        rectPoint(handle.points[3], -corner.u, -corner.v);
        handle.radius = CORNER_RADIUS * frame.size;
    }
}
function addRotateKnob(layout: GizmoLayout, frame: GizmoFrame, normal: AxisIndex): void {
    const stem = layout.add(ROTATE_STEM_ID, 'line', 'neutral');
    rectPoint(stem.points[0], 0, 1);
    vec3.scaleAndAdd(stem.points[1], stem.points[0], shape.alongV, ROTATE_REACH * frame.size);
    const knob = layout.add(ROTATE_ID, 'disc', 'neutral', { kind: 'rectRotate', normal }, POINT_PRIORITY);
    vec3.copy(knob.points[0], stem.points[1]);
    knob.radius = ROTATE_KNOB_RADIUS * frame.size;
}
function addPivotMark(layout: GizmoLayout, frame: GizmoFrame): void {
    const pivot = layout.add(PIVOT_ID, 'disc', 'accent');
    vec3.copy(pivot.points[0], frame.origin);
    pivot.radius = PIVOT_RADIUS * frame.size;
}
export function rectGrabPoint(handle: GizmoHandle): Vec3 {
    return handle.points[2];
}
export function rectAnchor(handle: GizmoHandle): Vec3 {
    return handle.points[3];
}
export function addRectHandles(layout: GizmoLayout, frame: GizmoFrame, camera: PerspectiveCamera, targets: TransformTargets): void {
    if (!computeOrientedBounds(bounds, targets.entities, frame.origin, frame.axes)) {
        addMoveHandles(layout, frame, camera);
        return;
    }
    directionToCamera(toCamera, camera, bounds.center);
    const normal = facingAxis(frame, toCamera);
    const uAxis = nextAxis(normal);
    const vAxis = previousAxis(normal);
    vec3.copy(shape.center, bounds.center);
    vec3.copy(shape.alongU, frame.axes[uAxis]);
    vec3.copy(shape.alongV, frame.axes[vAxis]);
    shape.halfU = Math.max(bounds.halfExtents[uAxis], MIN_HALF_EXTENT);
    shape.halfV = Math.max(bounds.halfExtents[vAxis], MIN_HALF_EXTENT);
    addArea(layout, normal);
    addEdges(layout, normal);
    addRotateKnob(layout, frame, normal);
    addCorners(layout, frame, normal);
    addPivotMark(layout, frame);
}
