import * as aabb from '@/engine/core/math/aabb';
import * as mat4 from '@/engine/core/math/mat4';
import type { Mat4 } from '@/engine/core/math/mat4';
import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { Entity } from '@/engine/core/scene/entity';
import type { Scene } from '@/engine/core/scene/scene';
import type { CharacterSettings } from '@/engine/character/character-settings';
import type { RigidBodySettings } from '@/engine/physics/body/rigid-body-settings';
import type { Terrain } from '@/engine/terrain/core/terrain';
import { createBoxCollider, createCapsuleCollider, createHeightfieldCollider, createSphereCollider, type ClothCollider } from './cloth-collider';
const X_COLUMN = 0;
const Y_COLUMN = 4;
const Z_COLUMN = 8;
const COLUMNS = [X_COLUMN, Y_COLUMN, Z_COLUMN] as const;
function columnLength(matrix: Mat4, column: number): number {
    return Math.hypot(matrix[column], matrix[column + 1], matrix[column + 2]);
}
function unitColumn(matrix: Mat4, column: number): Vec3 {
    const length = columnLength(matrix, column) || 1;
    return vec3.create(matrix[column] / length, matrix[column + 1] / length, matrix[column + 2] / length);
}
function rigidBodyCollider(entity: Entity, settings: RigidBodySettings): ClothCollider | null {
    const matrix = entity.worldMatrix;
    const scaleX = columnLength(matrix, X_COLUMN);
    const scaleY = columnLength(matrix, Y_COLUMN);
    const scaleZ = columnLength(matrix, Z_COLUMN);
    const center = mat4.transformPoint(vec3.create(), matrix, settings.center);
    switch (settings.collider) {
        case 'sphere':
            return createSphereCollider(center, settings.radius * Math.max(scaleX, scaleY, scaleZ));
        case 'capsule': {
            const radius = settings.radius * Math.max(scaleX, scaleZ);
            const halfHeight = Math.max(0, settings.height * 0.5 * scaleY - radius);
            const up = unitColumn(matrix, Y_COLUMN);
            return createCapsuleCollider(vec3.scaleAndAdd(vec3.create(), center, up, -halfHeight), vec3.scaleAndAdd(vec3.create(), center, up, halfHeight), radius);
        }
        case 'box': {
            const axes = new Float32Array(9);
            COLUMNS.forEach((column, axis) => axes.set(unitColumn(matrix, column), axis * 3));
            const halfExtents = vec3.create(settings.boxSize[0] * 0.5 * scaleX, settings.boxSize[1] * 0.5 * scaleY, settings.boxSize[2] * 0.5 * scaleZ);
            return createBoxCollider(center, axes, halfExtents);
        }
        case 'mesh':
            return null;
    }
}
function characterCollider(entity: Entity, settings: CharacterSettings): ClothCollider {
    const matrix = entity.worldMatrix;
    const scale = columnLength(matrix, Y_COLUMN);
    const radius = settings.radius * scale;
    const height = Math.max(settings.height * scale, 2 * radius);
    const feet = mat4.getTranslation(vec3.create(), matrix);
    return createCapsuleCollider(vec3.create(feet[0], feet[1] + radius, feet[2]), vec3.create(feet[0], feet[1] + height - radius, feet[2]), radius);
}
function terrainCollider(entity: Entity, terrain: Terrain): ClothCollider | null {
    const world = mat4.copy(mat4.create(), entity.worldMatrix);
    const inverse = mat4.invert(mat4.create(), world);
    if (!inverse)
        return null;
    return createHeightfieldCollider(aabb.transform(aabb.create(), terrain.localBounds, world), (x, z) => {
        const localX = inverse[0] * x + inverse[8] * z + inverse[12];
        const localZ = inverse[2] * x + inverse[10] * z + inverse[14];
        if (!terrain.containsLocal(localX, localZ))
            return -Infinity;
        return terrain.heightAtLocal(localX, localZ) * world[5] + world[13];
    });
}
function colliderOf(entity: Entity): ClothCollider | null {
    if (entity.terrain)
        return terrainCollider(entity, entity.terrain);
    if (entity.rigidBody)
        return rigidBodyCollider(entity, entity.rigidBody);
    if (entity.character)
        return characterCollider(entity, entity.character);
    return null;
}
export function collectSceneColliders(scene: Scene): ClothCollider[] {
    const colliders: ClothCollider[] = [];
    scene.traverse((entity) => {
        if (entity.cloth)
            return;
        const collider = colliderOf(entity);
        if (collider)
            colliders.push(collider);
    });
    return colliders;
}
