import type { Entity } from '@/engine/core/scene/entity';
import { matchesEntity } from '../targeting/entity-filter';
import type { GizmoContribution } from './gizmo-contribution';
import type { GizmoPainter } from './gizmo-painter';
export interface GizmoScene {
    readonly selection: readonly Entity[];
    isSelected(entity: Entity): boolean;
    forEachVisibleActor(visit: (entity: Entity) => void): void;
}
function paintActor(gizmos: readonly GizmoContribution[], entity: Entity, selected: boolean, painter: GizmoPainter): void {
    for (const gizmo of gizmos) {
        if (painter.isFull)
            return;
        if ((gizmo.visibility === 'selected' && !selected) || !matchesEntity(gizmo, entity))
            continue;
        painter.resetStyle();
        gizmo.paintActor(painter, entity, selected);
    }
}
export function paintGizmos(gizmos: readonly GizmoContribution[], scene: GizmoScene, painter: GizmoPainter): void {
    for (const gizmo of gizmos) {
        painter.resetStyle();
        gizmo.paintScene(painter);
    }
    const actorGizmos = gizmos.filter((gizmo) => gizmo.drawsActors);
    if (actorGizmos.length === 0)
        return;
    if (actorGizmos.some((gizmo) => gizmo.visibility === 'always')) {
        scene.forEachVisibleActor((entity) => paintActor(actorGizmos, entity, scene.isSelected(entity), painter));
        return;
    }
    for (const entity of scene.selection)
        if (entity.visible)
            paintActor(actorGizmos, entity, true, painter);
}
