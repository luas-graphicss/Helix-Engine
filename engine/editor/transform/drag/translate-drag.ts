import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { TransformDelta } from '../apply/transform-delta';
import { AXIS_LABELS, type AxisIndex } from '../gizmo/gizmo-frame';
import type { GizmoLayout } from '../gizmo/gizmo-handle';
import type { GizmoPointer } from '../gizmo/gizmo-pointer';
import { formatDistance, formatOffset } from './drag-readout';
import type { DragEnvironment, HandleManipulation } from './handle-manipulation';
import { closestParamOnLine, intersectRayPlane } from './ray-math';
import { TranslateSnap } from './translate-snap';
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
    private readonly snap: TranslateSnap;
    private distance = 0;
    constructor(private readonly environment: DragEnvironment, private readonly axis: AxisIndex) {
        const { frame, ray } = environment;
        this.startParam = closestParamOnLine(frame.origin, frame.axes[axis], ray) ?? 0;
        this.snap = new TranslateSnap(environment, frame.origin);
    }
    update(delta: TransformDelta, pointer: GizmoPointer): void {
        const { frame, ray } = this.environment;
        const direction = frame.axes[this.axis];
        const param = closestParamOnLine(frame.origin, direction, ray);
        if (param !== null)
            this.distance = this.snap.axisDistance(direction, param - this.startParam, pointer);
        vec3.scale(this.travel, direction, this.distance);
        vec3.copy(delta.translation, this.travel);
    }
    readout(): string {
        return `${AXIS_LABELS[this.axis]} ${formatDistance(this.distance)}`;
    }
    decorate(layout: GizmoLayout): void {
        addTravelGuide(layout, this.environment.frame.origin, this.travel);
        this.snap.decorate(layout);
    }
}
abstract class PlaneBoundTranslation implements HandleManipulation {
    readonly verb = VERB;
    protected readonly snap: TranslateSnap;
    protected readonly normal = vec3.create();
    private readonly origin = vec3.create();
    private readonly startPoint = vec3.create();
    private readonly hit = vec3.create();
    private readonly travel = vec3.create();
    constructor(private readonly environment: DragEnvironment, origin: Vec3, normal: Vec3) {
        vec3.copy(this.origin, origin);
        vec3.copy(this.normal, normal);
        this.snap = new TranslateSnap(environment, origin);
        if (!intersectRayPlane(this.startPoint, environment.ray, origin, normal))
            vec3.copy(this.startPoint, origin);
    }
    protected abstract settle(travel: Vec3, pointer: GizmoPointer): void;
    update(delta: TransformDelta, pointer: GizmoPointer): void {
        if (intersectRayPlane(this.hit, this.environment.ray, this.origin, this.normal)) {
            vec3.subtract(this.travel, this.hit, this.startPoint);
            this.settle(this.travel, pointer);
        }
        vec3.copy(delta.translation, this.travel);
    }
    readout(): string {
        return formatOffset(this.travel[0], this.travel[1], this.travel[2]);
    }
    decorate(layout: GizmoLayout): void {
        addTravelGuide(layout, this.origin, this.travel);
        this.snap.decorate(layout);
    }
}
export class PlaneTranslation extends PlaneBoundTranslation {
    constructor(environment: DragEnvironment, normal: Vec3, private readonly snapAxes: readonly Vec3[]) {
        super(environment, environment.frame.origin, normal);
    }
    protected settle(travel: Vec3, pointer: GizmoPointer): void {
        this.snap.planeTravel(travel, this.normal, this.snapAxes, pointer);
    }
}
export class FreeTranslation extends PlaneBoundTranslation {
    protected settle(travel: Vec3, pointer: GizmoPointer): void {
        this.snap.freeTravel(travel, pointer);
    }
}
