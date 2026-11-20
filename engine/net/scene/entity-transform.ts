import * as quat from '@/engine/core/math/quat';
import * as vec3 from '@/engine/core/math/vec3';
import type { Entity } from '@/engine/core/scene/entity';
import type { TransformState } from '../sync/transform-state';
const rotation = quat.create();
const previousEuler = vec3.create(0, 0, 0);
export function readEntityTransform(entity: Entity, target: TransformState): TransformState {
    const { transform } = entity;
    quat.fromEulerDegrees(rotation, transform.rotation);
    for (let axis = 0; axis < 3; axis++) {
        target.position[axis] = transform.position[axis];
        target.scale[axis] = transform.scale[axis];
    }
    for (let component = 0; component < 4; component++)
        target.rotation[component] = rotation[component];
    return target;
}
export function writeEntityTransform(entity: Entity, source: TransformState, includeScale: boolean): void {
    const { transform } = entity;
    for (let axis = 0; axis < 3; axis++) {
        transform.position[axis] = source.position[axis];
        if (includeScale)
            transform.scale[axis] = source.scale[axis];
    }
    quat.set(rotation, source.rotation[0], source.rotation[1], source.rotation[2], source.rotation[3]);
    vec3.copy(previousEuler, transform.rotation);
    quat.toEulerDegreesNear(transform.rotation, rotation, previousEuler);
}
