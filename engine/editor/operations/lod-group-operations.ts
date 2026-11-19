import * as aabb from '@/engine/core/math/aabb';
import { maxAxisScale } from '@/engine/core/math/mat4';
import type { Entity } from '@/engine/core/scene/entity';
import { computeWorldBounds } from '@/engine/renderer/geometry/bounds';
import { cloneLodGroupSettings, createLodGroupSettings, normalizeLodGroupSettings, resizeLodGroupLevels, type LodGroupSettings } from '@/engine/renderer/lod/groups/lod-group-settings';
import { setLodGroupPreview } from '@/engine/renderer/render-overrides';
import { SetValueCommand } from '@/engine/editor/commands/set-value-command';
import type { EditorSession } from '@/engine/editor/session/editor-session';
const MIN_SCALE = 1e-6;
const EMPTY_GROUP_RADIUS = 1;
function measureRadius(session: EditorSession, group: Entity): number {
    session.scene.updateWorldMatrices();
    const bounds = computeWorldBounds(session.scene, group);
    if (aabb.isEmpty(bounds))
        return EMPTY_GROUP_RADIUS;
    const matrix = group.worldMatrix;
    let squared = 0;
    for (let axis = 0; axis < 3; axis++) {
        const origin = matrix[12 + axis];
        const reach = Math.max(Math.abs(bounds.min[axis] - origin), Math.abs(bounds.max[axis] - origin));
        squared += reach * reach;
    }
    return Math.sqrt(squared) / Math.max(maxAxisScale(matrix), MIN_SCALE);
}
function applyLodGroup(session: EditorSession, group: Entity, label: string, next: LodGroupSettings | null, mergeKey?: string): void {
    session.history.execute(new SetValueCommand<LodGroupSettings | null>(label, (value) => {
        group.lodGroup = value;
    }, group.lodGroup, next, mergeKey));
}
export function createLodGroup(session: EditorSession, group: Entity): void {
    if (group.lodGroup || group.children.length === 0)
        return;
    applyLodGroup(session, group, 'Criar grupo de LOD', createLodGroupSettings(group.children.length, measureRadius(session, group)));
}
export function removeLodGroup(session: EditorSession, group: Entity): void {
    if (!group.lodGroup)
        return;
    setLodGroupPreview(group, null);
    applyLodGroup(session, group, 'Remover grupo de LOD', null);
}
export function setLodGroupScreenHeight(session: EditorSession, group: Entity, level: number, screenHeight: number): void {
    const current = group.lodGroup;
    if (!current || level < 0 || level >= current.screenHeights.length || !Number.isFinite(screenHeight))
        return;
    const edited = cloneLodGroupSettings(current);
    const floor = edited.screenHeights[level + 1] ?? 0;
    edited.screenHeights[level] = Math.max(screenHeight, floor);
    const next = normalizeLodGroupSettings(edited);
    if (next.screenHeights[level] === current.screenHeights[level])
        return;
    applyLodGroup(session, group, 'Transição de LOD', next, `lod-group:${group.id}:${level}`);
}
export function syncLodGroupLevels(session: EditorSession, group: Entity): void {
    const current = group.lodGroup;
    if (!current || current.screenHeights.length === group.children.length)
        return;
    applyLodGroup(session, group, 'Atualizar níveis do grupo de LOD', resizeLodGroupLevels(current, group.children.length));
}
export function fitLodGroupRadius(session: EditorSession, group: Entity): void {
    const current = group.lodGroup;
    if (!current)
        return;
    const radius = measureRadius(session, group);
    if (radius === current.radius)
        return;
    applyLodGroup(session, group, 'Recalcular limites do grupo de LOD', { ...cloneLodGroupSettings(current), radius });
}
export function previewLodGroupLevel(session: EditorSession, group: Entity, level: number | null): void {
    setLodGroupPreview(group, level);
    session.notify('view');
}
