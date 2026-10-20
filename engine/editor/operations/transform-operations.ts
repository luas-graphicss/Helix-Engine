import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { Entity } from '@/engine/core/scene/entity';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { SetValueCommand } from '@/engine/editor/commands/set-value-command';
export type TransformField = 'position' | 'rotation' | 'scale';
export type Axis = 0 | 1 | 2;
export interface TransformSnapshot {
    position: Vec3;
    rotation: Vec3;
    scale: Vec3;
}
const FIELD_LABEL: Record<TransformField, string> = { position: 'Posição', rotation: 'Rotação', scale: 'Escala' };
const DEFAULT_VALUE: Record<TransformField, [
    number,
    number,
    number
]> = {
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
};
export function snapValue(value: number, step: number): number {
    return step > 0 ? Math.round(value / step) * step : value;
}
export function snapshotTransform(entity: Entity): TransformSnapshot {
    const { transform } = entity;
    return {
        position: vec3.copy(vec3.create(), transform.position),
        rotation: vec3.copy(vec3.create(), transform.rotation),
        scale: vec3.copy(vec3.create(), transform.scale),
    };
}
export function applyTransformSnapshot(entity: Entity, snapshot: TransformSnapshot): void {
    vec3.copy(entity.transform.position, snapshot.position);
    vec3.copy(entity.transform.rotation, snapshot.rotation);
    vec3.copy(entity.transform.scale, snapshot.scale);
}
export function setTransformComponent(session: EditorSession, entity: Entity, field: TransformField, axis: Axis, value: number): void {
    if (!Number.isFinite(value) || entity.transform[field][axis] === value)
        return;
    const target = entity.transform[field];
    session.history.execute(new SetValueCommand(`${FIELD_LABEL[field]} ${'XYZ'[axis]}`, (next) => {
        target[axis] = next;
    }, target[axis], value, `transform:${entity.id}:${field}:${axis}`));
}
export function commitTransform(session: EditorSession, entity: Entity, before: TransformSnapshot, after: TransformSnapshot, label: string): void {
    session.history.execute(new SetValueCommand(label, (value) => applyTransformSnapshot(entity, value), before, after, `transform:${entity.id}:gizmo`));
}
export function resetTransform(session: EditorSession, entity: Entity, field?: TransformField): void {
    const fields: TransformField[] = field ? [field] : ['position', 'rotation', 'scale'];
    const before = snapshotTransform(entity);
    const after = snapshotTransform(entity);
    for (const name of fields)
        vec3.set(after[name], ...DEFAULT_VALUE[name]);
    session.history.execute(new SetValueCommand(field ? `Redefinir ${FIELD_LABEL[field].toLowerCase()}` : 'Redefinir transformação', (value) => applyTransformSnapshot(entity, value), before, after));
}
