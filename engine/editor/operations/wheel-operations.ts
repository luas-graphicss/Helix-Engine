import * as vec3 from '@/engine/core/math/vec3';
import type { Entity } from '@/engine/core/scene/entity';
import { SetValueCommand } from '@/engine/editor/commands/set-value-command';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { getLocalBounds } from '@/engine/renderer/geometry/bounds';
import { createWheelActor } from '@/engine/vehicle/assembly/wheel-actor';
import { findVehicleAncestor } from '@/engine/vehicle/vehicle-hierarchy';
import { clampWheelFrictionField, type WheelFrictionField } from '@/engine/vehicle/wheel/wheel-friction';
import { clampWheelScalar, createWheelSettings, type WheelFrictionAxis, type WheelRole, type WheelScalar, type WheelSettings } from '@/engine/vehicle/wheel/wheel-settings';
import { addEntity } from './entity-operations';
const SCALAR_LABEL: Record<WheelScalar, string> = {
    radius: 'Raio da roda',
    mass: 'Massa da roda',
    suspensionTravel: 'Curso da suspensão',
    suspensionFrequency: 'Rigidez da suspensão',
    suspensionDamping: 'Amortecimento da suspensão',
};
const ROLE_LABEL: Record<WheelRole, readonly [string, string]> = {
    steering: ['Roda deixa de esterçar', 'Roda passa a esterçar'],
    driven: ['Roda deixa de tracionar', 'Roda passa a tracionar'],
    handbrake: ['Roda sem freio de mão', 'Roda com freio de mão'],
};
const FRICTION_AXIS_LABEL: Record<WheelFrictionAxis, string> = {
    forwardFriction: 'longitudinal',
    sidewaysFriction: 'lateral',
};
const FRICTION_FIELD_LABEL: Record<WheelFrictionField, string> = {
    extremumSlip: 'Limite de escorregamento',
    extremumValue: 'Aderência de pico',
    asymptoteSlip: 'Escorregamento de deslize',
    asymptoteValue: 'Aderência deslizando',
    stiffness: 'Aderência',
};
const NEW_WHEEL_WIDTH = 0.24;
const DEFAULT_MOUNT_OFFSET = 0.5;
function applyWheel(session: EditorSession, entity: Entity, label: string, next: WheelSettings | null, mergeKey?: string): void {
    session.history.execute(new SetValueCommand<WheelSettings | null>(label, (value) => {
        entity.wheel = value;
    }, entity.wheel, next, mergeKey));
}
function worldAxisScale(entity: Entity, axis: number): number {
    const matrix = entity.worldMatrix;
    return Math.hypot(matrix[axis * 4], matrix[axis * 4 + 1], matrix[axis * 4 + 2]);
}
function meshRadius(entity: Entity): number | null {
    if (!entity.mesh)
        return null;
    const { min, max } = getLocalBounds(entity.mesh);
    const diameter = Math.max((max[0] - min[0]) * worldAxisScale(entity, 0), (max[1] - min[1]) * worldAxisScale(entity, 1), (max[2] - min[2]) * worldAxisScale(entity, 2));
    return diameter > 0 ? clampWheelScalar('radius', diameter * 0.5) : null;
}
export function canBecomeWheel(entity: Entity): boolean {
    const isPlainActor = (entity.kind === 'mesh' || entity.kind === 'group') && !entity.wheel && !entity.vehicle && !entity.rigidBody && !entity.cloth;
    return isPlainActor && findVehicleAncestor(entity) !== null;
}
export function addWheelActor(session: EditorSession, vehicle: Entity): Entity | null {
    if (!vehicle.vehicle)
        return null;
    const bounds = vehicle.mesh ? getLocalBounds(vehicle.mesh) : null;
    const position = vec3.create(bounds?.max[0] ?? DEFAULT_MOUNT_OFFSET, bounds ? bounds.min[1] : -DEFAULT_MOUNT_OFFSET, 0);
    const wheel = createWheelActor(session.scene, null, { name: 'Roda', settings: createWheelSettings(), width: NEW_WHEEL_WIDTH, position });
    return addEntity(session, wheel, vehicle, `Adicionar roda a ${vehicle.name}`);
}
export function addWheel(session: EditorSession, entity: Entity): void {
    if (!canBecomeWheel(entity))
        return;
    session.scene.updateWorldMatrices();
    applyWheel(session, entity, `Transformar ${entity.name} em roda`, createWheelSettings({ radius: meshRadius(entity) ?? createWheelSettings().radius }));
}
export function removeWheel(session: EditorSession, entity: Entity): void {
    if (entity.wheel)
        applyWheel(session, entity, `Remover Wheel Collider de ${entity.name}`, null);
}
export function fitWheelToMesh(session: EditorSession, entity: Entity): void {
    const current = entity.wheel;
    session.scene.updateWorldMatrices();
    const radius = meshRadius(entity);
    if (current && radius !== null && radius !== current.radius)
        applyWheel(session, entity, 'Ajustar raio da roda à malha', { ...current, radius });
}
export function setWheelScalar(session: EditorSession, entity: Entity, key: WheelScalar, value: number): void {
    const current = entity.wheel;
    if (!current || !Number.isFinite(value))
        return;
    const clamped = clampWheelScalar(key, value);
    if (clamped !== current[key])
        applyWheel(session, entity, SCALAR_LABEL[key], { ...current, [key]: clamped }, `wheel:${entity.id}:${key}`);
}
export function setWheelRole(session: EditorSession, entity: Entity, role: WheelRole, enabled: boolean): void {
    const current = entity.wheel;
    if (current && current[role] !== enabled)
        applyWheel(session, entity, ROLE_LABEL[role][enabled ? 1 : 0], { ...current, [role]: enabled });
}
export function setWheelFriction(session: EditorSession, entity: Entity, axis: WheelFrictionAxis, field: WheelFrictionField, value: number): void {
    const current = entity.wheel;
    if (!current || !Number.isFinite(value))
        return;
    const clamped = clampWheelFrictionField(field, value);
    if (clamped === current[axis][field])
        return;
    const label = `${FRICTION_FIELD_LABEL[field]} ${FRICTION_AXIS_LABEL[axis]} da roda`;
    applyWheel(session, entity, label, { ...current, [axis]: { ...current[axis], [field]: clamped } }, `wheel:${entity.id}:${axis}:${field}`);
}
