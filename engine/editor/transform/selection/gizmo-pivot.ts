import * as mat4 from '@/engine/core/math/mat4';
import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { Entity } from '@/engine/core/scene/entity';
import { AXIS_INDICES, createGizmoAxes, type GizmoAxes } from '../gizmo/gizmo-frame';
import type { PivotMode, TransformSpace } from '../transform-settings';
import { entityWorldAxes } from './entity-axes';
import { computeOrientedBounds, createOrientedBounds } from './selection-bounds';
import type { TransformTargets } from './transform-targets';
const WORLD_AXES = createGizmoAxes();
const WORLD_ORIGIN = vec3.create();
const bounds = createOrientedBounds();
export function resolveGizmoAxes(out: GizmoAxes, active: Entity, space: TransformSpace): GizmoAxes {
    if (space === 'local')
        return entityWorldAxes(out, active);
    for (const axis of AXIS_INDICES)
        vec3.copy(out[axis], WORLD_AXES[axis]);
    return out;
}
export function resolveGizmoOrigin(out: Vec3, targets: TransformTargets, pivotMode: PivotMode): Vec3 {
    if (pivotMode === 'pivot')
        return mat4.getTranslation(out, targets.active.worldMatrix);
    if (computeOrientedBounds(bounds, targets.entities, WORLD_ORIGIN, WORLD_AXES))
        return vec3.copy(out, bounds.center);
    vec3.set(out, 0, 0, 0);
    for (const entity of targets.entities) {
        out[0] += entity.worldMatrix[12];
        out[1] += entity.worldMatrix[13];
        out[2] += entity.worldMatrix[14];
    }
    return vec3.scale(out, out, 1 / targets.entities.length);
}
