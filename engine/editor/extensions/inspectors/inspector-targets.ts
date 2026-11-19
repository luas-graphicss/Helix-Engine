import type { Entity } from '@/engine/core/scene/entity';
import { matchesEntity, type EntityFilter } from '../targeting/entity-filter';
export interface InspectorScope extends EntityFilter {
    readonly multiple: boolean;
}
export function inspectorTargets(inspector: InspectorScope, selection: readonly Entity[]): Entity[] {
    if (selection.length > 1 && !inspector.multiple)
        return [];
    return selection.filter((entity) => matchesEntity(inspector, entity));
}
export function sortInspectors<TInspector extends {
    readonly order: number;
}>(inspectors: readonly TInspector[]): TInspector[] {
    return inspectors.slice().sort((a, b) => a.order - b.order);
}
