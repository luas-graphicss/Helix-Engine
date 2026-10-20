import * as vec3 from '@/engine/core/math/vec3';
import type { Scene } from './scene';
import type { Entity } from './entity';
import { cloneMaterial } from './material';
import { cloneLight } from './light';
import { cloneRigidBodySettings } from '@/engine/physics/body/rigid-body-settings';
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
    const entity = scene.createEntity({
        name: source.name,
        kind: source.kind,
        mesh: source.mesh ?? undefined,
        material: source.material ? cloneMaterial(source.material) : undefined,
        light: source.light ? cloneLight(source.light) : undefined,
        terrain: source.terrain ? source.terrain.clone() : undefined,
        rigidBody: source.rigidBody ? cloneRigidBodySettings(source.rigidBody) : undefined,
        castShadows: source.castShadows,
        receiveShadows: source.receiveShadows,
    }, parent);
    vec3.copy(entity.transform.position, source.transform.position);
    vec3.copy(entity.transform.rotation, source.transform.rotation);
    vec3.copy(entity.transform.scale, source.transform.scale);
    entity.visible = source.visible;
    for (const child of source.children)
        cloneEntity(scene, child, entity);
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
