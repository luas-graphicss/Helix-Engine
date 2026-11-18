import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import { snapValue } from '@/engine/editor/operations/transform-operations';
import type { TransformDelta } from '../apply/transform-delta';
import { AXIS_LABELS, type AxisIndex } from '../gizmo/gizmo-frame';
import type { GizmoPointer } from '../gizmo/gizmo-pointer';
import { formatDistance } from './drag-readout';
import type { DragEnvironment, HandleManipulation } from './handle-manipulation';
import { intersectRayPlane } from './ray-math';
interface RectGrip {
    readonly axis: AxisIndex;
    readonly span: number;
    readonly start: number;
    factor: number;
}
const MIN_FACTOR = 0.001;
const MIN_SPAN = 1e-6;
const hit = vec3.create();
const reach = vec3.create();
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
    constructor(private readonly environment: DragEnvironment, normal: Vec3, axes: readonly AxisIndex[], grabbed: Vec3, anchor: Vec3) {
        vec3.copy(this.normal, normal);
        vec3.copy(this.anchor, anchor);
        const started = this.measure();
        vec3.copy(reach, hit);
        this.grips = axes.map((axis) => {
            const direction = environment.frame.axes[axis];
            const span = vec3.dot(vec3.subtract(hit, grabbed, anchor), direction);
            return { axis, span, start: started ? vec3.dot(reach, direction) : span, factor: 1 };
        });
    }
    private measure(): boolean {
        if (!intersectRayPlane(hit, this.environment.ray, this.anchor, this.normal))
            return false;
        vec3.subtract(hit, hit, this.anchor);
        return true;
    }
    update(delta: TransformDelta, pointer: GizmoPointer): void {
        const { frame, snap } = this.environment;
        if (this.measure()) {
            for (const grip of this.grips) {
                if (Math.abs(grip.span) < MIN_SPAN)
                    continue;
                const travel = vec3.dot(hit, frame.axes[grip.axis]) - grip.start;
                const settled = snap.active ? snapValue(travel, snap.translate) : travel;
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
}
