import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import { snapValue } from '@/engine/editor/operations/transform-operations';
import type { TransformDelta } from '../apply/transform-delta';
import { AXIS_LABELS, type AxisIndex } from '../gizmo/gizmo-frame';
import type { GizmoLayout } from '../gizmo/gizmo-handle';
import { formatDistance, formatOffset } from './drag-readout';
import type { DragEnvironment, HandleManipulation } from './handle-manipulation';
import { closestParamOnLine, intersectRayPlane } from './ray-math';
const TRAVEL_GUIDE_ID = 'guide.travel';
const TRAVEL_START_ID = 'guide.travel.start';
const START_MARKER_RADIUS = 0.035;
const VERB = 'Mover';
function addTravelGuide(layout: GizmoLayout, start: Vec3, travel: Vec3): void {
    const guide = layout.add(TRAVEL_GUIDE_ID, 'line', 'neutral');
    vec3.copy(guide.points[0], start);
    vec3.add(guide.points[1], start, travel);
    const marker = layout.add(TRAVEL_START_ID, 'disc', 'neutral');
    vec3.copy(marker.points[0], start);
    marker.radius = START_MARKER_RADIUS * layout.size;
}
export class AxisTranslation implements HandleManipulation {
    readonly verb = VERB;
    private readonly startParam: number;
    private readonly travel = vec3.create();
    private distance = 0;
    constructor(private readonly environment: DragEnvironment, private readonly axis: AxisIndex) {
        const { frame, ray } = environment;
        this.startParam = closestParamOnLine(frame.origin, frame.axes[axis], ray) ?? 0;
    }
    update(delta: TransformDelta): void {
        const { frame, ray, snap } = this.environment;
        const param = closestParamOnLine(frame.origin, frame.axes[this.axis], ray);
        if (param !== null)
            this.distance = snap.active ? snapValue(param - this.startParam, snap.translate) : param - this.startParam;
        vec3.scale(this.travel, frame.axes[this.axis], this.distance);
        vec3.copy(delta.translation, this.travel);
    }
    readout(): string {
        return `${AXIS_LABELS[this.axis]} ${formatDistance(this.distance)}`;
    }
    decorate(layout: GizmoLayout): void {
        addTravelGuide(layout, this.environment.frame.origin, this.travel);
    }
}
export class PlaneTranslation implements HandleManipulation {
    readonly verb = VERB;
    private readonly normal = vec3.create();
    private readonly startPoint = vec3.create();
    private readonly hit = vec3.create();
    private readonly travel = vec3.create();
    constructor(private readonly environment: DragEnvironment, normal: Vec3, private readonly snapAxes: readonly Vec3[]) {
        const { frame, ray } = environment;
        vec3.copy(this.normal, normal);
        if (!intersectRayPlane(this.startPoint, ray, frame.origin, normal))
            vec3.copy(this.startPoint, frame.origin);
    }
    update(delta: TransformDelta): void {
        const { frame, ray, snap } = this.environment;
        if (intersectRayPlane(this.hit, ray, frame.origin, this.normal)) {
            vec3.subtract(this.travel, this.hit, this.startPoint);
            if (snap.active)
                this.snapTravel(snap.translate);
        }
        vec3.copy(delta.translation, this.travel);
    }
    private snapTravel(step: number): void {
        for (const axis of this.snapAxes) {
            const along = vec3.dot(this.travel, axis);
            vec3.scaleAndAdd(this.travel, this.travel, axis, snapValue(along, step) - along);
        }
    }
    readout(): string {
        return formatOffset(this.travel[0], this.travel[1], this.travel[2]);
    }
    decorate(layout: GizmoLayout): void {
        addTravelGuide(layout, this.environment.frame.origin, this.travel);
    }
}
