import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import { snapValue } from '@/engine/editor/operations/transform-operations';
import { AXIS_INDICES } from '../gizmo/gizmo-frame';
import type { GizmoLayout } from '../gizmo/gizmo-handle';
import type { GizmoPointer } from '../gizmo/gizmo-pointer';
import { createSurfaceHit } from '../snap/surface-snap';
import { createVertexHit } from '../snap/vertex-snap';
import type { DragEnvironment } from './handle-manipulation';
type SnapMark = 'none' | 'vertex' | 'surface';
const MARK_ID = 'guide.snap';
const NORMAL_ID = 'guide.snap.normal';
const MARK_RADIUS = 0.045;
const NORMAL_LENGTH = 0.3;
const vertex = createVertexHit();
const surface = createSurfaceHit();
const correction = vec3.create();
export class TranslateSnap {
    private readonly source = vec3.create();
    private readonly markPoint = vec3.create();
    private readonly markNormal = vec3.create();
    private mark: SnapMark = 'none';
    constructor(private readonly environment: DragEnvironment, source: Vec3) {
        vec3.copy(this.source, source);
    }
    axisDistance(axis: Vec3, distance: number, pointer: GizmoPointer): number {
        const { snap } = this.environment;
        this.mark = 'none';
        if (!snap.active)
            return distance;
        switch (snap.target) {
            case 'increment':
                return snapValue(distance, snap.translate);
            case 'grid':
                return this.onGrid(vec3.dot(this.source, axis), distance);
            case 'vertex':
                return this.findVertex(pointer) ? vec3.dot(vec3.subtract(correction, this.markPoint, this.source), axis) : distance;
            case 'surface':
                return distance;
        }
    }
    planeTravel(travel: Vec3, normal: Vec3, axes: readonly Vec3[], pointer: GizmoPointer): void {
        const { snap } = this.environment;
        this.mark = 'none';
        if (!snap.active)
            return;
        switch (snap.target) {
            case 'increment':
                for (const axis of axes) {
                    const along = vec3.dot(travel, axis);
                    vec3.scaleAndAdd(travel, travel, axis, snapValue(along, snap.translate) - along);
                }
                return;
            case 'grid':
                for (const axis of axes) {
                    const along = vec3.dot(travel, axis);
                    vec3.scaleAndAdd(travel, travel, axis, this.onGrid(vec3.dot(this.source, axis), along) - along);
                }
                return;
            case 'vertex':
                if (!this.findVertex(pointer))
                    return;
                vec3.subtract(correction, this.markPoint, this.source);
                vec3.subtract(correction, correction, travel);
                vec3.scaleAndAdd(correction, correction, normal, -vec3.dot(correction, normal));
                vec3.add(travel, travel, correction);
                return;
            case 'surface':
                return;
        }
    }
    freeTravel(travel: Vec3, pointer: GizmoPointer): void {
        const { snap, snapTargets } = this.environment;
        this.mark = 'none';
        if (!snap.active)
            return;
        switch (snap.target) {
            case 'increment':
                for (const axis of AXIS_INDICES)
                    travel[axis] = snapValue(travel[axis], snap.translate);
                return;
            case 'grid':
                for (const axis of AXIS_INDICES)
                    travel[axis] = this.onGrid(this.source[axis], travel[axis]);
                return;
            case 'vertex':
                if (this.findVertex(pointer))
                    vec3.subtract(travel, this.markPoint, this.source);
                return;
            case 'surface':
                if (!this.findSurface())
                    return;
                vec3.scaleAndAdd(travel, this.markPoint, this.markNormal, snapTargets.restDistance(this.markNormal, this.source));
                vec3.subtract(travel, travel, this.source);
                return;
        }
    }
    decorate(layout: GizmoLayout): void {
        if (this.mark === 'none')
            return;
        const point = layout.add(MARK_ID, 'disc', 'accent');
        vec3.copy(point.points[0], this.markPoint);
        point.radius = MARK_RADIUS * layout.size;
        if (this.mark !== 'surface')
            return;
        const normal = layout.add(NORMAL_ID, 'line', 'accent');
        vec3.copy(normal.points[0], this.markPoint);
        vec3.scaleAndAdd(normal.points[1], this.markPoint, this.markNormal, NORMAL_LENGTH * layout.size);
    }
    private onGrid(base: number, distance: number): number {
        return snapValue(base + distance, this.environment.snap.translate) - base;
    }
    private findVertex(pointer: GizmoPointer): boolean {
        const { camera, ray, snapTargets } = this.environment;
        if (!snapTargets.vertexNear(vertex, camera, pointer, ray))
            return false;
        vec3.copy(this.markPoint, vertex.point);
        this.mark = 'vertex';
        return true;
    }
    private findSurface(): boolean {
        const { ray, snapTargets } = this.environment;
        if (!snapTargets.surfaceUnder(surface, ray))
            return false;
        vec3.copy(this.markPoint, surface.point);
        vec3.copy(this.markNormal, surface.normal);
        this.mark = 'surface';
        return true;
    }
}
