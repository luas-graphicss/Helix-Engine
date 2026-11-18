import * as vec3 from '@/engine/core/math/vec3';
import type { Entity } from '@/engine/core/scene/entity';
import { AXIS_INDICES, type GizmoAxes } from '../gizmo/gizmo-frame';
const DEGENERATE_AXIS_LENGTH = 1e-6;
export function entityWorldAxes(out: GizmoAxes, entity: Entity): GizmoAxes {
    const matrix = entity.worldMatrix;
    for (const axis of AXIS_INDICES) {
        const column = axis * 4;
        const length = Math.hypot(matrix[column], matrix[column + 1], matrix[column + 2]);
        if (length > DEGENERATE_AXIS_LENGTH)
            vec3.set(out[axis], matrix[column] / length, matrix[column + 1] / length, matrix[column + 2] / length);
        else
            vec3.set(out[axis], axis === 0 ? 1 : 0, axis === 1 ? 1 : 0, axis === 2 ? 1 : 0);
    }
    return out;
}
