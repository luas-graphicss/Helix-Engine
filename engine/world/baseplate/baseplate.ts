import * as vec3 from '@/engine/core/math/vec3';
import type { Scene } from '@/engine/core/scene/scene';
import type { Entity } from '@/engine/core/scene/entity';
import { createMaterial } from '@/engine/core/scene/material';
import { createBox } from '@/engine/renderer/geometry/primitives';
import { createRigidBodySettings } from '@/engine/physics/body/rigid-body-settings';
import { createGridTexture, GRID_TILE_METERS } from './grid-texture';
export const BASEPLATE_NAME = 'Helix';
export const BASEPLATE_SIZE = 64;
export const BASEPLATE_THICKNESS = 2;
export function createBaseplate(scene: Scene, parent: Entity): Entity {
    const mesh = createBox(BASEPLATE_SIZE, BASEPLATE_THICKNESS, BASEPLATE_SIZE, GRID_TILE_METERS);
    const material = createMaterial({
        name: 'Helix · Grade',
        baseColor: vec3.create(1, 1, 1),
        roughness: 0.82,
        baseColorMap: createGridTexture(),
    });
    const entity = scene.createEntity({ name: BASEPLATE_NAME, kind: 'mesh', mesh, material, castShadows: false }, parent);
    vec3.set(entity.transform.position, 0, -BASEPLATE_THICKNESS / 2, 0);
    entity.rigidBody = createRigidBodySettings({
        type: 'static',
        collider: 'box',
        boxSize: vec3.create(BASEPLATE_SIZE, BASEPLATE_THICKNESS, BASEPLATE_SIZE),
        friction: 0.8,
    });
    return entity;
}
