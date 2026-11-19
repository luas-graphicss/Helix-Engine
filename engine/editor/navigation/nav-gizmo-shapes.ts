import * as mat4 from '@/engine/core/math/mat4';
import type { Mat4 } from '@/engine/core/math/mat4';
import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { DebugLineBuffer } from './debug-line-buffer';
const CIRCLE_SEGMENTS = 24;
const ARC_SEGMENTS = 16;
const CYLINDER_RIBS = 4;
const BOX_CORNERS = 8;
const ARC_PEAK = 4;
const FULL_TURN = Math.PI * 2;
const BOX_EDGES: ReadonlyArray<readonly [number, number]> = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
const corners: Vec3[] = Array.from({ length: BOX_CORNERS }, () => vec3.create());
const localCorner = vec3.create();
const from = vec3.create();
const to = vec3.create();
export function drawBox(buffer: DebugLineBuffer, world: Mat4, center: Vec3, size: Vec3, color: Vec3, alpha: number): void {
    for (let corner = 0; corner < BOX_CORNERS; corner++) {
        for (let axis = 0; axis < 3; axis++)
            localCorner[axis] = center[axis] + ((corner >> axis) & 1 ? 0.5 : -0.5) * size[axis];
        mat4.transformPoint(corners[corner], world, localCorner);
    }
    for (const [start, end] of BOX_EDGES)
        buffer.segment(corners[start], corners[end], color, alpha);
}
export function drawCircle(buffer: DebugLineBuffer, center: Vec3, radius: number, color: Vec3, alpha: number): void {
    vec3.set(from, center[0] + radius, center[1], center[2]);
    for (let segment = 1; segment <= CIRCLE_SEGMENTS; segment++) {
        const angle = (segment / CIRCLE_SEGMENTS) * FULL_TURN;
        vec3.set(to, center[0] + Math.cos(angle) * radius, center[1], center[2] + Math.sin(angle) * radius);
        buffer.segment(from, to, color, alpha);
        vec3.copy(from, to);
    }
}
export function drawCylinder(buffer: DebugLineBuffer, base: Vec3, radius: number, height: number, color: Vec3, alpha: number): void {
    const top = vec3.create(base[0], base[1] + height, base[2]);
    drawCircle(buffer, base, radius, color, alpha);
    drawCircle(buffer, top, radius, color, alpha);
    for (let rib = 0; rib < CYLINDER_RIBS; rib++) {
        const angle = (rib / CYLINDER_RIBS) * FULL_TURN;
        vec3.set(from, base[0] + Math.cos(angle) * radius, base[1], base[2] + Math.sin(angle) * radius);
        vec3.set(to, from[0], top[1], from[2]);
        buffer.segment(from, to, color, alpha);
    }
}
export function drawArc(buffer: DebugLineBuffer, start: Vec3, end: Vec3, height: number, color: Vec3, alpha: number): void {
    vec3.copy(from, start);
    for (let segment = 1; segment <= ARC_SEGMENTS; segment++) {
        const progress = segment / ARC_SEGMENTS;
        for (let axis = 0; axis < 3; axis++)
            to[axis] = start[axis] + (end[axis] - start[axis]) * progress;
        to[1] += height * ARC_PEAK * progress * (1 - progress);
        buffer.segment(from, to, color, alpha);
        vec3.copy(from, to);
    }
}
