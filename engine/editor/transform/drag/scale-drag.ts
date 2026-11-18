import * as vec3 from '@/engine/core/math/vec3';
import { snapValue } from '@/engine/editor/operations/transform-operations';
import type { TransformDelta } from '../apply/transform-delta';
import { AXIS_INDICES, AXIS_LABELS, nextAxis, previousAxis, type AxisIndex } from '../gizmo/gizmo-frame';
import type { GizmoPointer } from '../gizmo/gizmo-pointer';
import { formatFactor } from './drag-readout';
import type { DragEnvironment, HandleManipulation, SnapSteps } from './handle-manipulation';
import { closestParamOnLine, intersectRayPlane } from './ray-math';
const VERB = 'Escalar';
const PLANE_LABELS: readonly string[] = ['YZ', 'XZ', 'XY'];
const MIN_FACTOR = 0.001;
const MIN_REACH = 1e-6;
const UNIFORM_DOUBLING_PIXELS = 200;
const hit = vec3.create();
function settleFactor(factor: number, snap: SnapSteps): number {
    const snapped = snap.active ? snapValue(factor, snap.scale) : factor;
    return Math.max(snapped, snap.active ? snap.scale : MIN_FACTOR, MIN_FACTOR);
}
export class AxisScale implements HandleManipulation {
    readonly verb = VERB;
    private readonly startParam: number;
    private factor = 1;
    constructor(private readonly environment: DragEnvironment, private readonly axis: AxisIndex) {
        const { frame, ray } = environment;
        this.startParam = closestParamOnLine(frame.origin, frame.axes[axis], ray) ?? 0;
    }
    update(delta: TransformDelta): void {
        const { frame, ray, snap } = this.environment;
        const param = closestParamOnLine(frame.origin, frame.axes[this.axis], ray);
        if (param !== null && Math.abs(this.startParam) > MIN_REACH)
            this.factor = settleFactor(param / this.startParam, snap);
        delta.scale[this.axis] = this.factor;
    }
    readout(): string {
        return `${AXIS_LABELS[this.axis]} ${formatFactor(this.factor)}`;
    }
}
export class PlaneScale implements HandleManipulation {
    readonly verb = VERB;
    private readonly startReach: number;
    private factor = 1;
    constructor(private readonly environment: DragEnvironment, private readonly normal: AxisIndex) {
        const { frame, ray } = environment;
        this.startReach = intersectRayPlane(hit, ray, frame.origin, frame.axes[normal]) ? vec3.distance(hit, frame.origin) : 0;
    }
    update(delta: TransformDelta): void {
        const { frame, ray, snap } = this.environment;
        if (this.startReach > MIN_REACH && intersectRayPlane(hit, ray, frame.origin, frame.axes[this.normal]))
            this.factor = settleFactor(vec3.distance(hit, frame.origin) / this.startReach, snap);
        delta.scale[nextAxis(this.normal)] = this.factor;
        delta.scale[previousAxis(this.normal)] = this.factor;
    }
    readout(): string {
        return `${PLANE_LABELS[this.normal]} ${formatFactor(this.factor)}`;
    }
}
export class UniformScale implements HandleManipulation {
    readonly verb = VERB;
    private readonly startX: number;
    private readonly startY: number;
    private factor = 1;
    constructor(private readonly environment: DragEnvironment, pointer: GizmoPointer) {
        this.startX = pointer.x;
        this.startY = pointer.y;
    }
    update(delta: TransformDelta, pointer: GizmoPointer): void {
        const travel = pointer.x - this.startX - (pointer.y - this.startY);
        this.factor = settleFactor(1 + travel / UNIFORM_DOUBLING_PIXELS, this.environment.snap);
        for (const axis of AXIS_INDICES)
            delta.scale[axis] = this.factor;
    }
    readout(): string {
        return formatFactor(this.factor);
    }
}
