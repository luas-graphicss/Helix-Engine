import * as vec3 from '@/engine/core/math/vec3';
import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import { createScreenPoint, distanceToSegment2D, pointInConvexQuad2D, projectToScreen } from '@/engine/editor/viewport/screen-space';
import type { GizmoHandle, GizmoLayout } from './gizmo-handle';
import type { GizmoPointer } from './gizmo-pointer';
const SEGMENT_TOLERANCE_PX = 9;
const CIRCLE_TOLERANCE_PX = 8;
const POINT_TOLERANCE_PX = 11;
const CIRCLE_SAMPLES = 64;
const BACK_FACING_SLACK = 0.05;
const MISS = Infinity;
const screenA = createScreenPoint();
const screenB = createScreenPoint();
const quad = new Float32Array(8);
const sample = vec3.create();
const toCamera = vec3.create();
function within(distance: number, tolerance: number): number {
    return distance <= tolerance ? distance : MISS;
}
function segmentDistance(handle: GizmoHandle, camera: PerspectiveCamera, pointer: GizmoPointer): number {
    const matrix = camera.viewProjectionMatrix;
    if (!projectToScreen(screenA, matrix, handle.points[0], pointer.width, pointer.height) || !projectToScreen(screenB, matrix, handle.points[1], pointer.width, pointer.height))
        return MISS;
    return within(distanceToSegment2D(pointer.x, pointer.y, screenA[0], screenA[1], screenB[0], screenB[1]), SEGMENT_TOLERANCE_PX);
}
function quadDistance(handle: GizmoHandle, camera: PerspectiveCamera, pointer: GizmoPointer): number {
    for (let corner = 0; corner < 4; corner++) {
        if (!projectToScreen(screenA, camera.viewProjectionMatrix, handle.points[corner], pointer.width, pointer.height))
            return MISS;
        quad[corner * 2] = screenA[0];
        quad[corner * 2 + 1] = screenA[1];
    }
    return pointInConvexQuad2D(pointer.x, pointer.y, quad) ? 0 : MISS;
}
function circleDistance(handle: GizmoHandle, camera: PerspectiveCamera, pointer: GizmoPointer): number {
    const [center, alongU, alongV] = handle.points;
    vec3.subtract(toCamera, camera.position, center);
    vec3.normalize(toCamera, toCamera);
    const facingLimit = -BACK_FACING_SLACK * handle.radius;
    let nearest = MISS;
    let hasPrevious = false;
    for (let step = 0; step <= CIRCLE_SAMPLES; step++) {
        const angle = (step / CIRCLE_SAMPLES) * handle.sweep;
        vec3.scale(sample, alongU, Math.cos(angle) * handle.radius);
        vec3.scaleAndAdd(sample, sample, alongV, Math.sin(angle) * handle.radius);
        const hidden = handle.frontOnly && vec3.dot(sample, toCamera) < facingLimit;
        vec3.add(sample, sample, center);
        const visible = !hidden && projectToScreen(screenB, camera.viewProjectionMatrix, sample, pointer.width, pointer.height);
        if (visible && hasPrevious)
            nearest = Math.min(nearest, distanceToSegment2D(pointer.x, pointer.y, screenA[0], screenA[1], screenB[0], screenB[1]));
        hasPrevious = visible;
        screenA[0] = screenB[0];
        screenA[1] = screenB[1];
    }
    return within(nearest, CIRCLE_TOLERANCE_PX);
}
function pointDistance(handle: GizmoHandle, camera: PerspectiveCamera, pointer: GizmoPointer): number {
    if (!projectToScreen(screenA, camera.viewProjectionMatrix, handle.points[0], pointer.width, pointer.height))
        return MISS;
    return within(Math.hypot(pointer.x - screenA[0], pointer.y - screenA[1]), POINT_TOLERANCE_PX);
}
function handleDistance(handle: GizmoHandle, camera: PerspectiveCamera, pointer: GizmoPointer): number {
    switch (handle.glyph) {
        case 'arrow':
        case 'stem':
        case 'line':
            return segmentDistance(handle, camera, pointer);
        case 'fill':
            return quadDistance(handle, camera, pointer);
        case 'ring':
        case 'sector':
            return circleDistance(handle, camera, pointer);
        case 'disc':
        case 'cube':
            return pointDistance(handle, camera, pointer);
    }
}
export function pickHandle(layout: GizmoLayout, camera: PerspectiveCamera, pointer: GizmoPointer): GizmoHandle | null {
    if (!camera.invertible)
        return null;
    let best: GizmoHandle | null = null;
    let bestDistance = MISS;
    for (let index = 0; index < layout.count; index++) {
        const handle = layout.at(index);
        if (!handle.action)
            continue;
        const distance = handleDistance(handle, camera, pointer);
        if (distance === MISS)
            continue;
        if (!best || handle.priority > best.priority || (handle.priority === best.priority && distance < bestDistance)) {
            best = handle;
            bestDistance = distance;
        }
    }
    return best;
}
