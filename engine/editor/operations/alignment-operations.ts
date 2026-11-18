import type { Entity } from '@/engine/core/scene/entity';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { alignmentOffsets, applyAxisOffsets, distributionOffsets, measureAlignmentBox, type AlignEdge } from '@/engine/editor/transform/alignment/selection-alignment';
import { AXIS_LABELS, type AxisIndex } from '@/engine/editor/transform/gizmo/gizmo-frame';
import { resolveTransformTargets } from '@/engine/editor/transform/selection/transform-targets';
import { describeEntities } from './entity-operations';
import { commitTransforms } from './transform-operations';
export const MIN_ALIGNED_ACTORS = 2;
export const MIN_DISTRIBUTED_ACTORS = 3;
const EDGE_LABEL: Record<AlignEdge, string> = { min: 'mínimo', center: 'centro', max: 'máximo' };
export function alignableEntities(session: EditorSession): readonly Entity[] {
    return resolveTransformTargets(session.selectionRoots(), session.selectedEntity)?.entities ?? [];
}
export function alignSelected(session: EditorSession, axis: AxisIndex, edge: AlignEdge): void {
    const targets = resolveTransformTargets(session.selectionRoots(), session.selectedEntity);
    if (!targets || targets.entities.length < MIN_ALIGNED_ACTORS)
        return;
    session.scene.updateWorldMatrices();
    const boxes = targets.entities.map((entity) => measureAlignmentBox(session.scene, entity));
    const reference = boxes[targets.entities.indexOf(targets.active)];
    const changes = applyAxisOffsets(boxes, alignmentOffsets(boxes, reference, axis, edge), axis);
    if (changes.length === 0)
        return;
    const moved = changes.map((change) => change.entity);
    commitTransforms(session, changes, `Alinhar ${describeEntities(moved)} a ${targets.active.name} em ${AXIS_LABELS[axis]} (${EDGE_LABEL[edge]})`);
}
export function distributeSelected(session: EditorSession, axis: AxisIndex): void {
    const entities = alignableEntities(session);
    if (entities.length < MIN_DISTRIBUTED_ACTORS)
        return;
    session.scene.updateWorldMatrices();
    const boxes = entities.map((entity) => measureAlignmentBox(session.scene, entity));
    const changes = applyAxisOffsets(boxes, distributionOffsets(boxes, axis), axis);
    if (changes.length > 0)
        commitTransforms(session, changes, `Distribuir ${entities.length} atores em ${AXIS_LABELS[axis]}`);
}
