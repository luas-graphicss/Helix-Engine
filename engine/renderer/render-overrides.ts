import type { Entity } from '@/engine/core/scene/entity';
export interface EntityLodOverride {
    enabled: boolean;
    bias: number;
}
const lodOverrides = new WeakMap<Entity, EntityLodOverride>();
const myriadDisabled = new WeakSet<Entity>();
const lodGroupPreviews = new WeakMap<Entity, number>();
export function setEntityLodOverride(entity: Entity, override: EntityLodOverride | null): void {
    if (override)
        lodOverrides.set(entity, override);
    else
        lodOverrides.delete(entity);
}
export function entityLodOverride(entity: Entity): EntityLodOverride | null {
    return lodOverrides.get(entity) ?? null;
}
export function setEntityMyriadEnabled(entity: Entity, enabled: boolean): void {
    if (enabled)
        myriadDisabled.delete(entity);
    else
        myriadDisabled.add(entity);
}
export function isEntityMyriadEnabled(entity: Entity): boolean {
    return !myriadDisabled.has(entity);
}
export function setLodGroupPreview(group: Entity, level: number | null): void {
    if (level === null)
        lodGroupPreviews.delete(group);
    else
        lodGroupPreviews.set(group, Math.max(0, Math.floor(level)));
}
export function lodGroupPreview(group: Entity): number | null {
    return lodGroupPreviews.get(group) ?? null;
}
