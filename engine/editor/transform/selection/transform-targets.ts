import type { Entity } from '@/engine/core/scene/entity';
import type { Scene } from '@/engine/core/scene/scene';
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
export function collectSubtrees(scene: Scene, roots: readonly Entity[]): Entity[] {
    const members: Entity[] = [];
    for (const root of roots)
        scene.traverse((entity) => members.push(entity), root);
    return members;
}
