import { clamp } from '@/engine/core/math/scalar';
import type { Entity } from '@/engine/core/scene/entity';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { SetValueCommand } from '@/engine/editor/commands/set-value-command';
import { getLocalBounds } from '@/engine/renderer/geometry/bounds';
import { cloneRigidBodySettings, copyRigidBodySettings, createRigidBodySettings, type BodyType, type RigidBodySettings, } from '@/engine/physics/body/rigid-body-settings';
import { defaultMassForSettings, fitColliderToBounds } from '@/engine/physics/body/collider-fit';
import type { ColliderKind } from '@/engine/physics/shapes/collider-shape';
export type RigidBodyScalar = 'mass' | 'radius' | 'height' | 'friction' | 'restitution' | 'linearDamping' | 'angularDamping' | 'gravityScale';
export type RigidBodyVector = 'boxSize' | 'center';
export type Axis = 0 | 1 | 2;
const SCALAR_RANGE: Record<RigidBodyScalar, [
    number,
    number
]> = {
    mass: [0.001, 1000000],
    radius: [0.005, 1000],
    height: [0.01, 1000],
    friction: [0, 2],
    restitution: [0, 1],
    linearDamping: [0, 100],
    angularDamping: [0, 100],
    gravityScale: [-10, 10],
};
const SCALAR_LABEL: Record<RigidBodyScalar, string> = {
    mass: 'Massa',
    radius: 'Raio do colisor',
    height: 'Altura do colisor',
    friction: 'Atrito',
    restitution: 'Restituição',
    linearDamping: 'Amortecimento linear',
    angularDamping: 'Amortecimento angular',
    gravityScale: 'Escala de gravidade',
};
const VECTOR_LABEL: Record<RigidBodyVector, string> = { boxSize: 'Tamanho do colisor', center: 'Centro do colisor' };
const COLLIDER_LABEL: Record<ColliderKind, string> = { box: 'caixa', sphere: 'esfera', capsule: 'cápsula' };
function guessColliderKind(entity: Entity): ColliderKind {
    const name = entity.mesh?.name ?? '';
    if (name === 'Esfera')
        return 'sphere';
    if (name === 'Cápsula')
        return 'capsule';
    return 'box';
}
function fitToEntityMesh(settings: RigidBodySettings, entity: Entity): void {
    if (entity.mesh)
        fitColliderToBounds(settings, getLocalBounds(entity.mesh));
}
export function createRigidBodyForEntity(entity: Entity, overrides: Partial<RigidBodySettings> = {}): RigidBodySettings {
    const settings = createRigidBodySettings({ collider: guessColliderKind(entity), ...overrides });
    fitToEntityMesh(settings, entity);
    if (overrides.mass === undefined)
        settings.mass = defaultMassForSettings(settings, entity.transform.scale);
    return settings;
}
export function addRigidBody(session: EditorSession, entity: Entity): void {
    if (entity.rigidBody)
        return;
    const settings = createRigidBodyForEntity(entity);
    session.history.execute(new SetValueCommand<RigidBodySettings | null>(`Adicionar corpo rígido a ${entity.name}`, (value) => {
        entity.rigidBody = value;
    }, null, settings));
    session.log.info('Física', `${entity.name} recebeu um corpo ${settings.type === 'static' ? 'estático' : 'dinâmico'} (${COLLIDER_LABEL[settings.collider]}).`);
}
export function removeRigidBody(session: EditorSession, entity: Entity): void {
    const current = entity.rigidBody;
    if (!current)
        return;
    session.history.execute(new SetValueCommand<RigidBodySettings | null>(`Remover corpo rígido de ${entity.name}`, (value) => {
        entity.rigidBody = value;
    }, current, null));
}
function commitSettings(session: EditorSession, entity: Entity, label: string, after: RigidBodySettings, mergeKey?: string): void {
    const target = entity.rigidBody;
    if (!target)
        return;
    session.history.execute(new SetValueCommand(label, (value) => copyRigidBodySettings(target, value), cloneRigidBodySettings(target), after, mergeKey));
}
export function setRigidBodyType(session: EditorSession, entity: Entity, type: BodyType): void {
    const settings = entity.rigidBody;
    if (!settings || settings.type === type)
        return;
    const after = cloneRigidBodySettings(settings);
    after.type = type;
    commitSettings(session, entity, type === 'static' ? 'Corpo estático' : 'Corpo dinâmico', after);
}
export function setRigidBodyCollider(session: EditorSession, entity: Entity, collider: ColliderKind): void {
    const settings = entity.rigidBody;
    if (!settings || settings.collider === collider)
        return;
    const after = cloneRigidBodySettings(settings);
    after.collider = collider;
    fitToEntityMesh(after, entity);
    commitSettings(session, entity, `Colisor ${COLLIDER_LABEL[collider]}`, after);
}
export function setRigidBodyScalar(session: EditorSession, entity: Entity, field: RigidBodyScalar, value: number): void {
    const settings = entity.rigidBody;
    if (!settings || !Number.isFinite(value))
        return;
    const [min, max] = SCALAR_RANGE[field];
    const next = clamp(value, min, max);
    if (settings[field] === next)
        return;
    const after = cloneRigidBodySettings(settings);
    after[field] = next;
    commitSettings(session, entity, SCALAR_LABEL[field], after, `rigidbody:${entity.id}:${field}`);
}
export function setRigidBodyVectorComponent(session: EditorSession, entity: Entity, field: RigidBodyVector, axis: Axis, value: number): void {
    const settings = entity.rigidBody;
    if (!settings || !Number.isFinite(value))
        return;
    const next = field === 'boxSize' ? Math.max(value, 0.01) : value;
    if (settings[field][axis] === next)
        return;
    const after = cloneRigidBodySettings(settings);
    after[field][axis] = next;
    commitSettings(session, entity, `${VECTOR_LABEL[field]} ${'XYZ'[axis]}`, after, `rigidbody:${entity.id}:${field}:${axis}`);
}
export function setRigidBodyCanSleep(session: EditorSession, entity: Entity, canSleep: boolean): void {
    const settings = entity.rigidBody;
    if (!settings || settings.canSleep === canSleep)
        return;
    const after = cloneRigidBodySettings(settings);
    after.canSleep = canSleep;
    commitSettings(session, entity, canSleep ? 'Permitir repouso' : 'Impedir repouso', after);
}
export function fitRigidBodyToMesh(session: EditorSession, entity: Entity): void {
    const settings = entity.rigidBody;
    if (!settings || !entity.mesh)
        return;
    const after = cloneRigidBodySettings(settings);
    fitToEntityMesh(after, entity);
    after.mass = defaultMassForSettings(after, entity.transform.scale);
    commitSettings(session, entity, 'Ajustar colisor à malha', after);
}
