import * as vec3 from '@/engine/core/math/vec3';
import type { Entity } from '@/engine/core/scene/entity';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { clampBakedArea, clampNavSurfaceScalar, clampNavVolumeOffset, clampNavVolumeSize, createNavSurfaceSettings, type NavCollectMode, type NavSurfaceScalar } from '@/engine/navigation/surface/nav-surface-settings';
import { addEntity, spawnPosition } from '../entity-operations';
import { canHostNavigation, navComponentCommand, withAxis } from './nav-component-command';
export type NavSurfaceVolumePart = 'volumeSize' | 'volumeCenter';
const SURFACE_NAME = 'NavMesh Surface';
const SCALAR_LABEL: Record<NavSurfaceScalar, string> = {
    agentRadius: 'Raio do agente do NavMesh',
    agentHeight: 'Altura do agente do NavMesh',
    maxSlope: 'Rampa máxima do NavMesh',
    stepHeight: 'Degrau máximo do NavMesh',
    cellSize: 'Tamanho da célula do NavMesh',
    minRegionArea: 'Região mínima do NavMesh',
};
const COLLECT_LABEL: Record<NavCollectMode, string> = {
    scene: 'NavMesh coleta a cena inteira',
    children: 'NavMesh coleta só os filhos',
    volume: 'NavMesh coleta dentro do volume',
};
const VOLUME_LABEL: Record<NavSurfaceVolumePart, string> = {
    volumeSize: 'Tamanho do volume do NavMesh',
    volumeCenter: 'Centro do volume do NavMesh',
};
export function addNavSurfaceActor(session: EditorSession): Entity {
    const entity = session.scene.createEntity({ name: SURFACE_NAME, kind: 'group', navSurface: createNavSurfaceSettings() }, null);
    vec3.copy(entity.transform.position, spawnPosition(session, null));
    return addEntity(session, entity);
}
export function canAddNavSurface(entity: Entity): boolean {
    return canHostNavigation(entity) && !entity.navSurface && !entity.navAgent;
}
export function addNavSurface(session: EditorSession, entity: Entity): void {
    if (canAddNavSurface(entity))
        session.history.execute(navComponentCommand(entity, 'navSurface', `Adicionar NavMesh Surface a ${entity.name}`, createNavSurfaceSettings()));
}
export function removeNavSurface(session: EditorSession, entity: Entity): void {
    if (!entity.navSurface)
        return;
    session.navigation.clear(entity);
    session.history.execute(navComponentCommand(entity, 'navSurface', `Remover NavMesh Surface de ${entity.name}`, null));
}
export function setNavSurfaceScalar(session: EditorSession, entity: Entity, key: NavSurfaceScalar, value: number): void {
    const current = entity.navSurface;
    if (!current || !Number.isFinite(value))
        return;
    const clamped = clampNavSurfaceScalar(key, value);
    if (clamped !== current[key])
        session.history.execute(navComponentCommand(entity, 'navSurface', SCALAR_LABEL[key], { ...current, [key]: clamped }, `navSurface:${entity.id}:${key}`));
}
export function setNavSurfaceCollect(session: EditorSession, entity: Entity, collect: NavCollectMode): void {
    const current = entity.navSurface;
    if (current && current.collect !== collect)
        session.history.execute(navComponentCommand(entity, 'navSurface', COLLECT_LABEL[collect], { ...current, collect }));
}
export function setNavSurfaceVolume(session: EditorSession, entity: Entity, part: NavSurfaceVolumePart, axis: number, value: number): void {
    const current = entity.navSurface;
    if (!current || !Number.isFinite(value))
        return;
    const clamped = part === 'volumeSize' ? clampNavVolumeSize(value) : clampNavVolumeOffset(value);
    if (clamped !== current[part][axis])
        session.history.execute(navComponentCommand(entity, 'navSurface', VOLUME_LABEL[part], { ...current, [part]: withAxis(current[part], axis, clamped) }, `navSurface:${entity.id}:${part}:${axis}`));
}
export function setNavSurfaceDefaultArea(session: EditorSession, entity: Entity, area: number): void {
    const current = entity.navSurface;
    const clamped = clampBakedArea(area);
    if (current && current.defaultArea !== clamped)
        session.history.execute(navComponentCommand(entity, 'navSurface', 'Área padrão do NavMesh', { ...current, defaultArea: clamped }));
}
