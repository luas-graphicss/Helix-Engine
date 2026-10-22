import * as vec3 from '@/engine/core/math/vec3';
import type { Entity } from '@/engine/core/scene/entity';
import { cloneEntity, uniqueEntityName } from '@/engine/core/scene/entity-utils';
import { cloneMaterial, type Material } from '@/engine/core/scene/material';
import type { MeshData } from '@/engine/renderer/geometry/mesh-data';
import { cloneRigidBodySettings, type RigidBodySettings } from '@/engine/physics/body/rigid-body-settings';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import type { Command } from '@/engine/editor/history/command';
import { AddEntityCommand, RemoveEntityCommand, ReparentEntityCommand } from '@/engine/editor/commands/entity-commands';
import { CompositeCommand, SetValueCommand } from '@/engine/editor/commands/set-value-command';
import { getPrimitive } from '@/engine/editor/primitives/primitive-catalog';
import { brushTarget } from '@/engine/geometry/csg/csg-system';
import { copyMeshData } from '@/engine/geometry/csg/csg-boolean';
import { brushesOf, canBeCsgBrush, canBeCsgTarget } from '@/engine/geometry/csg/csg-roles';
import { CSG_OPERATIONS, CSG_OPERATION_LABEL, CSG_PRECISION_LABEL, CSG_SHAPE_LABEL, cloneCsgBrushSettings, cloneCsgSettings, createCsgBrushSettings, createCsgSettings, type CsgBrushSettings, type CsgBrushShape, type CsgOperation, type CsgPrecision, type CsgSettings, } from '@/engine/geometry/csg/csg-settings';
import { brushMaterial, isBrushMaterial, releasedMaterial } from '@/engine/editor/csg/brush-ghost-materials';
import { AXIS_LABEL, brushExtentAlong, defaultHollowThickness, mirrorBrushTransform, placeBrush, placeHollowBrush, placeSliceBrush, targetSourceMesh, type Axis, type AxisSide, } from '@/engine/editor/csg/brush-placement';
import { autoMeshColliderCommand, csgCollisionState } from './csg-physics-operations';
import { describeEntities, preserveWorldTransform, topLevelOnly } from './entity-operations';
const OPERATION_VERB: Record<CsgOperation, (brush: string, target: string) => string> = {
    subtract: (brush, target) => `Subtrair ${brush} de ${target}`,
    union: (brush, target) => `Unir ${brush} a ${target}`,
    intersect: (brush, target) => `Interseção de ${brush} com ${target}`,
};
export const MAX_BRUSH_REPEAT = 64;
interface CsgComponentState {
    csg: CsgSettings | null;
    mesh: MeshData | null;
}
function setCsgComponentCommand(entity: Entity, settings: CsgSettings | null, label: string, keepResult = false): Command {
    const before: CsgComponentState = { csg: entity.csg, mesh: entity.mesh };
    let afterMesh = entity.mesh;
    if (settings)
        afterMesh = settings.sourceMesh;
    else if (!keepResult && entity.csg)
        afterMesh = entity.csg.sourceMesh;
    const after: CsgComponentState = { csg: settings, mesh: afterMesh };
    return new SetValueCommand<CsgComponentState>(label, (value) => {
        entity.csg = value.csg;
        entity.mesh = value.mesh;
    }, before, after);
}
function becomeTargetCommands(session: EditorSession, target: Entity, label: string): Command[] {
    if (target.csg)
        return [];
    const commands: Command[] = [setCsgComponentCommand(target, createCsgSettings(target.mesh as MeshData), label)];
    const collider = autoMeshColliderCommand(session, target);
    if (collider)
        commands.push(collider);
    else if (csgCollisionState(target) === 'dynamic') {
        session.log.warn('Física', `${target.name} é dinâmico: a colisão continua pelo colisor primitivo e ignora os furos. Troque para malha no painel Física se quiser atravessá-los.`);
    }
    return commands;
}
interface BrushComponentState {
    csgBrush: CsgBrushSettings | null;
    material: Material | null;
    castShadows: boolean;
    rigidBody: RigidBodySettings | null;
}
function setBrushComponentCommand(entity: Entity, after: BrushComponentState, label: string): Command {
    const before: BrushComponentState = { csgBrush: entity.csgBrush, material: entity.material, castShadows: entity.castShadows, rigidBody: entity.rigidBody };
    return new SetValueCommand<BrushComponentState>(label, (value) => {
        entity.csgBrush = value.csgBrush;
        entity.material = value.material;
        entity.castShadows = value.castShadows;
        entity.rigidBody = value.rigidBody;
    }, before, after);
}
function brushStateWith(entity: Entity, csgBrush: CsgBrushSettings): BrushComponentState {
    return { csgBrush, material: entity.material, castShadows: entity.castShadows, rigidBody: null };
}
function createBrushEntity(session: EditorSession, name: string, mesh: MeshData, operation: CsgOperation): Entity {
    const brush = session.scene.createEntity({ name, kind: 'mesh', mesh, material: brushMaterial(operation), csgBrush: createCsgBrushSettings(operation), castShadows: false }, null);
    brush.name = uniqueEntityName(session.scene, brush.name);
    return brush;
}
function commitNewBrush(session: EditorSession, target: Entity, brush: Entity, label: string, hint: string, index = target.children.length): Entity {
    const commands = becomeTargetCommands(session, target, label);
    commands.push(new AddEntityCommand(label, brush, target, index));
    session.history.execute(commands.length === 1 ? commands[0] : new CompositeCommand(label, commands));
    session.select(brush);
    session.log.info('CSG', `${label}. ${hint}`);
    return brush;
}
function rejectTarget(session: EditorSession, target: Entity): boolean {
    if (canBeCsgTarget(target))
        return false;
    session.log.warn('CSG', `${target.name} não pode receber pincéis: só atores de malha estática são alvos CSG.`);
    return true;
}
export function makeCsgTarget(session: EditorSession, entity: Entity): boolean {
    if (entity.csg || rejectTarget(session, entity))
        return false;
    const label = `Tornar ${entity.name} alvo CSG`;
    const commands = becomeTargetCommands(session, entity, label);
    session.history.execute(commands.length === 1 ? commands[0] : new CompositeCommand(label, commands));
    session.log.info('CSG', `${entity.name} agora é um alvo CSG: adicione pincéis para esculpi-lo.`);
    return true;
}
export function addCsgBrush(session: EditorSession, target: Entity, shape: CsgBrushShape, operation: CsgOperation = 'subtract'): Entity | null {
    if (rejectTarget(session, target))
        return null;
    const brush = createBrushEntity(session, `Pincel ${CSG_SHAPE_LABEL[shape]}`, getPrimitive(shape).create(), operation);
    placeBrush(brush, target, shape);
    return commitNewBrush(session, target, brush, OPERATION_VERB[operation](brush.name, target.name), 'Mova o pincel com o gizmo: o alvo é reconstruído ao vivo.');
}
export function addCsgBrushToSelection(session: EditorSession, shape: CsgBrushShape, operation: CsgOperation = 'subtract'): Entity | null {
    const selected = session.selectedEntity;
    if (!selected) {
        session.log.warn('CSG', 'Selecione um ator de malha para receber o pincel.');
        return null;
    }
    const target = selected.csgBrush ? brushTarget(selected) : selected;
    if (!target)
        return null;
    return addCsgBrush(session, target, shape, operation);
}
export function hollowCsgTarget(session: EditorSession, target: Entity, thickness = defaultHollowThickness(target)): Entity | null {
    if (rejectTarget(session, target))
        return null;
    const brush = createBrushEntity(session, 'Pincel Oco', targetSourceMesh(target), 'subtract');
    placeHollowBrush(brush, target, Math.max(thickness, 1e-3));
    return commitNewBrush(session, target, brush, `Escavar ${target.name}`, `Paredes de ${thickness.toFixed(2)} m; escale o pincel para ajustar a espessura.`);
}
export function sliceCsgTarget(session: EditorSession, target: Entity, axis: Axis, side: AxisSide): Entity | null {
    if (rejectTarget(session, target))
        return null;
    const brush = createBrushEntity(session, `Pincel Fatia ${side > 0 ? '+' : '−'}${AXIS_LABEL[axis]}`, getPrimitive('box').create(), 'subtract');
    placeSliceBrush(brush, target, axis, side);
    return commitNewBrush(session, target, brush, `Fatiar ${target.name} em ${side > 0 ? '+' : '−'}${AXIS_LABEL[axis]}`, 'Mova o pincel para deslocar o plano de corte.');
}
export function convertToBrushes(session: EditorSession, target: Entity, entities: readonly Entity[], operation: CsgOperation): number {
    if (!canBeCsgTarget(target))
        return 0;
    const brushes = topLevelOnly(entities).filter((entity) => entity !== target && canBeCsgBrush(entity) && !entity.contains(target));
    if (brushes.length === 0)
        return 0;
    session.scene.updateWorldMatrices();
    const label = OPERATION_VERB[operation](describeEntities(brushes), target.name);
    const commands = becomeTargetCommands(session, target, label);
    let index = target.children.length;
    for (const brush of brushes) {
        if (brush.parent !== target) {
            commands.push(new ReparentEntityCommand(brush, target, index++));
            const preserve = preserveWorldTransform(brush, target.worldMatrix);
            if (preserve)
                commands.push(preserve);
        }
        commands.push(setBrushComponentCommand(brush, { csgBrush: createCsgBrushSettings(operation), material: brushMaterial(operation), castShadows: false, rigidBody: null }, label));
    }
    session.history.execute(new CompositeCommand(label, commands));
    session.setSelection(brushes);
    session.log.info('CSG', `${label}.`);
    return brushes.length;
}
export function applyCsgToSelection(session: EditorSession, operation: CsgOperation): boolean {
    const target = session.selectedEntity;
    if (!target)
        return false;
    const others = session.selectedEntities().filter((entity) => entity !== target);
    if (others.length === 0) {
        session.log.warn('CSG', 'Selecione o alvo e, com Ctrl, os atores que servirão de pincel.');
        return false;
    }
    return convertToBrushes(session, target, others, operation) > 0;
}
export function setBrushOperation(session: EditorSession, brush: Entity, operation: CsgOperation): void {
    const settings = brush.csgBrush;
    if (!settings || settings.operation === operation)
        return;
    const after = cloneCsgBrushSettings(settings);
    after.operation = operation;
    const state = brushStateWith(brush, after);
    if (isBrushMaterial(brush.material))
        state.material = brushMaterial(operation);
    session.history.execute(setBrushComponentCommand(brush, state, `Pincel: ${CSG_OPERATION_LABEL[operation].toLowerCase()}`));
}
export function cycleBrushOperation(session: EditorSession, brush: Entity): void {
    const settings = brush.csgBrush;
    if (!settings)
        return;
    const next = CSG_OPERATIONS[(CSG_OPERATIONS.indexOf(settings.operation) + 1) % CSG_OPERATIONS.length];
    setBrushOperation(session, brush, next);
}
export function setBrushEnabled(session: EditorSession, brush: Entity, enabled: boolean): void {
    const settings = brush.csgBrush;
    if (!settings || settings.enabled === enabled)
        return;
    const after = cloneCsgBrushSettings(settings);
    after.enabled = enabled;
    session.history.execute(setBrushComponentCommand(brush, brushStateWith(brush, after), enabled ? 'Ativar pincel' : 'Desativar pincel'));
}
export function toggleBrushEnabledSelected(session: EditorSession): void {
    const brushes = session.selectedEntities().filter((entity) => entity.csgBrush);
    if (brushes.length === 0)
        return;
    const enable = brushes.some((brush) => !brush.csgBrush?.enabled);
    const commands = brushes
        .filter((brush) => brush.csgBrush && brush.csgBrush.enabled !== enable)
        .map((brush) => {
        const after = cloneCsgBrushSettings(brush.csgBrush as CsgBrushSettings);
        after.enabled = enable;
        return setBrushComponentCommand(brush, brushStateWith(brush, after), enable ? 'Ativar pincel' : 'Desativar pincel');
    });
    if (commands.length === 0)
        return;
    session.history.execute(commands.length === 1 ? commands[0] : new CompositeCommand(`${enable ? 'Ativar' : 'Desativar'} ${commands.length} pincéis`, commands));
}
export function moveBrush(session: EditorSession, brush: Entity, direction: -1 | 1): boolean {
    const target = brush.parent;
    if (!brush.csgBrush || !target)
        return false;
    const { children } = target;
    const current = children.indexOf(brush);
    let neighbour = -1;
    for (let i = current + direction; i >= 0 && i < children.length; i += direction) {
        if (children[i].csgBrush) {
            neighbour = i;
            break;
        }
    }
    if (neighbour === -1)
        return false;
    session.history.execute(new ReparentEntityCommand(brush, target, neighbour));
    session.select(brush);
    return true;
}
export function moveBrushSelected(session: EditorSession, direction: -1 | 1): void {
    const brush = session.selectedEntity;
    if (brush?.csgBrush)
        moveBrush(session, brush, direction);
}
export function mirrorBrush(session: EditorSession, brush: Entity, axis: Axis): Entity | null {
    const target = brush.parent;
    if (!brush.csgBrush || !target)
        return null;
    const copy = cloneEntity(session.scene, brush, null);
    copy.name = uniqueEntityName(session.scene, brush.name);
    mirrorBrushTransform(copy, axis);
    const label = `Espelhar ${brush.name} em ${AXIS_LABEL[axis]}`;
    session.history.execute(new AddEntityCommand(label, copy, target, target.children.indexOf(brush) + 1));
    session.select(copy);
    session.log.info('CSG', `${label}.`);
    return copy;
}
export interface RepeatBrushOptions {
    count: number;
    axis: Axis;
    spacing?: number;
}
export function repeatBrush(session: EditorSession, brush: Entity, options: RepeatBrushOptions): Entity[] {
    const target = brush.parent;
    if (!brush.csgBrush || !target)
        return [];
    const count = Math.min(Math.max(Math.floor(options.count), 1), MAX_BRUSH_REPEAT);
    const spacing = options.spacing ?? brushExtentAlong(brush, options.axis) * 2;
    if (!(spacing > 0))
        return [];
    const base = target.children.indexOf(brush);
    const copies: Entity[] = [];
    const commands: Command[] = [];
    for (let i = 1; i <= count; i++) {
        const copy = cloneEntity(session.scene, brush, null);
        copy.name = uniqueEntityName(session.scene, brush.name);
        copy.transform.position[options.axis] += spacing * i;
        copies.push(copy);
        commands.push(new AddEntityCommand(`Repetir ${brush.name}`, copy, target, base + i));
    }
    const label = `Repetir ${brush.name} ${count}× em ${AXIS_LABEL[options.axis]}`;
    session.history.execute(commands.length === 1 ? commands[0] : new CompositeCommand(label, commands));
    session.setSelection(copies);
    session.log.info('CSG', `${label} (espaçamento ${spacing.toFixed(2)} m).`);
    return copies;
}
export function releaseBrush(session: EditorSession, brush: Entity): boolean {
    if (!brush.csgBrush || !brush.parent)
        return false;
    const target = brush.parent;
    const destination = target.parent ?? target;
    session.scene.updateWorldMatrices();
    const commands: Command[] = [];
    const label = `Soltar ${brush.name}`;
    const material = isBrushMaterial(brush.material) ? releasedMaterial() : brush.material;
    commands.push(setBrushComponentCommand(brush, { csgBrush: null, material, castShadows: true, rigidBody: null }, label));
    if (destination !== target) {
        commands.push(new ReparentEntityCommand(brush, destination, destination.children.indexOf(target) + 1));
        const preserve = preserveWorldTransform(brush, destination.worldMatrix);
        if (preserve)
            commands.push(preserve);
    }
    session.history.execute(new CompositeCommand(label, commands));
    session.select(brush);
    session.log.info('CSG', `${brush.name} deixou de ser pincel de ${target.name}.`);
    return true;
}
function updateCsgSettings(session: EditorSession, target: Entity, label: string, mutate: (settings: CsgSettings) => void): void {
    const current = target.csg;
    if (!current)
        return;
    const after = cloneCsgSettings(current);
    mutate(after);
    session.history.execute(new SetValueCommand<CsgSettings>(label, (value) => {
        target.csg = value;
    }, current, after));
}
export function setCsgLive(session: EditorSession, target: Entity, live: boolean): void {
    if (target.csg?.live === live)
        return;
    updateCsgSettings(session, target, live ? 'CSG ao vivo' : 'Congelar CSG', (settings) => {
        settings.live = live;
    });
    if (live)
        session.csg.rebuildNow(session.scene, target);
}
export function setCsgShowBrushes(session: EditorSession, target: Entity, show: boolean): void {
    if (target.csg?.showBrushes === show)
        return;
    updateCsgSettings(session, target, show ? 'Mostrar pincéis' : 'Ocultar pincéis', (settings) => {
        settings.showBrushes = show;
    });
}
export function setCsgPrecision(session: EditorSession, target: Entity, precision: CsgPrecision): void {
    if (target.csg?.precision === precision)
        return;
    updateCsgSettings(session, target, `Precisão ${CSG_PRECISION_LABEL[precision].toLowerCase()}`, (settings) => {
        settings.precision = precision;
    });
}
export function rebuildCsg(session: EditorSession, target: Entity): void {
    if (!target.csg)
        return;
    session.csg.rebuildNow(session.scene, target);
    const stats = session.csg.statsOf(target);
    session.log.info('CSG', `${target.name} reconstruído${stats ? ` em ${stats.lastBuildMs.toFixed(1)} ms (${stats.resultTriangles.toLocaleString('pt-BR')} triângulos)` : ''}.`);
}
export function consolidateCsg(session: EditorSession, target: Entity): boolean {
    if (!target.csg)
        return false;
    session.csg.rebuildNow(session.scene, target);
    const brushes = brushesOf(target);
    const label = `Consolidar CSG de ${target.name}`;
    const commands: Command[] = brushes.map((brush) => new RemoveEntityCommand(brush));
    commands.push(setCsgComponentCommand(target, null, label, true));
    session.history.execute(new CompositeCommand(label, commands));
    session.csg.invalidate(target);
    session.select(target);
    session.log.info('CSG', `${target.name} consolidado: ${brushes.length} ${brushes.length === 1 ? 'pincel removido' : 'pincéis removidos'}, a malha resultante ficou no ator.`);
    return true;
}
export function revertCsg(session: EditorSession, target: Entity): boolean {
    if (!target.csg)
        return false;
    const brushes = brushesOf(target);
    const label = `Reverter CSG de ${target.name}`;
    const commands: Command[] = brushes.map((brush) => new RemoveEntityCommand(brush));
    commands.push(setCsgComponentCommand(target, null, label));
    session.history.execute(new CompositeCommand(label, commands));
    session.csg.invalidate(target);
    session.select(target);
    session.log.info('CSG', `${target.name} voltou à malha original.`);
    return true;
}
export function extractCsgResult(session: EditorSession, target: Entity): Entity | null {
    const parent = target.parent;
    if (!target.csg || !target.mesh || !parent)
        return null;
    session.csg.rebuildNow(session.scene, target);
    const mesh = copyMeshData(target.mesh, `${target.name} (resultado)`);
    const material = target.material ? (target.material.libraryId ? target.material : cloneMaterial(target.material)) : undefined;
    const result = session.scene.createEntity({
        name: uniqueEntityName(session.scene, `${target.name}_Resultado`),
        kind: 'mesh',
        mesh,
        material,
        rigidBody: target.rigidBody ? cloneRigidBodySettings(target.rigidBody) : undefined,
        castShadows: target.castShadows,
        receiveShadows: target.receiveShadows,
    }, null);
    vec3.copy(result.transform.position, target.transform.position);
    vec3.copy(result.transform.rotation, target.transform.rotation);
    vec3.copy(result.transform.scale, target.transform.scale);
    const label = `Extrair resultado de ${target.name}`;
    session.history.execute(new AddEntityCommand(label, result, parent, parent.children.indexOf(target) + 1));
    session.select(result);
    session.log.info('CSG', `${result.name} criado com ${(mesh.indices.length / 3).toLocaleString('pt-BR')} triângulos; ${target.name} continua editável.`);
    return result;
}
export function selectBrushTarget(session: EditorSession, brush: Entity): void {
    const target = brushTarget(brush);
    if (target)
        session.select(target);
}
