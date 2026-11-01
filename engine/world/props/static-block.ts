import * as vec3 from '@/engine/core/math/vec3';
import type { Scene } from '@/engine/core/scene/scene';
import type { Entity } from '@/engine/core/scene/entity';
import type { Material } from '@/engine/core/scene/material';
import { createBox } from '@/engine/renderer/geometry/primitives';
import { createRigidBodySettings, type RigidBodySettings } from '@/engine/physics/body/rigid-body-settings';
import { defaultMassForSettings } from '@/engine/physics/body/collider-fit';
import { concrete } from './prop-materials';
export type Size3 = readonly [
    number,
    number,
    number
];
export type Position3 = readonly [
    number,
    number,
    number
];
export interface BlockOptions {
    rotation?: readonly [
        number,
        number,
        number
    ];
    material?: Material;
    body?: Partial<RigidBodySettings>;
}
export function staticBlock(scene: Scene, parent: Entity, name: string, size: Size3, position: Position3, options: BlockOptions = {}): Entity {
    const entity = scene.createEntity({ name, kind: 'mesh', mesh: createBox(size[0], size[1], size[2]), material: options.material ?? concrete(`${name} · Concreto`) }, parent);
    vec3.set(entity.transform.position, position[0], position[1], position[2]);
    if (options.rotation)
        vec3.set(entity.transform.rotation, options.rotation[0], options.rotation[1], options.rotation[2]);
    entity.rigidBody = createRigidBodySettings({ type: 'static', collider: 'box', boxSize: vec3.create(size[0], size[1], size[2]), friction: 0.8, ...options.body });
    return entity;
}
export function dynamicBody(entity: Entity, settings: Partial<RigidBodySettings>): void {
    const body = createRigidBodySettings(settings);
    body.mass = defaultMassForSettings(body, entity.transform.scale);
    entity.rigidBody = body;
}
