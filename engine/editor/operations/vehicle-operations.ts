import * as vec3 from '@/engine/core/math/vec3';
import type { Entity } from '@/engine/core/scene/entity';
import { CompositeCommand, SetValueCommand } from '@/engine/editor/commands/set-value-command';
import type { Command } from '@/engine/editor/history/command';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import type { RigidBodySettings } from '@/engine/physics/body/rigid-body-settings';
import { assembleVehicle, vehicleRestHeight } from '@/engine/vehicle/assembly/vehicle-assembly';
import { getVehiclePreset, type VehiclePresetId } from '@/engine/vehicle/vehicle-presets';
import { clampVehicleScalar, cloneVehicleSettings, createVehicleSettings, type VehicleControl, type VehicleScalar, type VehicleSettings } from '@/engine/vehicle/vehicle-settings';
import { addEntity, spawnPosition } from './entity-operations';
import { createRigidBodyForEntity } from './physics-operations';
const SCALAR_LABEL: Record<VehicleScalar, string> = {
    maxTorque: 'Torque máximo do motor',
    idleRpm: 'Marcha lenta do motor',
    peakRpm: 'Rotação de pico de torque',
    maxRpm: 'Corte de giro do motor',
    engineBraking: 'Freio-motor',
    gearCount: 'Número de marchas',
    firstGearRatio: 'Relação da primeira marcha',
    topGearRatio: 'Relação da última marcha',
    reverseGearRatio: 'Relação da ré',
    finalDriveRatio: 'Relação do diferencial',
    maxSteerAngle: 'Ângulo máximo da direção',
    steerSpeed: 'Velocidade do volante',
    highSpeedSteering: 'Direção em alta velocidade',
    ackermann: 'Geometria de Ackermann',
    brakeTorque: 'Torque do freio',
    handbrakeTorque: 'Torque do freio de mão',
    bodyRoll: 'Inclinação da carroceria',
    airDrag: 'Arrasto do ar',
};
const CONTROL_LABEL: Record<VehicleControl, string> = {
    player: 'Veículo dirigido pelo jogador',
    script: 'Veículo dirigido por script',
};
function vehicleCommand(entity: Entity, label: string, next: VehicleSettings | null, mergeKey?: string): Command {
    return new SetValueCommand<VehicleSettings | null>(label, (value) => {
        entity.vehicle = value;
    }, entity.vehicle, next, mergeKey);
}
export function addVehicleActor(session: EditorSession, presetId: VehiclePresetId): Entity {
    const preset = getVehiclePreset(presetId);
    const entity = assembleVehicle(session.scene, preset);
    vec3.copy(entity.transform.position, spawnPosition(session, null));
    entity.transform.position[1] += vehicleRestHeight(preset.blueprint);
    return addEntity(session, entity);
}
export function canBecomeVehicle(entity: Entity): boolean {
    const isPlainActor = (entity.kind === 'mesh' || entity.kind === 'group') && !entity.vehicle && !entity.wheel && !entity.cloth && !entity.csgBrush;
    return isPlainActor && (entity.rigidBody === null || entity.rigidBody.type === 'dynamic');
}
export function addVehicle(session: EditorSession, entity: Entity): void {
    if (!canBecomeVehicle(entity))
        return;
    const label = `Transformar ${entity.name} em veículo`;
    const commands = [vehicleCommand(entity, label, createVehicleSettings())];
    if (!entity.rigidBody) {
        const chassisBody = createRigidBodyForEntity(entity, { type: 'dynamic', collider: 'box' });
        commands.unshift(new SetValueCommand<RigidBodySettings | null>(label, (value) => {
            entity.rigidBody = value;
        }, null, chassisBody));
    }
    session.history.execute(new CompositeCommand(label, commands));
}
export function removeVehicle(session: EditorSession, entity: Entity): void {
    if (entity.vehicle)
        session.history.execute(vehicleCommand(entity, `Remover veículo de ${entity.name}`, null));
}
export function applyVehiclePreset(session: EditorSession, entity: Entity, presetId: VehiclePresetId): void {
    const current = entity.vehicle;
    if (!current)
        return;
    const preset = getVehiclePreset(presetId);
    session.history.execute(vehicleCommand(entity, `Perfil de veículo: ${preset.label.toLowerCase()}`, { ...cloneVehicleSettings(preset.settings), control: current.control }));
}
export function setVehicleScalar(session: EditorSession, entity: Entity, key: VehicleScalar, value: number): void {
    const current = entity.vehicle;
    if (!current || !Number.isFinite(value))
        return;
    const clamped = clampVehicleScalar(key, value);
    if (clamped !== current[key])
        session.history.execute(vehicleCommand(entity, SCALAR_LABEL[key], { ...current, [key]: clamped }, `vehicle:${entity.id}:${key}`));
}
export function setVehicleControl(session: EditorSession, entity: Entity, control: VehicleControl): void {
    const current = entity.vehicle;
    if (current && current.control !== control)
        session.history.execute(vehicleCommand(entity, CONTROL_LABEL[control], { ...current, control }));
}
