import * as vec3 from '@/engine/core/math/vec3';
import type { Entity } from '@/engine/core/scene/entity';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { clampNavLinkArea, clampNavLinkCost, clampNavLinkOffset, createNavLinkSettings, type NavLinkEndpoint, type NavLinkFlag } from '@/engine/navigation/link/nav-link-settings';
import { addEntity, spawnPosition } from '../entity-operations';
import { canHostNavigation, navComponentCommand, withAxis } from './nav-component-command';
const LINK_NAME = 'Off-Mesh Link';
const ENDPOINT_LABEL: Record<NavLinkEndpoint, string> = {
    start: 'Início do link',
    end: 'Fim do link',
};
const FLAG_LABEL: Record<NavLinkFlag, string> = {
    bidirectional: 'Sentido do link',
    enabled: 'Link ativo',
};
export function addNavLinkActor(session: EditorSession): Entity {
    const entity = session.scene.createEntity({ name: LINK_NAME, kind: 'group', navLink: createNavLinkSettings() }, null);
    vec3.copy(entity.transform.position, spawnPosition(session, null));
    return addEntity(session, entity);
}
export function canAddNavLink(entity: Entity): boolean {
    return canHostNavigation(entity) && !entity.navLink;
}
export function addNavLink(session: EditorSession, entity: Entity): void {
    if (canAddNavLink(entity))
        session.history.execute(navComponentCommand(entity, 'navLink', `Adicionar Off-Mesh Link a ${entity.name}`, createNavLinkSettings()));
}
export function removeNavLink(session: EditorSession, entity: Entity): void {
    if (entity.navLink)
        session.history.execute(navComponentCommand(entity, 'navLink', `Remover Off-Mesh Link de ${entity.name}`, null));
}
export function setNavLinkEndpoint(session: EditorSession, entity: Entity, endpoint: NavLinkEndpoint, axis: number, value: number): void {
    const current = entity.navLink;
    if (!current || !Number.isFinite(value))
        return;
    const clamped = clampNavLinkOffset(value);
    if (clamped !== current[endpoint][axis])
        session.history.execute(navComponentCommand(entity, 'navLink', ENDPOINT_LABEL[endpoint], { ...current, [endpoint]: withAxis(current[endpoint], axis, clamped) }, `navLink:${entity.id}:${endpoint}:${axis}`));
}
export function setNavLinkFlag(session: EditorSession, entity: Entity, flag: NavLinkFlag, value: boolean): void {
    const current = entity.navLink;
    if (current && current[flag] !== value)
        session.history.execute(navComponentCommand(entity, 'navLink', FLAG_LABEL[flag], { ...current, [flag]: value }));
}
export function setNavLinkArea(session: EditorSession, entity: Entity, area: number): void {
    const current = entity.navLink;
    const clamped = clampNavLinkArea(area);
    if (current && current.area !== clamped)
        session.history.execute(navComponentCommand(entity, 'navLink', 'Área do link', { ...current, area: clamped }));
}
export function setNavLinkCost(session: EditorSession, entity: Entity, cost: number): void {
    const current = entity.navLink;
    if (!current || !Number.isFinite(cost))
        return;
    const costOverride = clampNavLinkCost(cost);
    if (costOverride !== current.costOverride)
        session.history.execute(navComponentCommand(entity, 'navLink', 'Custo do link', { ...current, costOverride }, `navLink:${entity.id}:cost`));
}
