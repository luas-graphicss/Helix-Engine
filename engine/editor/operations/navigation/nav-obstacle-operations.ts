import * as vec3 from '@/engine/core/math/vec3';
import type { Entity } from '@/engine/core/scene/entity';
import { createMaterial } from '@/engine/core/scene/material';
import { getPrimitive } from '@/engine/editor/primitives/primitive-catalog';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { clampNavObstacleCenter, clampNavObstacleScalar, clampNavObstacleSize, createNavObstacleSettings, type NavObstacleFlag, type NavObstacleScalar, type NavObstacleSettings, type NavObstacleShape } from '@/engine/navigation/obstacle/nav-obstacle-settings';
import { getLocalBounds } from '@/engine/renderer/geometry/bounds';
import { addEntity, spawnPosition } from '../entity-operations';
import { canHostNavigation, navComponentCommand, withAxis } from './nav-component-command';
export type NavObstacleVectorPart = 'center' | 'size';
const OBSTACLE_NAME = 'Obstáculo';
const OBSTACLE_COLOR = vec3.create(0.85, 0.45, 0.25);
const OBSTACLE_ROUGHNESS = 0.7;
const SCALAR_LABEL: Record<NavObstacleScalar, string> = {
    moveThreshold: 'Limiar de movimento do obstáculo',
    timeToStationary: 'Tempo até o obstáculo parar',
};
const FLAG_LABEL: Record<NavObstacleFlag, string> = {
    carve: 'Recorte do obstáculo no NavMesh',
    carveOnlyStationary: 'Recorte só com o obstáculo parado',
};
const SHAPE_LABEL: Record<NavObstacleShape, string> = {
    box: 'Obstáculo em caixa',
    capsule: 'Obstáculo em cápsula',
};
const VECTOR_LABEL: Record<NavObstacleVectorPart, string> = {
    center: 'Centro do obstáculo',
    size: 'Tamanho do obstáculo',
};
function fittedBox(entity: Entity): Partial<NavObstacleSettings> {
    if (!entity.mesh)
        return {};
    const { min, max } = getLocalBounds(entity.mesh);
    const center = vec3.create();
    const size = vec3.create();
    for (let axis = 0; axis < 3; axis++) {
        center[axis] = clampNavObstacleCenter((min[axis] + max[axis]) / 2);
        size[axis] = clampNavObstacleSize(max[axis] - min[axis]);
    }
    return { center, size };
}
export function addNavObstacleActor(session: EditorSession): Entity {
    const mesh = getPrimitive('box').create();
    const entity = session.scene.createEntity({ name: OBSTACLE_NAME, kind: 'mesh', mesh, material: createMaterial({ baseColor: OBSTACLE_COLOR, roughness: OBSTACLE_ROUGHNESS }) }, null);
    entity.navObstacle = createNavObstacleSettings(fittedBox(entity));
    vec3.copy(entity.transform.position, spawnPosition(session, mesh));
    return addEntity(session, entity);
}
export function canAddNavObstacle(entity: Entity): boolean {
    return canHostNavigation(entity) && !entity.navObstacle && !entity.navAgent && !entity.navSurface;
}
export function addNavObstacle(session: EditorSession, entity: Entity): void {
    if (canAddNavObstacle(entity))
        session.history.execute(navComponentCommand(entity, 'navObstacle', `Adicionar NavMesh Obstacle a ${entity.name}`, createNavObstacleSettings(fittedBox(entity))));
}
export function removeNavObstacle(session: EditorSession, entity: Entity): void {
    if (entity.navObstacle)
        session.history.execute(navComponentCommand(entity, 'navObstacle', `Remover NavMesh Obstacle de ${entity.name}`, null));
}
export function fitNavObstacleToMesh(session: EditorSession, entity: Entity): void {
    const current = entity.navObstacle;
    if (current && entity.mesh)
        session.history.execute(navComponentCommand(entity, 'navObstacle', `Ajustar obstáculo à malha de ${entity.name}`, { ...current, ...fittedBox(entity) }));
}
export function setNavObstacleShape(session: EditorSession, entity: Entity, shape: NavObstacleShape): void {
    const current = entity.navObstacle;
    if (current && current.shape !== shape)
        session.history.execute(navComponentCommand(entity, 'navObstacle', SHAPE_LABEL[shape], { ...current, shape }));
}
export function setNavObstacleVector(session: EditorSession, entity: Entity, part: NavObstacleVectorPart, axis: number, value: number): void {
    const current = entity.navObstacle;
    if (!current || !Number.isFinite(value))
        return;
    const clamped = part === 'size' ? clampNavObstacleSize(value) : clampNavObstacleCenter(value);
    if (clamped !== current[part][axis])
        session.history.execute(navComponentCommand(entity, 'navObstacle', VECTOR_LABEL[part], { ...current, [part]: withAxis(current[part], axis, clamped) }, `navObstacle:${entity.id}:${part}:${axis}`));
}
export function setNavObstacleFlag(session: EditorSession, entity: Entity, flag: NavObstacleFlag, value: boolean): void {
    const current = entity.navObstacle;
    if (current && current[flag] !== value)
        session.history.execute(navComponentCommand(entity, 'navObstacle', FLAG_LABEL[flag], { ...current, [flag]: value }));
}
export function setNavObstacleScalar(session: EditorSession, entity: Entity, key: NavObstacleScalar, value: number): void {
    const current = entity.navObstacle;
    if (!current || !Number.isFinite(value))
        return;
    const clamped = clampNavObstacleScalar(key, value);
    if (clamped !== current[key])
        session.history.execute(navComponentCommand(entity, 'navObstacle', SCALAR_LABEL[key], { ...current, [key]: clamped }, `navObstacle:${entity.id}:${key}`));
}
