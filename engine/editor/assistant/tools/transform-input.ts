import * as vec3 from '@/engine/core/math/vec3';
import type { Entity } from '@/engine/core/scene/entity';
import { snapshotTransform, type TransformField, type TransformSnapshot } from '@/engine/editor/operations/transform-operations';
import type { ToolInput } from './tool-input';
import { vector } from './tool-parameters';
const TRANSFORM_FIELDS: readonly TransformField[] = ['position', 'rotation', 'scale'];
export const POSITION_PARAMETER = vector('Position [x, y, z] in meters, relative to the parent. Y is up.');
export const ROTATION_PARAMETER = vector('Euler rotation [x, y, z] in degrees.');
export const SCALE_PARAMETER = vector('Scale [x, y, z]. 1 keeps the original size.');
export function transformFrom(entity: Entity, input: ToolInput): TransformSnapshot | null {
    const next = snapshotTransform(entity);
    let changed = false;
    for (const field of TRANSFORM_FIELDS) {
        const components = input.optionalVector(field);
        if (!components)
            continue;
        vec3.set(next[field], components[0], components[1], components[2]);
        changed = true;
    }
    return changed ? next : null;
}
