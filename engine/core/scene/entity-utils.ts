import * as vec3 from '@/engine/core/math/vec3';
import type { Scene } from './scene';
import type { Entity } from './entity';
import { cloneMaterial } from './material';
import { cloneLight } from './light';
import { Skin } from './skin';
import { cloneRigidBodySettings } from '@/engine/physics/body/rigid-body-settings';
import { cloneCharacterSettings } from '@/engine/character/character-settings';
import { cloneCsgBrushSettings, cloneCsgSettings } from '@/engine/geometry/csg/csg-settings';
import { copyMeshData } from '@/engine/geometry/csg/csg-boolean';
const NUMERIC_SUFFIX = /_\d+$/;
export function uniqueEntityName(scene: Scene, desired: string, ignore: Entity | null = null): string {
    const taken = new Set<string>();
    scene.traverse((entity) => {
        if (entity !== ignore)
            taken.add(entity.name);
    });
    if (!taken.has(desired))
        return desired;
    const base = desired.replace(NUMERIC_SUFFIX, '') || 'Ator';
    for (let suffix = 2;; suffix++) {
        const candidate = `${base}_${suffix}`;
        if (!taken.has(candidate))
            return candidate;
    }
}
export function cloneEntity(scene: Scene, source: Entity, parent: Entity | null): Entity {
    const copies = new Map<Entity, Entity>();
    const entity = cloneSubtree(scene, source, parent, copies);
    for (const [original, copy] of copies) {
        if (original.rig)
            copy.rig = original.rig.remap(copies);
        const { skin } = original;
        if (!skin)
            continue;
        copy.skin = new Skin(skin.joints.map((joint) => copies.get(joint) ?? joint), skin.inverseBindMatrices, skin.restBounds);
    }
    return entity;
}
function cloneSubtree(scene: Scene, source: Entity, parent: Entity | null, copies: Map<Entity, Entity>): Entity {
    const entity = scene.createEntity({
        name: source.name,
        kind: source.kind,
        mesh: source.mesh ? (source.csg ? copyMeshData(source.mesh) : source.mesh) : undefined,
        material: source.material ? (source.material.libraryId ? source.material : cloneMaterial(source.material)) : undefined,
        light: source.light ? cloneLight(source.light) : undefined,
        terrain: source.terrain ? source.terrain.clone() : undefined,
        rigidBody: source.rigidBody ? cloneRigidBodySettings(source.rigidBody) : undefined,
        character: source.character ? cloneCharacterSettings(source.character) : undefined,
        csg: source.csg ? cloneCsgSettings(source.csg) : undefined,
        csgBrush: source.csgBrush ? cloneCsgBrushSettings(source.csgBrush) : undefined,
        castShadows: source.castShadows,
        receiveShadows: source.receiveShadows,
        locked: source.locked,
    }, parent);
    vec3.copy(entity.transform.position, source.transform.position);
    vec3.copy(entity.transform.rotation, source.transform.rotation);
    vec3.copy(entity.transform.scale, source.transform.scale);
    entity.visible = source.visible;
    copies.set(source, entity);
    for (const child of source.children)
        cloneSubtree(scene, child, entity, copies);
    return entity;
}
export function entityPath(entity: Entity): string {
    const names: string[] = [];
    let current: Entity | null = entity;
    while (current && current.parent) {
        names.unshift(current.name);
        current = current.parent;
    }
    return names.join(' / ');
}
