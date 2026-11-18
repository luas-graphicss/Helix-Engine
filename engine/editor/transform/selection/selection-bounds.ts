import * as aabb from '@/engine/core/math/aabb';
import * as mat4 from '@/engine/core/math/mat4';
import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { Entity } from '@/engine/core/scene/entity';
import { getEntityLocalBounds } from '@/engine/renderer/geometry/bounds';
import { AXIS_INDICES, type GizmoAxes } from '../gizmo/gizmo-frame';
export interface OrientedBounds {
    readonly center: Vec3;
    readonly halfExtents: Vec3;
}
const CORNER_COUNT = 8;
const corner = vec3.create();
const relative = vec3.create();
const lowest = vec3.create();
const highest = vec3.create();
export function createOrientedBounds(): OrientedBounds {
    return { center: vec3.create(), halfExtents: vec3.create() };
}
function includeSubtree(entity: Entity, origin: Vec3, axes: GizmoAxes): boolean {
    const local = getEntityLocalBounds(entity);
    let found = local !== null && !aabb.isEmpty(local);
    if (local && found) {
        for (let index = 0; index < CORNER_COUNT; index++) {
            vec3.set(corner, index & 1 ? local.max[0] : local.min[0], index & 2 ? local.max[1] : local.min[1], index & 4 ? local.max[2] : local.min[2]);
            mat4.transformPoint(relative, entity.worldMatrix, corner);
            vec3.subtract(relative, relative, origin);
            for (const axis of AXIS_INDICES) {
                const coordinate = vec3.dot(relative, axes[axis]);
                lowest[axis] = Math.min(lowest[axis], coordinate);
                highest[axis] = Math.max(highest[axis], coordinate);
            }
        }
    }
    for (const child of entity.children) {
        if (includeSubtree(child, origin, axes))
            found = true;
    }
    return found;
}
export function computeOrientedBounds(out: OrientedBounds, entities: readonly Entity[], origin: Vec3, axes: GizmoAxes): boolean {
    vec3.set(lowest, Infinity, Infinity, Infinity);
    vec3.set(highest, -Infinity, -Infinity, -Infinity);
    let found = false;
    for (const entity of entities) {
        if (includeSubtree(entity, origin, axes))
            found = true;
    }
    if (!found)
        return false;
    vec3.copy(out.center, origin);
    for (const axis of AXIS_INDICES) {
        vec3.scaleAndAdd(out.center, out.center, axes[axis], (lowest[axis] + highest[axis]) / 2);
        out.halfExtents[axis] = (highest[axis] - lowest[axis]) / 2;
    }
    return true;
}
