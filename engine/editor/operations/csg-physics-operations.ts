import type { Entity } from '@/engine/core/scene/entity';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import type { Command } from '@/engine/editor/history/command';
import { CompositeCommand, SetValueCommand } from '@/engine/editor/commands/set-value-command';
import { cloneRigidBodySettings, type RigidBodySettings } from '@/engine/physics/body/rigid-body-settings';
import { getLocalBounds } from '@/engine/renderer/geometry/bounds';
import { fitColliderToBounds } from '@/engine/physics/body/collider-fit';
import { createRigidBodyForEntity } from './physics-operations';
export type CsgCollisionState = 'none' | 'mesh' | 'primitive' | 'dynamic';
export const CSG_COLLISION_LABEL: Record<CsgCollisionState, string> = {
    none: 'Sem colisão',
    mesh: 'Malha · acompanha o CSG',
    primitive: 'Primitivo · ignora furos',
    dynamic: 'Dinâmico · ignora furos',
};
export function csgCollisionState(entity: Entity): CsgCollisionState {
    const body = entity.rigidBody;
    if (!body)
        return 'none';
    if (body.collider === 'mesh')
        return 'mesh';
    return body.type === 'dynamic' ? 'dynamic' : 'primitive';
}
export function csgCollisionStale(entity: Entity): boolean {
    const state = csgCollisionState(entity);
    return state === 'primitive' || state === 'dynamic';
}
function setRigidBodyCommand(entity: Entity, after: RigidBodySettings | null, label: string): Command {
    return new SetValueCommand<RigidBodySettings | null>(label, (value) => {
        entity.rigidBody = value;
    }, entity.rigidBody, after);
}
function meshColliderSettings(entity: Entity): RigidBodySettings {
    const current = entity.rigidBody;
    if (!current)
        return createRigidBodyForEntity(entity, { collider: 'mesh', type: 'static' });
    const settings = cloneRigidBodySettings(current);
    settings.collider = 'mesh';
    if (settings.type === 'dynamic')
        settings.type = 'static';
    if (entity.mesh)
        fitColliderToBounds(settings, getLocalBounds(entity.mesh));
    return settings;
}
export function autoMeshColliderCommand(session: EditorSession, target: Entity): Command | null {
    if (!session.csgPreferences.autoMeshCollider)
        return null;
    const state = csgCollisionState(target);
    if (state === 'mesh' || state === 'dynamic')
        return null;
    return setRigidBodyCommand(target, meshColliderSettings(target), `Colisor de malha em ${target.name}`);
}
export function useMeshColliderForCsg(session: EditorSession, target: Entity): void {
    const state = csgCollisionState(target);
    if (state === 'mesh')
        return;
    session.history.execute(setRigidBodyCommand(target, meshColliderSettings(target), `Colisor de malha em ${target.name}`));
    session.log.info('Física', state === 'dynamic'
        ? `${target.name} passou a estático com colisor de malha: a colisão agora acompanha o CSG.`
        : `${target.name} recebeu um colisor de malha: personagens e corpos passam pelos furos.`);
}
export function removeCsgCollision(session: EditorSession, target: Entity): void {
    if (!target.rigidBody)
        return;
    session.history.execute(setRigidBodyCommand(target, null, `Remover colisão de ${target.name}`));
}
export function fixAllCsgCollisions(session: EditorSession, targets: readonly Entity[]): number {
    const stale = targets.filter(csgCollisionStale);
    if (stale.length === 0)
        return 0;
    const commands = stale.map((target) => setRigidBodyCommand(target, meshColliderSettings(target), `Colisor de malha em ${target.name}`));
    session.history.execute(commands.length === 1 ? commands[0] : new CompositeCommand(`Colisor de malha em ${stale.length} alvos CSG`, commands));
    session.log.info('Física', `${stale.length} ${stale.length === 1 ? 'alvo CSG passou' : 'alvos CSG passaram'} a usar colisor de malha.`);
    return stale.length;
}
