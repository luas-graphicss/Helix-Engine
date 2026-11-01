import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import * as mat4 from '@/engine/core/math/mat4';
import * as quat from '@/engine/core/math/quat';
import type { Entity } from '@/engine/core/scene/entity';
import type { Light } from '@/engine/core/scene/light';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { SetValueCommand } from '@/engine/editor/commands/set-value-command';
import { applyTransformSnapshot, snapshotTransform, type TransformSnapshot } from './transform-operations';
const WORLD_UP = vec3.create(0, 1, 0);
const FALLBACK_RIGHT = vec3.create(1, 0, 0);
const zAxis = vec3.create();
const right = vec3.create();
const up = vec3.create();
const worldPosition = vec3.create();
const basis = mat4.create();
const inverseParent = mat4.create();
const worldRotation = quat.create();
const parentRotation = quat.create();
export function isAimableLight(light: Light | null | undefined): boolean {
    return light !== null && light !== undefined && (light.type === 'directional' || light.type === 'spot' || light.type === 'rect' || light.type === 'disc');
}
function aimRotation(out: Vec3, entity: Entity, from: Vec3, to: Vec3): Vec3 | null {
    vec3.subtract(zAxis, from, to);
    if (vec3.length(zAxis) < 1e-5)
        return null;
    vec3.normalize(zAxis, zAxis);
    vec3.cross(right, WORLD_UP, zAxis);
    if (vec3.length(right) < 1e-4)
        vec3.copy(right, FALLBACK_RIGHT);
    vec3.normalize(right, right);
    vec3.cross(up, zAxis, right);
    mat4.identity(basis);
    basis[0] = right[0];
    basis[1] = right[1];
    basis[2] = right[2];
    basis[4] = up[0];
    basis[5] = up[1];
    basis[6] = up[2];
    basis[8] = zAxis[0];
    basis[9] = zAxis[1];
    basis[10] = zAxis[2];
    quat.fromMat4Rotation(worldRotation, basis);
    if (entity.parent) {
        quat.fromMat4Rotation(parentRotation, entity.parent.worldMatrix);
        quat.conjugate(parentRotation, parentRotation);
        quat.multiply(worldRotation, parentRotation, worldRotation);
    }
    return quat.toEulerDegrees(out, worldRotation);
}
function commitPlacement(session: EditorSession, entity: Entity, label: string, mutate: (after: TransformSnapshot) => boolean): boolean {
    session.scene.updateWorldMatrices();
    const before = snapshotTransform(entity);
    const after = snapshotTransform(entity);
    if (!mutate(after))
        return false;
    session.history.execute(new SetValueCommand(label, (value) => applyTransformSnapshot(entity, value), before, after));
    return true;
}
export function aimLightAtCameraTarget(session: EditorSession, entity: Entity): void {
    if (!isAimableLight(entity.light))
        return;
    const done = commitPlacement(session, entity, `Apontar ${entity.name}`, (after) => {
        const m = entity.worldMatrix;
        vec3.set(worldPosition, m[12], m[13], m[14]);
        return aimRotation(after.rotation, entity, worldPosition, session.camera.target) !== null;
    });
    if (done)
        session.log.info('Luzes', `${entity.name} apontada para o alvo da câmera.`);
}
export function placeLightAtCamera(session: EditorSession, entity: Entity): void {
    const { light } = entity;
    if (!light || light.type === 'ambient')
        return;
    const done = commitPlacement(session, entity, `Posicionar ${entity.name} na câmera`, (after) => {
        const { camera } = session;
        const parent = entity.parent;
        if (parent && mat4.invert(inverseParent, parent.worldMatrix))
            mat4.transformPoint(after.position, inverseParent, camera.position);
        else
            vec3.copy(after.position, camera.position);
        if (isAimableLight(light))
            aimRotation(after.rotation, entity, camera.position, camera.target);
        return true;
    });
    if (done)
        session.log.info('Luzes', `${entity.name} posicionada na câmera.`);
}
