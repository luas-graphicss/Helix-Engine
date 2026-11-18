import * as mat4 from '@/engine/core/math/mat4';
import type { Mat4 } from '@/engine/core/math/mat4';
import * as quat from '@/engine/core/math/quat';
import type { Quat } from '@/engine/core/math/quat';
import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { Entity } from '@/engine/core/scene/entity';
import { createGizmoAxes, type GizmoAxes } from '../gizmo/gizmo-frame';
import { entityWorldAxes } from '../selection/entity-axes';
export interface TargetState {
    readonly entity: Entity;
    readonly position: Vec3;
    readonly rotation: Vec3;
    readonly scale: Vec3;
    readonly worldPosition: Vec3;
    readonly worldAxes: GizmoAxes;
    readonly parentRotation: Quat;
    readonly parentInverse: Mat4;
}
const IDENTITY = mat4.create();
export function captureTargetState(entity: Entity): TargetState {
    const { transform } = entity;
    const parentWorld = entity.parent?.worldMatrix ?? IDENTITY;
    const parentInverse = mat4.create();
    if (!mat4.invert(parentInverse, parentWorld))
        mat4.identity(parentInverse);
    return {
        entity,
        position: vec3.copy(vec3.create(), transform.position),
        rotation: vec3.copy(vec3.create(), transform.rotation),
        scale: vec3.copy(vec3.create(), transform.scale),
        worldPosition: mat4.getTranslation(vec3.create(), entity.worldMatrix),
        worldAxes: entityWorldAxes(createGizmoAxes(), entity),
        parentRotation: quat.fromMat4Rotation(quat.create(), parentWorld),
        parentInverse,
    };
}
export function restoreTargetState(state: TargetState): void {
    const { transform } = state.entity;
    vec3.copy(transform.position, state.position);
    vec3.copy(transform.rotation, state.rotation);
    vec3.copy(transform.scale, state.scale);
}
export function hasTargetChanged(state: TargetState): boolean {
    const { transform } = state.entity;
    for (let index = 0; index < 3; index++) {
        if (transform.position[index] !== state.position[index] || transform.rotation[index] !== state.rotation[index] || transform.scale[index] !== state.scale[index])
            return true;
    }
    return false;
}
