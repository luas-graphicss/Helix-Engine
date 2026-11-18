import { degToRad, radToDeg } from '@/engine/core/math/scalar';
import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import { snapValue } from '@/engine/editor/operations/transform-operations';
import { createScreenPoint, projectToScreen } from '@/engine/editor/viewport/screen-space';
import type { TransformDelta } from '../apply/transform-delta';
import type { GizmoLayout } from '../gizmo/gizmo-handle';
import type { GizmoPointer } from '../gizmo/gizmo-pointer';
import { directionToCamera } from '../gizmo/view-basis';
import { formatAngle } from './drag-readout';
import type { DragEnvironment, HandleManipulation } from './handle-manipulation';
import { intersectRayPlane, signedAngleAround, wrapAngle } from './ray-math';
const EDGE_ON_FACING = 0.2;
const MIN_ARM_LENGTH = 1e-6;
const SWEEP_ID = 'guide.sweep';
const SWEEP_START_ID = 'guide.sweep.start';
const SWEEP_END_ID = 'guide.sweep.end';
const hit = vec3.create();
const arm = vec3.create();
const toCamera = vec3.create();
const screen = createScreenPoint();
export class AxisRotation implements HandleManipulation {
    readonly verb = 'Rotacionar';
    private readonly axis = vec3.create();
    private readonly startArm = vec3.create();
    private readonly sweepSide = vec3.create();
    private readonly endArm = vec3.create();
    private readonly hasStartArm: boolean;
    private readonly screenSign: number;
    private readonly startScreenAngle: number;
    private lastAngle = 0;
    private turned = 0;
    private applied = 0;
    constructor(private readonly environment: DragEnvironment, axis: Vec3, private readonly radius: number, pointer: GizmoPointer) {
        const { camera, frame } = environment;
        vec3.copy(this.axis, axis);
        directionToCamera(toCamera, camera, frame.origin);
        const facing = vec3.dot(axis, toCamera);
        this.screenSign = facing >= 0 ? 1 : -1;
        this.hasStartArm = Math.abs(facing) >= EDGE_ON_FACING && this.armAt(this.startArm);
        this.startScreenAngle = this.screenAngle(pointer);
    }
    private armAt(out: Vec3): boolean {
        const { frame, ray } = this.environment;
        if (!intersectRayPlane(hit, ray, frame.origin, this.axis))
            return false;
        vec3.subtract(out, hit, frame.origin);
        if (vec3.length(out) < MIN_ARM_LENGTH)
            return false;
        vec3.normalize(out, out);
        return true;
    }
    private screenAngle(pointer: GizmoPointer): number {
        const { camera, frame } = this.environment;
        if (!projectToScreen(screen, camera.viewProjectionMatrix, frame.origin, pointer.width, pointer.height))
            return 0;
        return Math.atan2(screen[1] - pointer.y, pointer.x - screen[0]);
    }
    private measure(pointer: GizmoPointer): number | null {
        if (!this.hasStartArm)
            return (this.screenAngle(pointer) - this.startScreenAngle) * this.screenSign;
        return this.armAt(arm) ? signedAngleAround(this.axis, this.startArm, arm) : null;
    }
    update(delta: TransformDelta, pointer: GizmoPointer): void {
        const { snap } = this.environment;
        const angle = this.measure(pointer);
        if (angle !== null) {
            this.turned += wrapAngle(angle - this.lastAngle);
            this.lastAngle = angle;
        }
        const degrees = radToDeg(this.turned);
        this.applied = degToRad(snap.active ? snapValue(degrees, snap.rotate) : degrees);
        vec3.copy(delta.rotationAxis, this.axis);
        delta.rotationAngle = this.applied;
    }
    readout(): string {
        return formatAngle(radToDeg(this.applied));
    }
    decorate(layout: GizmoLayout): void {
        if (!this.hasStartArm || this.applied === 0)
            return;
        const { origin } = this.environment.frame;
        vec3.cross(this.sweepSide, this.axis, this.startArm);
        if (this.applied < 0)
            vec3.scale(this.sweepSide, this.sweepSide, -1);
        const sweep = layout.add(SWEEP_ID, 'sector', 'accent');
        vec3.copy(sweep.points[0], origin);
        vec3.copy(sweep.points[1], this.startArm);
        vec3.copy(sweep.points[2], this.sweepSide);
        sweep.radius = this.radius;
        sweep.sweep = Math.abs(this.applied);
        vec3.rotateAroundAxis(this.endArm, this.startArm, this.axis, this.applied);
        this.addSpoke(layout, SWEEP_START_ID, this.startArm);
        this.addSpoke(layout, SWEEP_END_ID, this.endArm);
    }
    private addSpoke(layout: GizmoLayout, id: string, direction: Vec3): void {
        const spoke = layout.add(id, 'line', 'accent');
        vec3.copy(spoke.points[0], this.environment.frame.origin);
        vec3.scaleAndAdd(spoke.points[1], this.environment.frame.origin, direction, this.radius);
    }
}
