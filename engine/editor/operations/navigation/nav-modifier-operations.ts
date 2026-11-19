import * as vec3 from '@/engine/core/math/vec3';
import type { Entity } from '@/engine/core/scene/entity';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { clampAreaIndex, WALKABLE_AREA } from '@/engine/navigation/areas/nav-areas';
import { clampNavModifierOffset, clampNavModifierSize, createNavModifierSettings, type NavModifierMode } from '@/engine/navigation/modifier/nav-modifier-settings';
import { addEntity, spawnPosition } from '../entity-operations';
import { canHostNavigation, navComponentCommand, withAxis } from './nav-component-command';
export type NavModifierVectorPart = 'size' | 'center';
const VOLUME_NAME = 'Volume de área';
const MODE_LABEL: Record<NavModifierMode, string> = {
    area: 'Modificador marca a área do ator',
    ignore: 'Modificador tira o ator do NavMesh',
    volume: 'Modificador pinta a área dentro do volume',
};
const VECTOR_LABEL: Record<NavModifierVectorPart, string> = {
    size: 'Tamanho do volume de área',
    center: 'Centro do volume de área',
};
export function addNavModifierActor(session: EditorSession): Entity {
    const entity = session.scene.createEntity({ name: VOLUME_NAME, kind: 'group', navModifier: createNavModifierSettings() }, null);
    vec3.copy(entity.transform.position, spawnPosition(session, null));
    return addEntity(session, entity);
}
export function canAddNavModifier(entity: Entity): boolean {
    return canHostNavigation(entity) && !entity.navModifier && !entity.navAgent && !entity.navSurface;
}
export function addNavModifier(session: EditorSession, entity: Entity): void {
    if (!canAddNavModifier(entity))
        return;
    const settings = entity.mesh ? createNavModifierSettings({ mode: 'area', area: WALKABLE_AREA }) : createNavModifierSettings();
    session.history.execute(navComponentCommand(entity, 'navModifier', `Adicionar NavMesh Modifier a ${entity.name}`, settings));
}
export function removeNavModifier(session: EditorSession, entity: Entity): void {
    if (entity.navModifier)
        session.history.execute(navComponentCommand(entity, 'navModifier', `Remover NavMesh Modifier de ${entity.name}`, null));
}
export function setNavModifierMode(session: EditorSession, entity: Entity, mode: NavModifierMode): void {
    const current = entity.navModifier;
    if (current && current.mode !== mode)
        session.history.execute(navComponentCommand(entity, 'navModifier', MODE_LABEL[mode], { ...current, mode }));
}
export function setNavModifierArea(session: EditorSession, entity: Entity, area: number): void {
    const current = entity.navModifier;
    const clamped = clampAreaIndex(area);
    if (current && current.area !== clamped)
        session.history.execute(navComponentCommand(entity, 'navModifier', 'Área do modificador', { ...current, area: clamped }));
}
export function setNavModifierVector(session: EditorSession, entity: Entity, part: NavModifierVectorPart, axis: number, value: number): void {
    const current = entity.navModifier;
    if (!current || !Number.isFinite(value))
        return;
    const clamped = part === 'size' ? clampNavModifierSize(value) : clampNavModifierOffset(value);
    if (clamped !== current[part][axis])
        session.history.execute(navComponentCommand(entity, 'navModifier', VECTOR_LABEL[part], { ...current, [part]: withAxis(current[part], axis, clamped) }, `navModifier:${entity.id}:${part}:${axis}`));
}
