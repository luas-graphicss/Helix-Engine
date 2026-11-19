import type { Entity } from '@/engine/core/scene/entity';
import type { Contribution } from '../registry/contribution-registry';
import type { EntityFilter } from '../targeting/entity-filter';
import type { GizmoPainter } from './gizmo-painter';
export const GIZMO_VISIBILITIES = ['always', 'selected'] as const;
export type GizmoVisibility = (typeof GIZMO_VISIBILITIES)[number];
export interface GizmoContribution extends Contribution, EntityFilter {
    readonly visibility: GizmoVisibility;
    readonly drawsActors: boolean;
    paintActor(painter: GizmoPainter, entity: Entity, selected: boolean): void;
    paintScene(painter: GizmoPainter): void;
}
