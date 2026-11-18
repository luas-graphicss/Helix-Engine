import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { TransformDelta } from '../apply/transform-delta';
import { AXIS_LABELS, type AxisIndex } from '../gizmo/gizmo-frame';
import type { GizmoLayout } from '../gizmo/gizmo-handle';
import type { GizmoPointer } from '../gizmo/gizmo-pointer';
import { formatDistance } from './drag-readout';
import type { DragEnvironment, HandleManipulation } from './handle-manipulation';
import { intersectRayPlane } from './ray-math';
import { TranslateSnap } from './translate-snap';
interface RectGrip {
    readonly axis: AxisIndex;
    readonly span: number;
    readonly start: number;
    factor: number;
}
const MIN_FACTOR = 0.001;
const MIN_SPAN = 1e-6;
const pointerOffset = vec3.create();
const extent = vec3.create();
function dominantFactor(grips: readonly RectGrip[]): number {
    let dominant = 1;
    for (const grip of grips) {
        if (Math.abs(grip.factor - 1) > Math.abs(dominant - 1))
            dominant = grip.factor;
    }
    return dominant;
}
export class RectResize implements HandleManipulation {
    readonly verb = 'Redimensionar';
    private readonly normal = vec3.create();
    private readonly anchor = vec3.create();
    private readonly grips: RectGrip[];
    private readonly snap: TranslateSnap;
    constructor(private readonly environment: DragEnvironment, normal: Vec3, axes: readonly AxisIndex[], grabbed: Vec3, anchor: Vec3) {
        vec3.copy(this.normal, normal);
        vec3.copy(this.anchor, anchor);
        this.snap = new TranslateSnap(environment, grabbed);
        const started = this.measurePointerOffset();
        vec3.subtract(extent, grabbed, anchor);
        this.grips = axes.map((axis) => {
            const direction = environment.frame.axes[axis];
            const span = vec3.dot(extent, direction);
            return { axis, span, start: started ? vec3.dot(pointerOffset, direction) : span, factor: 1 };
        });
    }
    private measurePointerOffset(): boolean {
        if (!intersectRayPlane(pointerOffset, this.environment.ray, this.anchor, this.normal))
            return false;
        vec3.subtract(pointerOffset, pointerOffset, this.anchor);
        return true;
    }
    update(delta: TransformDelta, pointer: GizmoPointer): void {
        const { frame } = this.environment;
        if (this.measurePointerOffset()) {
            for (const grip of this.grips) {
                if (Math.abs(grip.span) < MIN_SPAN)
                    continue;
                const direction = frame.axes[grip.axis];
                const travel = vec3.dot(pointerOffset, direction) - grip.start;
                const settled = this.snap.axisDistance(direction, travel, pointer);
                grip.factor = Math.max((grip.span + settled) / grip.span, MIN_FACTOR);
            }
        }
        const shared = pointer.shift && this.grips.length > 1 ? dominantFactor(this.grips) : null;
        for (const grip of this.grips)
            delta.scale[grip.axis] = shared ?? grip.factor;
        vec3.copy(delta.pivot, this.anchor);
        delta.sharedPivot = true;
    }
    readout(): string {
        return this.grips.map((grip) => `${AXIS_LABELS[grip.axis]} ${formatDistance(Math.abs(grip.span) * grip.factor)}`).join(' · ');
    }
    decorate(layout: GizmoLayout): void {
        this.snap.decorate(layout);
    }
}
