import * as vec3 from '@/engine/core/math/vec3';
import type { Entity } from '@/engine/core/scene/entity';
import { createMaterial } from '@/engine/core/scene/material';
import { addEntity, addFolder, addLight, deleteEntities, duplicateEntities, renameEntity, spawnPosition, type LightKind } from '@/engine/editor/operations/entity-operations';
import { createRigidBodyForEntity } from '@/engine/editor/operations/physics-operations';
import { applyTransformSnapshot, commitTransform, snapshotTransform } from '@/engine/editor/operations/transform-operations';
import { getPrimitive, PRIMITIVES } from '@/engine/editor/primitives/primitive-catalog';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import type { BodyType } from '@/engine/physics/body/rigid-body-settings';
import type { AssistantTool } from './assistant-tool';
import { HEX_COLOR_HINT, optionalLinearColor } from './color-input';
import { requireActors, requireEntity, resolveParent } from './entity-access';
import { summarizeEntity } from './entity-summary';
import { applyLightSettings, LIGHT_SETTING_PARAMETERS } from './light-settings-input';
import type { ToolInput } from './tool-input';
import { choice, flag, integer, integerList, parameters, text } from './tool-parameters';
import { POSITION_PARAMETER, ROTATION_PARAMETER, SCALE_PARAMETER, transformFrom } from './transform-input';
const TREE_DEPTH = 6;
const TREE_ENTRY_LIMIT = 300;
const PRIMITIVE_GRAY = 0.7;
const PRIMITIVE_ROUGHNESS = 0.6;
const DEFAULT_GROUP_NAME = 'Grupo';
const PRIMITIVE_KINDS = PRIMITIVES.map((primitive) => primitive.kind);
const LIGHT_KINDS: readonly LightKind[] = ['directional', 'ambient', 'point', 'spot', 'rect', 'disc', 'tube'];
const BODY_TYPES: readonly BodyType[] = ['static', 'kinematic', 'dynamic'];
const PARENT_PARAMETER = integer('Id of the parent entity. Omit to place it at the scene root.');
function describeTree(root: Entity, maxDepth: number): string {
    const lines: string[] = [];
    const visit = (entity: Entity, depth: number): void => {
        if (lines.length >= TREE_ENTRY_LIMIT)
            return;
        const collapsed = depth >= maxDepth && entity.children.length > 0;
        const hidden = entity.visible ? '' : ' hidden';
        const more = collapsed ? ` (+${entity.children.length} children)` : '';
        lines.push(`${'  '.repeat(depth)}#${entity.id} ${entity.kind} "${entity.name}"${hidden}${more}`);
        if (collapsed)
            return;
        for (const child of entity.children)
            visit(child, depth + 1);
    };
    visit(root, 0);
    if (lines.length >= TREE_ENTRY_LIMIT)
        lines.push(`Listing stopped at ${TREE_ENTRY_LIMIT} entities. Pass parentId to list a subtree.`);
    return lines.join('\n');
}
function repositionAdded(session: EditorSession, entity: Entity, input: ToolInput): void {
    const before = snapshotTransform(entity);
    const after = transformFrom(entity, input);
    if (after)
        commitTransform(session, entity, before, after, `Posicionar ${entity.name}`);
}
const listScene: AssistantTool = {
    name: 'list_scene',
    title: 'Listar a cena',
    access: 'read',
    description: 'Lists the scene hierarchy as an indented tree. Each line reads `#id kind "name"`. Use the ids with the other tools.',
    parameters: parameters({
        parentId: integer('Entity id to list from. Omit for the whole scene.'),
        maxDepth: integer(`Levels to expand. Default ${TREE_DEPTH}.`),
    }),
    run(session, input) {
        const parentId = input.optionalInteger('parentId');
        const root = parentId === undefined ? session.scene.root : requireEntity(session, parentId);
        return describeTree(root, input.optionalInteger('maxDepth') ?? TREE_DEPTH);
    },
};
const inspectEntities: AssistantTool = {
    name: 'inspect_entities',
    title: 'Ler o inspetor',
    access: 'read',
    description: 'Returns the inspector values of entities: transform, material, light, rigid body, script and terrain. Omit ids to inspect the current selection.',
    parameters: parameters({ ids: integerList('Entity ids to inspect.') }),
    run(session, input) {
        const entities = input.has('ids') ? input.integers('ids').map((id) => requireEntity(session, id)) : session.selectedEntities();
        return { entities: entities.map(summarizeEntity) };
    },
};
const selectEntities: AssistantTool = {
    name: 'select_entities',
    title: 'Selecionar atores',
    access: 'read',
    description: 'Selects entities in the editor so the user sees them in the hierarchy and inspector. Optionally frames the first one in the viewport.',
    parameters: parameters({ ids: integerList('Entity ids to select.'), focus: flag('Frame the first entity in the viewport.') }, ['ids']),
    run(session, input) {
        const entities = requireActors(session, input.integers('ids'));
        session.setSelection(entities);
        if (input.optionalFlag('focus'))
            session.focusEntity(entities[0]);
        return `Selected ${entities.map((entity) => entity.name).join(', ')}.`;
    },
};
const createPrimitive: AssistantTool = {
    name: 'create_primitive',
    title: 'Criar primitiva',
    access: 'scene',
    description: 'Adds a primitive mesh to the scene. Unscaled sizes: box 1x1x1, sphere radius 0.5, plane 2x2 facing up, cylinder and cone radius 0.5 height 1, torus radius 0.5, capsule height 1. Without a position it spawns at the camera target.',
    parameters: parameters({
        kind: choice('Primitive shape.', PRIMITIVE_KINDS),
        name: text('Entity name.'),
        position: POSITION_PARAMETER,
        rotation: ROTATION_PARAMETER,
        scale: SCALE_PARAMETER,
        color: text(`Base color. ${HEX_COLOR_HINT}`),
        physics: choice('Adds a rigid body. static never moves, dynamic falls and collides, kinematic is moved by scripts.', BODY_TYPES),
        parentId: PARENT_PARAMETER,
    }, ['kind']),
    run(session, input) {
        const definition = getPrimitive(input.choice('kind', PRIMITIVE_KINDS));
        const mesh = definition.create();
        const baseColor = optionalLinearColor(input, 'color') ?? vec3.create(PRIMITIVE_GRAY, PRIMITIVE_GRAY, PRIMITIVE_GRAY);
        const name = input.optionalText('name')?.trim() || definition.label;
        const entity = session.scene.createEntity({ name, kind: 'mesh', mesh, material: createMaterial({ baseColor, roughness: PRIMITIVE_ROUGHNESS }) }, null);
        vec3.copy(entity.transform.position, spawnPosition(session, mesh));
        const placed = transformFrom(entity, input);
        if (placed)
            applyTransformSnapshot(entity, placed);
        const body = input.optionalChoice('physics', BODY_TYPES);
        if (body)
            entity.rigidBody = createRigidBodyForEntity(entity, { type: body });
        addEntity(session, entity, resolveParent(session, input.optionalInteger('parentId')));
        return summarizeEntity(entity);
    },
};
const createLight: AssistantTool = {
    name: 'create_light',
    title: 'Criar luz',
    access: 'scene',
    description: 'Adds a light. directional lights the whole scene from its rotation, ambient fills shadows, the others are local lights placed at a position.',
    parameters: parameters({
        kind: choice('Light type.', LIGHT_KINDS),
        name: text('Entity name.'),
        position: POSITION_PARAMETER,
        rotation: ROTATION_PARAMETER,
        ...LIGHT_SETTING_PARAMETERS,
    }, ['kind']),
    run(session, input) {
        const entity = addLight(session, input.choice('kind', LIGHT_KINDS));
        const name = input.optionalText('name');
        if (name)
            renameEntity(session, entity, name);
        repositionAdded(session, entity, input);
        applyLightSettings(session, entity, input);
        return summarizeEntity(entity);
    },
};
const createGroup: AssistantTool = {
    name: 'create_group',
    title: 'Criar grupo',
    access: 'scene',
    description: 'Adds an empty group entity used to organize and move other entities together.',
    parameters: parameters({ name: text('Group name.'), position: POSITION_PARAMETER, parentId: PARENT_PARAMETER }),
    run(session, input) {
        const parent = resolveParent(session, input.optionalInteger('parentId'));
        const group = addFolder(session, parent, parent.children.length, input.optionalText('name')?.trim() || DEFAULT_GROUP_NAME);
        repositionAdded(session, group, input);
        return summarizeEntity(group);
    },
};
const duplicateEntitiesTool: AssistantTool = {
    name: 'duplicate_entities',
    title: 'Duplicar atores',
    access: 'scene',
    description: 'Duplicates entities with their children. Returns the copies so they can be moved afterwards.',
    parameters: parameters({ ids: integerList('Entity ids to duplicate.') }, ['ids']),
    run(session, input) {
        const copies = duplicateEntities(session, requireActors(session, input.integers('ids')));
        return { copies: copies.map(summarizeEntity) };
    },
};
const deleteEntitiesTool: AssistantTool = {
    name: 'delete_entities',
    title: 'Excluir atores',
    access: 'destructive',
    description: 'Deletes entities and all their children from the scene.',
    parameters: parameters({ ids: integerList('Entity ids to delete.') }, ['ids']),
    run(session, input) {
        const entities = requireActors(session, input.integers('ids'));
        const names = entities.map((entity) => entity.name).join(', ');
        deleteEntities(session, entities);
        return `Deleted ${names}.`;
    },
};
export const SCENE_TOOLS: readonly AssistantTool[] = [listScene, inspectEntities, selectEntities, createPrimitive, createLight, createGroup, duplicateEntitiesTool, deleteEntitiesTool];
