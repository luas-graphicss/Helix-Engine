import * as vec3 from '@/engine/core/math/vec3';
import type { Entity } from '@/engine/core/scene/entity';
import { createMaterial } from '@/engine/core/scene/material';
import { getPrimitive } from '@/engine/editor/primitives/primitive-catalog';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { clampNavAgentScalar, createNavAgentSettings, type NavAgentScalar, type NavAgentSettings, type NavAvoidanceQuality } from '@/engine/navigation/agent/nav-agent-settings';
import { areaBit } from '@/engine/navigation/areas/nav-areas';
import { getLocalBounds } from '@/engine/renderer/geometry/bounds';
import { addEntity, spawnPosition } from '../entity-operations';
import { canHostNavigation, navComponentCommand } from './nav-component-command';
const AGENT_NAME = 'Agente';
const AGENT_COLOR = vec3.create(0.35, 0.75, 0.5);
const AGENT_ROUGHNESS = 0.6;
const SCALAR_LABEL: Record<NavAgentScalar, string> = {
    speed: 'Velocidade do agente',
    angularSpeed: 'Velocidade de giro do agente',
    acceleration: 'Aceleração do agente',
    stoppingDistance: 'Distância de parada do agente',
    radius: 'Raio do agente',
    height: 'Altura do agente',
    baseOffset: 'Base do agente',
    avoidancePriority: 'Prioridade de desvio do agente',
};
const AVOIDANCE_LABEL: Record<NavAvoidanceQuality, string> = {
    none: 'Agente sem desvio',
    low: 'Desvio do agente em qualidade baixa',
    medium: 'Desvio do agente em qualidade média',
    high: 'Desvio do agente em qualidade alta',
};
function fittedShape(entity: Entity): Partial<NavAgentSettings> {
    if (!entity.mesh)
        return {};
    const { min, max } = getLocalBounds(entity.mesh);
    const { scale } = entity.transform;
    const width = Math.max((max[0] - min[0]) * scale[0], (max[2] - min[2]) * scale[2]);
    return {
        radius: clampNavAgentScalar('radius', width / 2),
        height: clampNavAgentScalar('height', (max[1] - min[1]) * scale[1]),
        baseOffset: clampNavAgentScalar('baseOffset', -min[1] * scale[1]),
    };
}
export function addNavAgentActor(session: EditorSession): Entity {
    const mesh = getPrimitive('capsule').create();
    const entity = session.scene.createEntity({ name: AGENT_NAME, kind: 'mesh', mesh, material: createMaterial({ baseColor: AGENT_COLOR, roughness: AGENT_ROUGHNESS }) }, null);
    entity.navAgent = createNavAgentSettings(fittedShape(entity));
    vec3.copy(entity.transform.position, spawnPosition(session, mesh));
    return addEntity(session, entity);
}
export function canAddNavAgent(entity: Entity): boolean {
    const isFree = !entity.navAgent && !entity.navSurface && !entity.navObstacle && !entity.vehicle && !entity.cloth;
    return canHostNavigation(entity) && isFree && entity.rigidBody?.type !== 'dynamic';
}
export function addNavAgent(session: EditorSession, entity: Entity): void {
    if (canAddNavAgent(entity))
        session.history.execute(navComponentCommand(entity, 'navAgent', `Adicionar NavMesh Agent a ${entity.name}`, createNavAgentSettings(fittedShape(entity))));
}
export function removeNavAgent(session: EditorSession, entity: Entity): void {
    if (entity.navAgent)
        session.history.execute(navComponentCommand(entity, 'navAgent', `Remover NavMesh Agent de ${entity.name}`, null));
}
export function setNavAgentScalar(session: EditorSession, entity: Entity, key: NavAgentScalar, value: number): void {
    const current = entity.navAgent;
    if (!current || !Number.isFinite(value))
        return;
    const clamped = clampNavAgentScalar(key, value);
    if (clamped !== current[key])
        session.history.execute(navComponentCommand(entity, 'navAgent', SCALAR_LABEL[key], { ...current, [key]: clamped }, `navAgent:${entity.id}:${key}`));
}
export function setNavAgentAvoidance(session: EditorSession, entity: Entity, avoidance: NavAvoidanceQuality): void {
    const current = entity.navAgent;
    if (current && current.avoidance !== avoidance)
        session.history.execute(navComponentCommand(entity, 'navAgent', AVOIDANCE_LABEL[avoidance], { ...current, avoidance }));
}
export function setNavAgentAutoBraking(session: EditorSession, entity: Entity, autoBraking: boolean): void {
    const current = entity.navAgent;
    if (current && current.autoBraking !== autoBraking)
        session.history.execute(navComponentCommand(entity, 'navAgent', 'Frenagem automática do agente', { ...current, autoBraking }));
}
export function setNavAgentArea(session: EditorSession, entity: Entity, area: number, isAllowed: boolean): void {
    const current = entity.navAgent;
    if (!current)
        return;
    const areaMask = isAllowed ? current.areaMask | areaBit(area) : current.areaMask & ~areaBit(area);
    if (areaMask !== current.areaMask)
        session.history.execute(navComponentCommand(entity, 'navAgent', 'Áreas do agente', { ...current, areaMask }));
}
export function setNavAgentTarget(session: EditorSession, entity: Entity, target: number | null): void {
    const current = entity.navAgent;
    if (!current || current.target === target || target === entity.id)
        return;
    const targetName = target === null ? null : session.scene.findById(target)?.name;
    session.history.execute(navComponentCommand(entity, 'navAgent', targetName ? `Destino do agente: ${targetName}` : 'Agente sem destino fixo', { ...current, target }));
}
