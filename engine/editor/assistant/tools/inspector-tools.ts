import { reparentEntity, renameEntity, setEntityLocked, setEntityVisibility } from '@/engine/editor/operations/entity-operations';
import { setMaterialColor, setMaterialScalar, type MaterialScalar } from '@/engine/editor/operations/material-operations';
import { addRigidBody, removeRigidBody, setRigidBodyScalar, setRigidBodyType, type RigidBodyScalar } from '@/engine/editor/operations/physics-operations';
import { commitTransform, snapshotTransform } from '@/engine/editor/operations/transform-operations';
import type { AssistantTool } from './assistant-tool';
import { HEX_COLOR_HINT, optionalLinearColor } from './color-input';
import { requireActor, requireEntity } from './entity-access';
import { summarizeEntity } from './entity-summary';
import { applyLightSettings, LIGHT_SETTING_PARAMETERS } from './light-settings-input';
import { ToolFailure } from './tool-failure';
import { choice, flag, integer, number, parameters, text } from './tool-parameters';
import { POSITION_PARAMETER, ROTATION_PARAMETER, SCALE_PARAMETER, transformFrom } from './transform-input';
const MATERIAL_SCALARS = ['roughness', 'metallic', 'opacity', 'emissiveIntensity'] as const satisfies readonly MaterialScalar[];
const BODY_SCALARS = ['mass', 'friction', 'restitution'] as const satisfies readonly RigidBodyScalar[];
const BODY_CHOICES = ['none', 'static', 'kinematic', 'dynamic'] as const;
const ENTITY_ID_PARAMETER = integer('Entity id.');
const updateEntity: AssistantTool = {
    name: 'update_entity',
    title: 'Alterar o inspetor',
    access: 'scene',
    description: 'Changes the inspector basics of one entity: name, transform, visibility, lock and parent. Only the given fields change.',
    parameters: parameters({
        id: ENTITY_ID_PARAMETER,
        name: text('New name.'),
        position: POSITION_PARAMETER,
        rotation: ROTATION_PARAMETER,
        scale: SCALE_PARAMETER,
        visible: flag('Show or hide the entity.'),
        locked: flag('Lock or unlock the entity against viewport edits.'),
        parentId: integer('Id of the new parent entity.'),
    }, ['id']),
    run(session, input) {
        const entity = requireActor(session, input.integer('id'));
        const name = input.optionalText('name');
        if (name !== undefined)
            renameEntity(session, entity, name);
        const before = snapshotTransform(entity);
        const after = transformFrom(entity, input);
        if (after)
            commitTransform(session, entity, before, after, `Transformar ${entity.name}`);
        const visible = input.optionalFlag('visible');
        if (visible !== undefined)
            setEntityVisibility(session, entity, visible);
        const locked = input.optionalFlag('locked');
        if (locked !== undefined)
            setEntityLocked(session, entity, locked);
        const parentId = input.optionalInteger('parentId');
        if (parentId !== undefined) {
            const parent = requireEntity(session, parentId);
            if (entity.parent !== parent && !reparentEntity(session, entity, parent, parent.children.length))
                throw new ToolFailure(`${entity.name} cannot be moved into ${parent.name}.`);
        }
        return summarizeEntity(entity);
    },
};
const setMaterial: AssistantTool = {
    name: 'set_material',
    title: 'Alterar material',
    access: 'scene',
    description: 'Changes the material of a mesh entity. Only the given fields change.',
    parameters: parameters({
        id: ENTITY_ID_PARAMETER,
        color: text(`Base color. ${HEX_COLOR_HINT}`),
        emissiveColor: text(`Glow color. ${HEX_COLOR_HINT}`),
        emissiveIntensity: number('Glow strength, 0 to 100.'),
        roughness: number('0 is mirror-like, 1 is matte.'),
        metallic: number('0 is non-metal, 1 is metal.'),
        opacity: number('0 is invisible, 1 is opaque.'),
    }, ['id']),
    run(session, input) {
        const entity = requireActor(session, input.integer('id'));
        if (!entity.material)
            throw new ToolFailure(`${entity.name} (${entity.kind}) has no material.`);
        const color = optionalLinearColor(input, 'color');
        if (color)
            setMaterialColor(session, entity, 'baseColor', color);
        const emissive = optionalLinearColor(input, 'emissiveColor');
        if (emissive)
            setMaterialColor(session, entity, 'emissive', emissive);
        for (const field of MATERIAL_SCALARS) {
            const value = input.optionalNumber(field);
            if (value !== undefined)
                setMaterialScalar(session, entity, field, value);
        }
        return summarizeEntity(entity);
    },
};
const setPhysics: AssistantTool = {
    name: 'set_physics',
    title: 'Alterar física',
    access: 'scene',
    description: 'Adds, changes or removes the rigid body of an entity. The collider is fitted to its mesh.',
    parameters: parameters({
        id: ENTITY_ID_PARAMETER,
        body: choice('none removes the body. static never moves, dynamic is simulated, kinematic is moved by scripts.', BODY_CHOICES),
        mass: number('Mass in kilograms.'),
        friction: number('Surface friction, 0 to 1.'),
        restitution: number('Bounciness, 0 to 1.'),
    }, ['id', 'body']),
    run(session, input) {
        const entity = requireActor(session, input.integer('id'));
        const body = input.choice('body', BODY_CHOICES);
        if (body === 'none') {
            removeRigidBody(session, entity);
            return summarizeEntity(entity);
        }
        addRigidBody(session, entity);
        if (!entity.rigidBody)
            throw new ToolFailure(`${entity.name} cannot carry a rigid body.`);
        setRigidBodyType(session, entity, body);
        for (const field of BODY_SCALARS) {
            const value = input.optionalNumber(field);
            if (value !== undefined)
                setRigidBodyScalar(session, entity, field, value);
        }
        return summarizeEntity(entity);
    },
};
const setLight: AssistantTool = {
    name: 'set_light',
    title: 'Alterar luz',
    access: 'scene',
    description: 'Changes the settings of a light entity. Only the given fields change.',
    parameters: parameters({ id: ENTITY_ID_PARAMETER, ...LIGHT_SETTING_PARAMETERS }, ['id']),
    run(session, input) {
        const entity = requireActor(session, input.integer('id'));
        applyLightSettings(session, entity, input);
        return summarizeEntity(entity);
    },
};
export const INSPECTOR_TOOLS: readonly AssistantTool[] = [updateEntity, setMaterial, setPhysics, setLight];
