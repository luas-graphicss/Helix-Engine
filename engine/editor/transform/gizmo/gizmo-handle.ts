import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import { FULL_SWEEP } from '@/engine/renderer/gizmo/gizmo-draw-list';
import type { AxisIndex } from './gizmo-frame';
export type HandleAction = {
    readonly kind: 'translateAxis';
    readonly axis: AxisIndex;
} | {
    readonly kind: 'translatePlane';
    readonly normal: AxisIndex;
} | {
    readonly kind: 'translateView';
} | {
    readonly kind: 'translateVertex';
} | {
    readonly kind: 'rotateAxis';
    readonly axis: AxisIndex;
} | {
    readonly kind: 'rotateView';
} | {
    readonly kind: 'scaleAxis';
    readonly axis: AxisIndex;
} | {
    readonly kind: 'scalePlane';
    readonly normal: AxisIndex;
} | {
    readonly kind: 'scaleUniform';
} | {
    readonly kind: 'rectEdge';
    readonly normal: AxisIndex;
    readonly axis: AxisIndex;
} | {
    readonly kind: 'rectCorner';
    readonly normal: AxisIndex;
} | {
    readonly kind: 'rectRotate';
    readonly normal: AxisIndex;
};
type SegmentGlyph = 'arrow' | 'stem' | 'line';
type CircleGlyph = 'ring' | 'sector';
type PointGlyph = 'disc' | 'cube';
type QuadGlyph = 'fill' | 'area';
export type HandleGlyph = SegmentGlyph | CircleGlyph | PointGlyph | QuadGlyph;
export type HandleTint = AxisIndex | 'neutral' | 'accent';
export interface GizmoHandle {
    id: string;
    glyph: HandleGlyph;
    tint: HandleTint;
    action: HandleAction | null;
    priority: number;
    readonly points: readonly [Vec3, Vec3, Vec3, Vec3];
    radius: number;
    sweep: number;
    frontOnly: boolean;
}
export class GizmoLayout {
    size = 1;
    private readonly handles: GizmoHandle[] = [];
    private used = 0;
    get count(): number {
        return this.used;
    }
    begin(size: number): void {
        this.size = size;
        this.used = 0;
    }
    add(id: string, glyph: HandleGlyph, tint: HandleTint, action: HandleAction | null = null, priority = 0): GizmoHandle {
        if (this.used === this.handles.length) {
            this.handles.push({
                id,
                glyph,
                tint,
                action,
                priority,
                points: [vec3.create(), vec3.create(), vec3.create(), vec3.create()],
                radius: 0,
                sweep: FULL_SWEEP,
                frontOnly: false,
            });
        }
        const handle = this.handles[this.used++];
        handle.id = id;
        handle.glyph = glyph;
        handle.tint = tint;
        handle.action = action;
        handle.priority = priority;
        handle.radius = 0;
        handle.sweep = FULL_SWEEP;
        handle.frontOnly = false;
        return handle;
    }
    at(index: number): GizmoHandle {
        return this.handles[index];
    }
    find(id: string): GizmoHandle | null {
        for (let index = 0; index < this.used; index++) {
            if (this.handles[index].id === id)
                return this.handles[index];
        }
        return null;
    }
}
