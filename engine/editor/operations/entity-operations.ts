import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import * as mat4 from '@/engine/core/math/mat4';
import type { Mat4 } from '@/engine/core/math/mat4';
import type { Entity } from '@/engine/core/scene/entity';
import type { Scene } from '@/engine/core/scene/scene';
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
const groupWorld = mat4.create();
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
export function describeEntities(entities: readonly Entity[]): string {
    return entities.length === 1 ? entities[0].name : `${entities.length} atores`;
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
export function addFolder(session: EditorSession, parent: Entity = defaultParent(session), index = parent.children.length, name = 'Nova pasta'): Entity {
    const folder = session.scene.createEntity({ name, kind: 'group' }, null);
    folder.name = uniqueEntityName(session.scene, folder.name);
    session.history.execute(new AddEntityCommand(`Nova pasta em ${parent.name}`, folder, parent, index));
    session.select(folder);
    return folder;
}
export function addCamera(session: EditorSession): Entity {
    const entity = session.scene.createEntity({ name: 'Camera', kind: 'camera' }, null);
    vec3.copy(entity.transform.position, session.camera.position);
    return addEntity(session, entity);
}
export function topLevelOnly(entities: readonly Entity[]): Entity[] {
    const set = new Set(entities);
    return entities.filter((entity) => {
        for (let current = entity.parent; current; current = current.parent)
            if (set.has(current))
                return false;
        return true;
    });
}
export function deleteEntities(session: EditorSession, entities: readonly Entity[]): void {
    const roots = topLevelOnly(entities).filter((entity) => entity.parent !== null);
    if (roots.length === 0)
        return;
    const commands = roots.map((entity) => new RemoveEntityCommand(entity));
    session.history.execute(roots.length === 1 ? commands[0] : new CompositeCommand(`Excluir ${roots.length} atores`, commands));
    session.select(null);
    session.log.info('Cena', `${describeEntities(roots)} excluído${roots.length === 1 ? '' : 's'}.`);
}
export function deleteEntity(session: EditorSession, entity: Entity): void {
    deleteEntities(session, [entity]);
}
export function deleteSelected(session: EditorSession): void {
    deleteEntities(session, session.selectionRoots());
}
export function duplicateEntities(session: EditorSession, entities: readonly Entity[]): Entity[] {
    const roots = topLevelOnly(entities).filter((entity) => entity.parent !== null);
    if (roots.length === 0)
        return [];
    const copies: Entity[] = [];
    const commands: Command[] = [];
    for (const entity of roots) {
        const parent = entity.parent as Entity;
        const copy = cloneEntity(session.scene, entity, null);
        copy.name = uniqueEntityName(session.scene, entity.name);
        copies.push(copy);
        commands.push(new AddEntityCommand(`Duplicar ${entity.name}`, copy, parent, parent.children.indexOf(entity) + 1));
    }
    session.history.execute(commands.length === 1 ? commands[0] : new CompositeCommand(`Duplicar ${roots.length} atores`, commands));
    session.setSelection(copies);
    return copies;
}
export function duplicateEntity(session: EditorSession, entity: Entity): Entity | null {
    return duplicateEntities(session, [entity])[0] ?? null;
}
export function duplicateSelected(session: EditorSession): void {
    duplicateEntities(session, session.selectionRoots());
}
export function copySelected(session: EditorSession): void {
    const roots = session.selectionRoots();
    if (roots.length === 0)
        return;
    session.clipboard = roots.map((entity) => cloneEntity(session.scene, entity, null));
    session.notify();
}
export function pasteClipboard(session: EditorSession, parent: Entity = defaultParent(session)): Entity[] {
    if (session.clipboard.length === 0)
        return [];
    const copies = session.clipboard.map((source) => {
        const copy = cloneEntity(session.scene, source, null);
        copy.name = uniqueEntityName(session.scene, copy.name);
        return copy;
    });
    const commands = copies.map((copy) => new AddEntityCommand(`Colar ${copy.name}`, copy, parent));
    session.history.execute(commands.length === 1 ? commands[0] : new CompositeCommand(`Colar ${copies.length} atores`, commands));
    session.setSelection(copies);
    session.log.info('Cena', `${describeEntities(copies)} colado${copies.length === 1 ? '' : 's'} em ${parent.name}.`);
    return copies;
}
export function renameEntity(session: EditorSession, entity: Entity, name: string): void {
    const next = uniqueEntityName(session.scene, name.trim() || entity.name, entity);
    if (next === entity.name)
        return;
    session.history.execute(new SetValueCommand(`Renomear para ${next}`, (value) => {
        entity.name = value;
    }, entity.name, next));
}
export function setEntitiesVisibility(session: EditorSession, entities: readonly Entity[], visible: boolean): void {
    const changed = entities.filter((entity) => entity.visible !== visible && entity.parent !== null);
    if (changed.length === 0)
        return;
    const commands = changed.map((entity) => new SetValueCommand(visible ? `Mostrar ${entity.name}` : `Ocultar ${entity.name}`, (value) => {
        entity.visible = value;
    }, entity.visible, visible));
    session.history.execute(commands.length === 1 ? commands[0] : new CompositeCommand(`${visible ? 'Mostrar' : 'Ocultar'} ${changed.length} atores`, commands));
}
export function setEntityVisibility(session: EditorSession, entity: Entity, visible: boolean): void {
    setEntitiesVisibility(session, [entity], visible);
}
export function toggleVisibilitySelected(session: EditorSession): void {
    const selected = session.selectedEntities();
    if (selected.length === 0)
        return;
    setEntitiesVisibility(session, selected, !selected.some((entity) => entity.visible));
}
export function isolateEntities(session: EditorSession, entities: readonly Entity[]): void {
    const keep = new Set<Entity>();
    for (const entity of entities) {
        for (let current: Entity | null = entity; current; current = current.parent)
            keep.add(current);
        session.scene.traverse((descendant) => keep.add(descendant), entity);
    }
    const toHide: Entity[] = [];
    const toShow: Entity[] = [];
    session.scene.traverse((entity) => {
        if (!entity.parent)
            return;
        if (keep.has(entity)) {
            if (!entity.visible)
                toShow.push(entity);
        }
        else if (entity.visible && entity.parent && keep.has(entity.parent)) {
            toHide.push(entity);
        }
    });
    const visibilityCommand = (entity: Entity, visible: boolean): Command => new SetValueCommand(visible ? `Mostrar ${entity.name}` : `Ocultar ${entity.name}`, (value) => {
        entity.visible = value;
    }, entity.visible, visible);
    const commands: Command[] = [];
    for (const entity of toShow)
        commands.push(visibilityCommand(entity, true));
    for (const entity of toHide)
        commands.push(visibilityCommand(entity, false));
    if (commands.length === 0)
        return;
    session.history.execute(new CompositeCommand(`Isolar ${describeEntities(entities)}`, commands));
}
export function hiddenEntities(scene: Scene): Entity[] {
    const hidden: Entity[] = [];
    scene.traverse((entity) => {
        if (entity.parent && !entity.visible)
            hidden.push(entity);
    });
    return hidden;
}
export function lockedEntities(scene: Scene): Entity[] {
    const locked: Entity[] = [];
    scene.traverse((entity) => {
        if (entity.parent && entity.locked)
            locked.push(entity);
    });
    return locked;
}
export function showAllEntities(session: EditorSession): void {
    setEntitiesVisibility(session, hiddenEntities(session.scene), true);
}
export function setEntitiesLocked(session: EditorSession, entities: readonly Entity[], locked: boolean): void {
    const changed = entities.filter((entity) => entity.locked !== locked && entity.parent !== null);
    if (changed.length === 0)
        return;
    const commands = changed.map((entity) => new SetValueCommand(locked ? `Bloquear ${entity.name}` : `Desbloquear ${entity.name}`, (value) => {
        entity.locked = value;
    }, entity.locked, locked));
    session.history.execute(commands.length === 1 ? commands[0] : new CompositeCommand(`${locked ? 'Bloquear' : 'Desbloquear'} ${changed.length} atores`, commands));
}
export function setEntityLocked(session: EditorSession, entity: Entity, locked: boolean): void {
    setEntitiesLocked(session, [entity], locked);
}
export function toggleLockSelected(session: EditorSession): void {
    const selected = session.selectedEntities();
    if (selected.length === 0)
        return;
    setEntitiesLocked(session, selected, !selected.every((entity) => entity.locked));
}
export function unlockAllEntities(session: EditorSession): void {
    setEntitiesLocked(session, lockedEntities(session.scene), false);
}
export function toggleEntitiesLocked(session: EditorSession, entities: readonly Entity[]): void {
    if (entities.length === 0)
        return;
    setEntitiesLocked(session, entities, !entities.every((entity) => entity.locked));
}
export function toggleEntitiesVisibility(session: EditorSession, entities: readonly Entity[]): void {
    if (entities.length === 0)
        return;
    setEntitiesVisibility(session, entities, !entities.some((entity) => entity.visible));
}
export function setShadowFlag(session: EditorSession, entity: Entity, flag: 'castShadows' | 'receiveShadows', value: boolean): void {
    if (entity[flag] === value)
        return;
    session.history.execute(new SetValueCommand(flag === 'castShadows' ? 'Projetar sombras' : 'Receber sombras', (next) => {
        entity[flag] = next;
    }, entity[flag], value));
}
interface TransformSnapshot {
    position: Vec3;
    rotation: Vec3;
    scale: Vec3;
}
function snapshotTransform(entity: Entity): TransformSnapshot {
    const { transform } = entity;
    return {
        position: vec3.copy(vec3.create(), transform.position),
        rotation: vec3.copy(vec3.create(), transform.rotation),
        scale: vec3.copy(vec3.create(), transform.scale),
    };
}
export function preserveWorldTransform(entity: Entity, parentWorld: Mat4): Command | null {
    if (!mat4.invert(inverseParent, parentWorld))
        return null;
    mat4.multiply(localMatrix, inverseParent, entity.worldMatrix);
    const after: TransformSnapshot = { position: vec3.create(), rotation: vec3.create(), scale: vec3.create() };
    mat4.decomposeTranslationRotationScale(after.position, after.rotation, after.scale, localMatrix);
    const { transform } = entity;
    return new SetValueCommand<TransformSnapshot>('Preservar transformação', (value) => {
        vec3.copy(transform.position, value.position);
        vec3.copy(transform.rotation, value.rotation);
        vec3.copy(transform.scale, value.scale);
    }, snapshotTransform(entity), after);
}
export function reparentEntity(session: EditorSession, entity: Entity, newParent: Entity, newIndex: number): boolean {
    return reparentEntities(session, [entity], newParent, newIndex);
}
export function reparentEntities(session: EditorSession, entities: readonly Entity[], newParent: Entity, newIndex: number): boolean {
    const roots = topLevelOnly(entities).filter((entity) => entity.parent !== null && !entity.contains(newParent));
    if (roots.length === 0)
        return false;
    if (roots.length === 1) {
        const [entity] = roots;
        const parent = entity.parent as Entity;
        if (parent === newParent && newIndex === parent.children.indexOf(entity))
            return false;
    }
    session.scene.updateWorldMatrices();
    const commands: Command[] = [];
    let index = newIndex;
    for (const entity of roots) {
        const sameParent = entity.parent === newParent;
        commands.push(new ReparentEntityCommand(entity, newParent, index));
        if (!sameParent) {
            const preserve = preserveWorldTransform(entity, newParent.worldMatrix);
            if (preserve)
                commands.push(preserve);
        }
        index++;
    }
    session.history.execute(new CompositeCommand(`Mover ${describeEntities(roots)} para ${newParent.name}`, commands));
    return true;
}
export function groupEntities(session: EditorSession, entities: readonly Entity[], name?: string): Entity | null {
    const roots = topLevelOnly(entities).filter((entity) => entity.parent !== null);
    if (roots.length === 0)
        return null;
    session.scene.updateWorldMatrices();
    const first = roots[0];
    const parent = first.parent as Entity;
    const center = vec3.create();
    for (const entity of roots) {
        center[0] += entity.worldMatrix[12];
        center[1] += entity.worldMatrix[13];
        center[2] += entity.worldMatrix[14];
    }
    vec3.scale(center, center, 1 / roots.length);
    const group = session.scene.createEntity({ name: name ?? (roots.length === 1 ? `${first.name}_Grupo` : 'Grupo'), kind: 'group' }, null);
    group.name = uniqueEntityName(session.scene, group.name);
    if (mat4.invert(inverseParent, parent.worldMatrix))
        mat4.transformPoint(group.transform.position, inverseParent, center);
    else
        vec3.copy(group.transform.position, center);
    mat4.identity(groupWorld);
    groupWorld[12] = center[0];
    groupWorld[13] = center[1];
    groupWorld[14] = center[2];
    const commands: Command[] = [new AddEntityCommand(`Agrupar ${describeEntities(roots)}`, group, parent, parent.children.indexOf(first))];
    roots.forEach((entity, index) => {
        commands.push(new ReparentEntityCommand(entity, group, index));
        const preserve = preserveWorldTransform(entity, groupWorld);
        if (preserve)
            commands.push(preserve);
    });
    session.history.execute(new CompositeCommand(`Agrupar ${describeEntities(roots)}`, commands));
    session.select(group);
    session.log.info('Cena', `${describeEntities(roots)} agrupado${roots.length === 1 ? '' : 's'} em ${group.name}.`);
    return group;
}
export function groupEntity(session: EditorSession, entity: Entity): Entity | null {
    return groupEntities(session, [entity]);
}
export function groupSelected(session: EditorSession): void {
    groupEntities(session, session.selectionRoots());
}
export function ungroupEntity(session: EditorSession, group: Entity): Entity[] {
    const parent = group.parent;
    if (!parent || group.kind !== 'group' || group.children.length === 0)
        return [];
    session.scene.updateWorldMatrices();
    const children = group.children.slice();
    const base = parent.children.indexOf(group);
    const commands: Command[] = [];
    children.forEach((child, index) => {
        commands.push(new ReparentEntityCommand(child, parent, base + index));
        const preserve = preserveWorldTransform(child, parent.worldMatrix);
        if (preserve)
            commands.push(preserve);
    });
    commands.push(new RemoveEntityCommand(group));
    session.history.execute(new CompositeCommand(`Desagrupar ${group.name}`, commands));
    session.setSelection(children);
    session.log.info('Cena', `${group.name} desagrupado (${children.length} ${children.length === 1 ? 'ator' : 'atores'}).`);
    return children;
}
export function ungroupSelected(session: EditorSession): void {
    const groups = session.selectionRoots().filter((entity) => entity.kind === 'group' && entity.children.length > 0);
    if (groups.length === 0)
        return;
    const released: Entity[] = [];
    for (const group of groups)
        released.push(...ungroupEntity(session, group));
    if (released.length > 0)
        session.setSelection(released);
}
export function selectChildren(session: EditorSession, entities: readonly Entity[]): void {
    const children: Entity[] = [];
    for (const entity of entities)
        children.push(...entity.children);
    if (children.length > 0)
        session.setSelection(children);
}
