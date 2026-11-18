import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import { createGizmoAxes, type GizmoAxes } from '../gizmo/gizmo-frame';
export interface TransformDelta {
    readonly translation: Vec3;
    readonly rotationAxis: Vec3;
    rotationAngle: number;
    readonly scale: Vec3;
    readonly scaleAxes: GizmoAxes;
    readonly pivot: Vec3;
    sharedPivot: boolean;
}
export function createTransformDelta(): TransformDelta {
    return {
        translation: vec3.create(),
        rotationAxis: vec3.create(0, 1, 0),
        rotationAngle: 0,
        scale: vec3.create(1, 1, 1),
        scaleAxes: createGizmoAxes(),
        pivot: vec3.create(),
        sharedPivot: false,
    };
}
export function clearTransformDelta(delta: TransformDelta): void {
    vec3.set(delta.translation, 0, 0, 0);
    delta.rotationAngle = 0;
    vec3.set(delta.scale, 1, 1, 1);
}
