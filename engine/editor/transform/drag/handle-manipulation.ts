import type { Ray } from '@/engine/core/math/ray';
import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import type { TransformDelta } from '../apply/transform-delta';
import type { GizmoFrame } from '../gizmo/gizmo-frame';
import type { GizmoLayout } from '../gizmo/gizmo-handle';
import type { GizmoPointer } from '../gizmo/gizmo-pointer';
import type { SnapTargets } from '../snap/snap-targets';
import type { SnapTarget } from '../transform-settings';
export interface SnapSteps {
    active: boolean;
    target: SnapTarget;
    translate: number;
    rotate: number;
    scale: number;
}
export interface DragEnvironment {
    readonly camera: PerspectiveCamera;
    readonly frame: GizmoFrame;
    readonly ray: Ray;
    readonly snap: SnapSteps;
    readonly snapTargets: SnapTargets;
}
export interface HandleManipulation {
    readonly verb: string;
    update(delta: TransformDelta, pointer: GizmoPointer): void;
    readout(): string;
    decorate?(layout: GizmoLayout): void;
}
