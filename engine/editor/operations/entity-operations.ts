import * as vec3 from '@/engine/core/math/vec3';
import * as mat4 from '@/engine/core/math/mat4';
import type { Entity } from '@/engine/core/scene/entity';
import { cloneEntity, uniqueEntityName } from '@/engine/core/scene/entity-utils';
import { createMaterial } from '@/engine/core/scene/material';
import { createAmbientLight, createDirectionalLight } from '@/engine/core/scene/light';
import type { MeshData } from '@/engine/renderer/geometry/mesh-data';
import type { Material } from '@/engine/core/scene/material';
import { getLocalBounds } from '@/engine/renderer/geometry/bounds';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import type { Command } from '@/engine/editor/history/command';
import { AddEntityCommand, RemoveEntityCommand, ReparentEntityCommand } from '@/engine/editor/commands/entity-commands';
import { CompositeCommand, SetValueCommand } from '@/engine/editor/commands/set-value-command';
import { getPrimitive, type PrimitiveKind } from '@/engine/editor/primitives/primitive-catalog';
import { snapValue } from './transform-operations';
export type LightKind = 'directional' | 'ambient';
const inverseParent = mat4.create();
const localMatrix = mat4.create();
export function defaultParent(session: EditorSession): Entity {
    const selected = session.selectedEntity;
    return selected && selected.kind === 'group' ? selected : session.scene.root;
}
export function spawnPosition(session: EditorSession, mesh: MeshData | null): Float32Array {
    const target = session.camera.target;
    const position = vec3.create(target[0], target[1], target[2]);
    if (session.snap.enabled) {
        const step = session.snap.translate;
        vec3.set(position, snapValue(position[0], step), snapValue(position[1], step), snapValue(position[2], step));
    }
    if (mesh)
        position[1] -= getLocalBounds(mesh).min[1];
    return position;
}
export function addEntity(session: EditorSession, entity: Entity, parent: Entity = defaultParent(session), label = `Adicionar ${entity.name}`): Entity {
    entity.name = uniqueEntityName(session.scene, entity.name);
    session.history.execute(new AddEntityCommand(label, entity, parent));
    session.select(entity);
    session.log.info('Cena', `${entity.name} adicionado em ${parent.name}.`);
    return entity;
}
export function addPrimitive(session: EditorSession, kind: PrimitiveKind): Entity {
    const definition = getPrimitive(kind);
    const mesh = definition.create();
    const entity = session.scene.createEntity({ name: definition.label, kind: 'mesh', mesh, material: createMaterial({ baseColor: vec3.create(0.7, 0.7, 0.7), roughness: 0.6 }) }, null);
    vec3.copy(entity.transform.position, spawnPosition(session, mesh));
    return addEntity(session, entity);
}
export function addMeshInstance(session: EditorSession, name: string, mesh: MeshData, material: Material | null): Entity {
    const entity = session.scene.createEntity({ name, kind: 'mesh', mesh, material: material ?? undefined }, null);
    vec3.copy(entity.transform.position, spawnPosition(session, mesh));
    return addEntity(session, entity);
}
export function addLight(session: EditorSession, kind: LightKind): Entity {
    const entity = kind === 'directional'
        ? session.scene.createEntity({ name: 'LuzDirecional', kind: 'light', light: createDirectionalLight() }, null)
        : session.scene.createEntity({ name: 'LuzAmbiente', kind: 'light', light: createAmbientLight() }, null);
    if (kind === 'directional') {
        vec3.set(entity.transform.position, 0, 5, 0);
        vec3.set(entity.transform.rotation, -50, 30, 0);
    }
    return addEntity(session, entity);
}
export function addGroup(session: EditorSession): Entity {
    const entity = session.scene.createEntity({ name: 'Grupo', kind: 'group' }, null);
    vec3.copy(entity.transform.position, spawnPosition(session, null));
    return addEntity(session, entity);
}
export function addCamera(session: EditorSession): Entity {
    const entity = session.scene.createEntity({ name: 'Camera', kind: 'camera' }, null);
    vec3.copy(entity.transform.position, session.camera.position);
    return addEntity(session, entity);
}
export function deleteEntity(session: EditorSession, entity: Entity): void {
    if (!entity.parent)
        return;
    const wasSelected = session.selectedEntity !== null && entity.contains(session.selectedEntity);
    session.history.execute(new RemoveEntityCommand(entity));
    if (wasSelected)
        session.select(null);
    session.log.info('Cena', `${entity.name} excluído.`);
}
export function deleteSelected(session: EditorSession): void {
    const entity = session.selectedEntity;
    if (entity)
        deleteEntity(session, entity);
}
export function duplicateEntity(session: EditorSession, entity: Entity): Entity | null {
    if (!entity.parent)
        return null;
    const copy = cloneEntity(session.scene, entity, null);
    copy.name = uniqueEntityName(session.scene, entity.name);
    const index = entity.parent.children.indexOf(entity) + 1;
    session.history.execute(new AddEntityCommand(`Duplicar ${entity.name}`, copy, entity.parent, index));
    session.select(copy);
    return copy;
}
export function duplicateSelected(session: EditorSession): void {
    const entity = session.selectedEntity;
    if (entity)
        duplicateEntity(session, entity);
}
export function copySelected(session: EditorSession): void {
    const entity = session.selectedEntity;
    if (!entity || !entity.parent)
        return;
    session.clipboard = cloneEntity(session.scene, entity, null);
    session.notify();
}
export function pasteClipboard(session: EditorSession): Entity | null {
    if (!session.clipboard)
        return null;
    const copy = cloneEntity(session.scene, session.clipboard, null);
    return addEntity(session, copy, defaultParent(session), `Colar ${copy.name}`);
}
export function renameEntity(session: EditorSession, entity: Entity, name: string): void {
    const next = uniqueEntityName(session.scene, name.trim() || entity.name, entity);
    if (next === entity.name)
        return;
    session.history.execute(new SetValueCommand(`Renomear para ${next}`, (value) => {
        entity.name = value;
    }, entity.name, next));
}
export function setEntityVisibility(session: EditorSession, entity: Entity, visible: boolean): void {
    if (entity.visible === visible)
        return;
    session.history.execute(new SetValueCommand(visible ? `Mostrar ${entity.name}` : `Ocultar ${entity.name}`, (value) => {
        entity.visible = value;
    }, entity.visible, visible));
}
export function setShadowFlag(session: EditorSession, entity: Entity, flag: 'castShadows' | 'receiveShadows', value: boolean): void {
    if (entity[flag] === value)
        return;
    session.history.execute(new SetValueCommand(flag === 'castShadows' ? 'Projetar sombras' : 'Receber sombras', (next) => {
        entity[flag] = next;
    }, entity[flag], value));
}
export function reparentEntity(session: EditorSession, entity: Entity, newParent: Entity, newIndex: number): boolean {
    if (!entity.parent || entity.contains(newParent))
        return false;
    const sameParent = entity.parent === newParent;
    if (sameParent && newIndex === entity.parent.children.indexOf(entity))
        return false;
    const commands: Command[] = [new ReparentEntityCommand(entity, newParent, newIndex)];
    if (!sameParent) {
        session.scene.updateWorldMatrices();
        if (mat4.invert(inverseParent, newParent.worldMatrix)) {
            mat4.multiply(localMatrix, inverseParent, entity.worldMatrix);
            const position = vec3.create();
            const rotation = vec3.create();
            const scale = vec3.create();
            mat4.decomposeTranslationRotationScale(position, rotation, scale, localMatrix);
            const { transform } = entity;
            const before = { position: vec3.copy(vec3.create(), transform.position), rotation: vec3.copy(vec3.create(), transform.rotation), scale: vec3.copy(vec3.create(), transform.scale) };
            commands.push(new SetValueCommand('Preservar transformação', (value) => {
                vec3.copy(transform.position, value.position);
                vec3.copy(transform.rotation, value.rotation);
                vec3.copy(transform.scale, value.scale);
            }, before, { position, rotation, scale }));
        }
    }
    session.history.execute(new CompositeCommand(`Mover ${entity.name} para ${newParent.name}`, commands));
    return true;
}
export function groupEntity(session: EditorSession, entity: Entity): Entity | null {
    if (!entity.parent)
        return null;
    const parent = entity.parent;
    const group = session.scene.createEntity({ name: `${entity.name}_Grupo`, kind: 'group' }, null);
    group.name = uniqueEntityName(session.scene, group.name);
    vec3.copy(group.transform.position, entity.transform.position);
    const index = parent.children.indexOf(entity);
    const commands = [
        new AddEntityCommand(`Agrupar ${entity.name}`, group, parent, index),
        new ReparentEntityCommand(entity, group, 0),
        new SetValueCommand('Posição relativa', (value) => vec3.copy(entity.transform.position, value), vec3.copy(vec3.create(), entity.transform.position), vec3.create(0, 0, 0)),
    ];
    session.history.execute(new CompositeCommand(`Agrupar ${entity.name}`, commands));
    session.select(group);
    return group;
}
