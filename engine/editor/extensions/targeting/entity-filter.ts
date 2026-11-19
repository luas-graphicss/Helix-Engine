import type { Entity, EntityKind } from '@/engine/core/scene/entity';
export interface EntityFilter {
    readonly kinds: readonly EntityKind[] | null;
    applies(entity: Entity): boolean;
}
export function matchesEntity(filter: EntityFilter, entity: Entity): boolean {
    return (filter.kinds === null || filter.kinds.includes(entity.kind)) && filter.applies(entity);
}
