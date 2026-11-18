import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import { FULL_SWEEP, type GizmoDrawItem, type GizmoDrawList } from '@/engine/renderer/gizmo/gizmo-draw-list';
import type { GizmoHandle, GizmoLayout, HandleTint } from './gizmo-handle';
import { basisMatrix, quadMatrix, segmentMatrix } from './shape-matrices';
import { cameraRight, cameraUp, directionToCamera } from './view-basis';
export interface GizmoEmphasis {
    readonly hovered: string | null;
    readonly active: string | null;
}
type Rgb = readonly [number, number, number];
const AXIS_COLORS: readonly Rgb[] = [
    [0.9, 0.31, 0.28],
    [0.47, 0.8, 0.3],
    [0.32, 0.56, 0.95],
];
const NEUTRAL_COLOR: Rgb = [0.86, 0.87, 0.9];
const ACCENT_COLOR: Rgb = [1, 0.84, 0.25];
const SHAFT_RADIUS = 0.011;
const LINE_RADIUS = 0.006;
const TIP_LENGTH = 0.18;
const TIP_RADIUS = 0.055;
const STEM_CUBE_SIZE = 0.11;
const EMPHASIS_THICKNESS = 1.6;
const FILL_ALPHA = 0.45;
const EMPHASIZED_FILL_ALPHA = 0.8;
const SECTOR_ALPHA = 0.3;
const MUTED_ALPHA = 0.22;
const right = vec3.create();
const up = vec3.create();
const toCamera = vec3.create();
const direction = vec3.create();
const tipBase = vec3.create();
const normal = vec3.create();
function colorOf(tint: HandleTint): Rgb {
    if (tint === 'neutral')
        return NEUTRAL_COLOR;
    return tint === 'accent' ? ACCENT_COLOR : AXIS_COLORS[tint];
}
function paint(item: GizmoDrawItem, color: Rgb, alpha: number): GizmoDrawItem {
    vec3.set(item.color, color[0], color[1], color[2]);
    item.alpha = alpha;
    return item;
}
function drawSegment(drawList: GizmoDrawList, handle: GizmoHandle, size: number, color: Rgb, alpha: number, thickness: number): void {
    const [start, end, sideU, sideV] = handle.points;
    if (handle.glyph === 'line') {
        segmentMatrix(paint(drawList.add('shaft'), color, alpha).model, start, end, LINE_RADIUS * size * thickness);
        return;
    }
    vec3.subtract(direction, end, start);
    vec3.normalize(direction, direction);
    if (handle.glyph === 'stem') {
        segmentMatrix(paint(drawList.add('shaft'), color, alpha).model, start, end, SHAFT_RADIUS * size * thickness);
        const edge = STEM_CUBE_SIZE * size * thickness;
        basisMatrix(paint(drawList.add('cube'), color, alpha).model, end, direction, sideU, sideV, edge, edge, edge);
        return;
    }
    vec3.scaleAndAdd(tipBase, end, direction, -TIP_LENGTH * size);
    segmentMatrix(paint(drawList.add('shaft'), color, alpha).model, start, tipBase, SHAFT_RADIUS * size * thickness);
    const tipRadius = TIP_RADIUS * size * thickness;
    basisMatrix(paint(drawList.add('cone'), color, alpha).model, tipBase, direction, sideU, sideV, TIP_LENGTH * size, tipRadius, tipRadius);
}
function drawCircle(drawList: GizmoDrawList, handle: GizmoHandle, color: Rgb, alpha: number): void {
    const [center, alongU, alongV] = handle.points;
    vec3.cross(normal, alongU, alongV);
    if (handle.glyph === 'sector') {
        const sector = paint(drawList.add('disc'), color, alpha * SECTOR_ALPHA);
        sector.sweep = Math.min(handle.sweep, FULL_SWEEP);
        basisMatrix(sector.model, center, alongU, alongV, normal, handle.radius, handle.radius, handle.radius);
        return;
    }
    const ring = paint(drawList.add('ring'), color, alpha);
    ring.dimBack = handle.frontOnly;
    basisMatrix(ring.model, center, alongU, alongV, normal, handle.radius, handle.radius, handle.radius);
}
function drawPoint(drawList: GizmoDrawList, handle: GizmoHandle, color: Rgb, alpha: number, thickness: number): void {
    const [center, alongU, alongV] = handle.points;
    const radius = handle.radius * thickness;
    if (handle.glyph === 'cube') {
        vec3.cross(normal, alongU, alongV);
        basisMatrix(paint(drawList.add('cube'), color, alpha).model, center, alongU, alongV, normal, radius * 2, radius * 2, radius * 2);
        return;
    }
    basisMatrix(paint(drawList.add('disc'), color, alpha).model, center, right, up, toCamera, radius, radius, radius);
}
function drawHandle(drawList: GizmoDrawList, handle: GizmoHandle, size: number, emphasis: GizmoEmphasis): void {
    const interactive = handle.action !== null;
    const emphasized = interactive && (handle.id === emphasis.active || (emphasis.active === null && handle.id === emphasis.hovered));
    const muted = interactive && emphasis.active !== null && !emphasized;
    const color = emphasized ? ACCENT_COLOR : colorOf(handle.tint);
    const alpha = muted ? MUTED_ALPHA : 1;
    const thickness = emphasized ? EMPHASIS_THICKNESS : 1;
    switch (handle.glyph) {
        case 'arrow':
        case 'stem':
        case 'line':
            drawSegment(drawList, handle, size, color, alpha, thickness);
            return;
        case 'fill':
            quadMatrix(paint(drawList.add('quad'), color, alpha * (emphasized ? EMPHASIZED_FILL_ALPHA : FILL_ALPHA)).model, handle.points[0], handle.points[1], handle.points[3]);
            return;
        case 'ring':
        case 'sector':
            drawCircle(drawList, handle, color, alpha);
            return;
        case 'disc':
        case 'cube':
            drawPoint(drawList, handle, color, alpha, thickness);
            return;
    }
}
export function drawGizmoLayout(drawList: GizmoDrawList, layout: GizmoLayout, origin: Vec3, emphasis: GizmoEmphasis, camera: PerspectiveCamera): void {
    drawList.reset(origin);
    cameraRight(right, camera);
    cameraUp(up, camera);
    directionToCamera(toCamera, camera, origin);
    for (let index = 0; index < layout.count; index++)
        drawHandle(drawList, layout.at(index), layout.size, emphasis);
}
