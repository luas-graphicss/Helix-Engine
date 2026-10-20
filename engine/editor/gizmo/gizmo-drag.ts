import * as mat4 from '@/engine/core/math/mat4';
import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import { createRay, type Ray } from '@/engine/core/math/ray';
import { degToRad, radToDeg } from '@/engine/core/math/scalar';
import type { Entity } from '@/engine/core/scene/entity';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { buildPickRay } from '@/engine/editor/viewport/pick-entity';
import { applyTransformSnapshot, commitTransform, snapshotTransform, snapValue, type TransformSnapshot, } from '@/engine/editor/operations/transform-operations';
import { AXIS_INDEX, PLANE_AXES, copyGizmoFrame, createGizmoFrame, type GizmoAxisHandle, type GizmoFrame, type GizmoHandle, type GizmoMode, type GizmoPlaneHandle, } from '@/engine/renderer/gizmo/gizmo-frame';
import { createScreenPoint, projectToScreen } from './screen-space';
export interface PointerSample {
    x: number;
    y: number;
    width: number;
    height: number;
    ctrl: boolean;
}
const MODE_LABEL: Record<GizmoMode, string> = { translate: 'Mover', rotate: 'Rotacionar', scale: 'Escalar' };
const EDGE_ON_THRESHOLD = 0.2;
const UNIFORM_SCALE_PIXELS = 200;
const IDENTITY = mat4.create();
const scratchHit = vec3.create();
const scratchDelta = vec3.create();
const scratchLocal = vec3.create();
const scratchRotation = mat4.create();
const scratchLocalStart = mat4.create();
const scratchWorldStart = mat4.create();
const scratchWorldNext = mat4.create();
const scratchLocalNext = mat4.create();
const scratchTranslation = vec3.create();
const scratchScale = vec3.create();
const scratchScreen = createScreenPoint();
function closestParamOnLine(lineOrigin: Vec3, lineDirection: Vec3, ray: Ray): number | null {
    vec3.subtract(scratchDelta, lineOrigin, ray.origin);
    const b = vec3.dot(lineDirection, ray.direction);
    const d = vec3.dot(lineDirection, scratchDelta);
    const e = vec3.dot(ray.direction, scratchDelta);
    const denominator = 1 - b * b;
    if (denominator < 1e-6)
        return null;
    return (b * e - d) / denominator;
}
function intersectRayPlane(out: Vec3, ray: Ray, planeOrigin: Vec3, normal: Vec3): boolean {
    const denominator = vec3.dot(normal, ray.direction);
    if (Math.abs(denominator) < 1e-5)
        return false;
    vec3.subtract(scratchDelta, planeOrigin, ray.origin);
    const t = vec3.dot(scratchDelta, normal) / denominator;
    if (t < 0)
        return false;
    vec3.scaleAndAdd(out, ray.origin, ray.direction, t);
    return true;
}
function normalizeAngle(angle: number): number {
    while (angle > Math.PI)
        angle -= Math.PI * 2;
    while (angle < -Math.PI)
        angle += Math.PI * 2;
    return angle;
}
export class GizmoDrag {
    readonly before: TransformSnapshot;
    private readonly frame = createGizmoFrame();
    private readonly ray = createRay();
    private readonly parentInverse = mat4.create();
    private readonly startPoint = vec3.create();
    private readonly startDirection = vec3.create();
    private startParam = 0;
    private startScreenAngle = 0;
    private screenRotationSign = 1;
    private useScreenRotation = false;
    private readonly startPointer: {
        x: number;
        y: number;
    };
    private finished = false;
    constructor(private readonly session: EditorSession, readonly entity: Entity, readonly mode: GizmoMode, readonly handle: GizmoHandle, frame: GizmoFrame, pointer: PointerSample) {
        copyGizmoFrame(this.frame, frame);
        this.before = snapshotTransform(entity);
        this.startPointer = { x: pointer.x, y: pointer.y };
        const parentWorld = entity.parent?.worldMatrix ?? IDENTITY;
        if (!mat4.invert(this.parentInverse, parentWorld))
            mat4.identity(this.parentInverse);
        this.buildRay(pointer);
        this.captureStart(pointer);
    }
    private buildRay(pointer: PointerSample): boolean {
        return buildPickRay(this.ray, this.session.camera, pointer.x / pointer.width, pointer.y / pointer.height) !== null;
    }
    private captureStart(pointer: PointerSample): void {
        const { frame, handle, mode } = this;
        if (handle === 'uniform')
            return;
        if (handle.length === 2) {
            const normal = frame.axes[this.planeNormalIndex(handle as GizmoPlaneHandle)];
            if (!intersectRayPlane(this.startPoint, this.ray, frame.origin, normal))
                vec3.copy(this.startPoint, frame.origin);
            return;
        }
        const axis = frame.axes[AXIS_INDEX[handle as GizmoAxisHandle]];
        if (mode === 'rotate') {
            const camera = this.session.camera;
            vec3.subtract(scratchDelta, camera.position, frame.origin);
            vec3.normalize(scratchDelta, scratchDelta);
            const facing = vec3.dot(axis, scratchDelta);
            this.screenRotationSign = facing >= 0 ? 1 : -1;
            this.useScreenRotation = Math.abs(facing) < EDGE_ON_THRESHOLD;
            if (!this.useScreenRotation && intersectRayPlane(scratchHit, this.ray, frame.origin, axis)) {
                vec3.subtract(this.startDirection, scratchHit, frame.origin);
                if (vec3.length(this.startDirection) > 1e-6)
                    vec3.normalize(this.startDirection, this.startDirection);
                else
                    this.useScreenRotation = true;
            }
            else {
                this.useScreenRotation = true;
            }
            this.startScreenAngle = this.screenAngle(pointer);
            return;
        }
        this.startParam = closestParamOnLine(frame.origin, axis, this.ray) ?? 0;
    }
    private planeNormalIndex(handle: GizmoPlaneHandle): 0 | 1 | 2 {
        const [i, j] = PLANE_AXES[handle];
        return (3 - i - j) as 0 | 1 | 2;
    }
    private screenAngle(pointer: PointerSample): number {
        const camera = this.session.camera;
        if (!projectToScreen(scratchScreen, camera.viewProjectionMatrix, this.frame.origin, pointer.width, pointer.height))
            return 0;
        return Math.atan2(-(pointer.y - scratchScreen[1]), pointer.x - scratchScreen[0]);
    }
    update(pointer: PointerSample): void {
        if (this.finished || !this.buildRay(pointer))
            return;
        const snapping = this.session.snap.enabled !== pointer.ctrl;
        switch (this.mode) {
            case 'translate':
                this.updateTranslate(pointer, snapping);
                break;
            case 'rotate':
                this.updateRotate(pointer, snapping);
                break;
            case 'scale':
                this.updateScale(pointer, snapping);
                break;
        }
        this.session.notify();
    }
    private updateTranslate(pointer: PointerSample, snapping: boolean): void {
        const { frame, handle } = this;
        const step = this.session.snap.translate;
        if (handle.length === 2) {
            const [i, j] = PLANE_AXES[handle as GizmoPlaneHandle];
            const normal = frame.axes[this.planeNormalIndex(handle as GizmoPlaneHandle)];
            if (!intersectRayPlane(scratchHit, this.ray, frame.origin, normal))
                return;
            vec3.subtract(scratchDelta, scratchHit, this.startPoint);
            let along = vec3.dot(scratchDelta, frame.axes[i]);
            let across = vec3.dot(scratchDelta, frame.axes[j]);
            if (snapping) {
                along = snapValue(along, step);
                across = snapValue(across, step);
            }
            vec3.scale(scratchDelta, frame.axes[i], along);
            vec3.scaleAndAdd(scratchDelta, scratchDelta, frame.axes[j], across);
            this.applyWorldTranslation(scratchDelta);
            return;
        }
        const axis = frame.axes[AXIS_INDEX[handle as GizmoAxisHandle]];
        const param = closestParamOnLine(frame.origin, axis, this.ray);
        if (param === null)
            return;
        let distance = param - this.startParam;
        if (snapping)
            distance = snapValue(distance, step);
        vec3.scale(scratchDelta, axis, distance);
        this.applyWorldTranslation(scratchDelta);
    }
    private applyWorldTranslation(worldDelta: Vec3): void {
        mat4.transformDirection(scratchLocal, this.parentInverse, worldDelta);
        vec3.add(this.entity.transform.position, this.before.position, scratchLocal);
    }
    private updateRotate(pointer: PointerSample, snapping: boolean): void {
        const { frame } = this;
        const axis = frame.axes[AXIS_INDEX[this.handle as GizmoAxisHandle]];
        let angle: number;
        if (this.useScreenRotation) {
            angle = normalizeAngle(this.screenAngle(pointer) - this.startScreenAngle) * this.screenRotationSign;
        }
        else {
            if (!intersectRayPlane(scratchHit, this.ray, frame.origin, axis))
                return;
            vec3.subtract(scratchDelta, scratchHit, frame.origin);
            if (vec3.length(scratchDelta) < 1e-6)
                return;
            vec3.normalize(scratchDelta, scratchDelta);
            vec3.cross(scratchLocal, this.startDirection, scratchDelta);
            angle = Math.atan2(vec3.dot(scratchLocal, axis), vec3.dot(this.startDirection, scratchDelta));
        }
        let degrees = radToDeg(angle);
        if (snapping)
            degrees = snapValue(degrees, this.session.snap.rotate);
        this.applyWorldRotation(axis, degToRad(degrees));
    }
    private applyWorldRotation(axis: Vec3, angle: number): void {
        const { before, entity } = this;
        const parentWorld = entity.parent?.worldMatrix ?? IDENTITY;
        mat4.fromTranslationRotationScale(scratchLocalStart, before.position, before.rotation, before.scale);
        mat4.multiply(scratchWorldStart, parentWorld, scratchLocalStart);
        mat4.fromAxisAngle(scratchRotation, axis, angle);
        mat4.multiply(scratchWorldNext, scratchRotation, scratchWorldStart);
        scratchWorldNext[12] = scratchWorldStart[12];
        scratchWorldNext[13] = scratchWorldStart[13];
        scratchWorldNext[14] = scratchWorldStart[14];
        mat4.multiply(scratchLocalNext, this.parentInverse, scratchWorldNext);
        mat4.decomposeTranslationRotationScale(scratchTranslation, entity.transform.rotation, scratchScale, scratchLocalNext);
        vec3.copy(entity.transform.position, before.position);
        vec3.copy(entity.transform.scale, before.scale);
    }
    private updateScale(pointer: PointerSample, snapping: boolean): void {
        const { frame, before, entity } = this;
        const step = this.session.snap.scale;
        if (this.handle === 'uniform') {
            const drag = pointer.x - this.startPointer.x - (pointer.y - this.startPointer.y);
            const factor = 1 + drag / UNIFORM_SCALE_PIXELS;
            for (let i = 0; i < 3; i++) {
                const value = before.scale[i] * factor;
                entity.transform.scale[i] = snapping ? snapValue(value, step) : value;
            }
            return;
        }
        const index = AXIS_INDEX[this.handle as GizmoAxisHandle];
        const param = closestParamOnLine(frame.origin, frame.axes[index], this.ray);
        if (param === null)
            return;
        const factor = 1 + (param - this.startParam) / frame.size;
        const value = before.scale[index] * factor;
        entity.transform.scale[index] = snapping ? snapValue(value, step) : value;
    }
    commit(): void {
        if (this.finished)
            return;
        this.finished = true;
        const after = snapshotTransform(this.entity);
        const changed = (['position', 'rotation', 'scale'] as const).some((field) => after[field].some((value, i) => value !== this.before[field][i]));
        if (!changed) {
            this.session.notify();
            return;
        }
        this.session.history.endMerge();
        commitTransform(this.session, this.entity, this.before, after, `${MODE_LABEL[this.mode]} ${this.entity.name}`);
        this.session.history.endMerge();
    }
    cancel(): void {
        if (this.finished)
            return;
        this.finished = true;
        applyTransformSnapshot(this.entity, this.before);
        this.session.notify();
    }
}
