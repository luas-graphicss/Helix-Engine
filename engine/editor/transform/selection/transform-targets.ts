import type { Entity } from '@/engine/core/scene/entity';
export interface TransformTargets {
    readonly entities: readonly Entity[];
    readonly active: Entity;
}
export function resolveTransformTargets(selectionRoots: readonly Entity[], primary: Entity | null): TransformTargets | null {
    const entities = selectionRoots.filter((entity) => entity.parent !== null && !entity.locked);
    if (entities.length === 0)
        return null;
    const owner = primary ? entities.find((entity) => entity.contains(primary)) : undefined;
    return { entities, active: owner ?? entities[entities.length - 1] };
}
