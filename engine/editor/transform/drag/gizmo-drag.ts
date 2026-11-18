import { createRay } from '@/engine/core/math/ray';
import * as vec3 from '@/engine/core/math/vec3';
import type { TransformChange } from '@/engine/editor/operations/transform-operations';
import { buildPickRay } from '@/engine/editor/viewport/pick-entity';
import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import { applyTransformDelta } from '../apply/apply-transform-delta';
import { captureTargetState, collectTargetChanges, restoreTargetState, type TargetState } from '../apply/target-state';
import { clearTransformDelta, createTransformDelta } from '../apply/transform-delta';
import { copyGizmoAxes, copyGizmoFrame, createGizmoFrame, type GizmoFrame } from '../gizmo/gizmo-frame';
import type { GizmoHandle, GizmoLayout } from '../gizmo/gizmo-handle';
import type { GizmoPointer } from '../gizmo/gizmo-pointer';
import type { TransformTargets } from '../selection/transform-targets';
import type { SnapTargets } from '../snap/snap-targets';
import type { PivotMode, SnapTarget } from '../transform-settings';
import { createManipulation } from './create-manipulation';
import type { DragEnvironment, HandleManipulation } from './handle-manipulation';
export interface GizmoDragRequest {
    readonly camera: PerspectiveCamera;
    readonly frame: GizmoFrame;
    readonly handle: GizmoHandle;
    readonly targets: TransformTargets;
    readonly pivotMode: PivotMode;
    readonly pointer: GizmoPointer;
    readonly snapTargets: SnapTargets;
}
export interface SnapSource {
    readonly enabled: boolean;
    readonly target: SnapTarget;
    readonly translate: number;
    readonly rotate: number;
    readonly scale: number;
}
export class GizmoDrag {
    private readonly delta = createTransformDelta();
    private constructor(readonly handleId: string, private readonly environment: DragEnvironment, private readonly manipulation: HandleManipulation, private readonly states: readonly TargetState[], pivotMode: PivotMode) {
        const { frame } = environment;
        vec3.copy(this.delta.pivot, frame.origin);
        copyGizmoAxes(this.delta.scaleAxes, frame.axes);
        this.delta.sharedPivot = pivotMode === 'center';
    }
    static begin({ camera, frame, handle, targets, pivotMode, pointer, snapTargets }: GizmoDragRequest): GizmoDrag | null {
        const ray = createRay();
        if (!buildPickRay(ray, camera, pointer.x / pointer.width, pointer.y / pointer.height))
            return null;
        const environment: DragEnvironment = {
            camera,
            frame: copyGizmoFrame(createGizmoFrame(), frame),
            ray,
            snap: { active: false, target: 'increment', translate: 0, rotate: 0, scale: 0 },
            snapTargets,
        };
        const manipulation = createManipulation(handle, environment, pointer);
        if (!manipulation)
            return null;
        return new GizmoDrag(handle.id, environment, manipulation, targets.entities.map(captureTargetState), pivotMode);
    }
    get frame(): GizmoFrame {
        return this.environment.frame;
    }
    get verb(): string {
        return this.manipulation.verb;
    }
    get readout(): string {
        return this.manipulation.readout();
    }
    update(pointer: GizmoPointer, snap: SnapSource): void {
        const { camera, ray, snap: steps } = this.environment;
        if (!buildPickRay(ray, camera, pointer.x / pointer.width, pointer.y / pointer.height))
            return;
        steps.active = snap.enabled !== pointer.ctrl;
        steps.target = snap.target;
        steps.translate = snap.translate;
        steps.rotate = snap.rotate;
        steps.scale = snap.scale;
        clearTransformDelta(this.delta);
        this.manipulation.update(this.delta, pointer);
        for (const state of this.states)
            applyTransformDelta(state, this.delta);
    }
    decorate(layout: GizmoLayout): void {
        this.manipulation.decorate?.(layout);
    }
    restore(): void {
        for (const state of this.states)
            restoreTargetState(state);
    }
    changes(): TransformChange[] {
        return collectTargetChanges(this.states);
    }
}
