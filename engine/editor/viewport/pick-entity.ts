import * as mat4 from '@/engine/core/math/mat4';
import * as vec3 from '@/engine/core/math/vec3';
import { createRay, intersectRayAabb, transformRay, type Ray } from '@/engine/core/math/ray';
import type { Scene } from '@/engine/core/scene/scene';
import type { Entity } from '@/engine/core/scene/entity';
import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import { getLocalBounds } from '@/engine/renderer/geometry/bounds';
import type { TerrainHit } from '@/engine/terrain/core/terrain';
const inverseWorld = mat4.create();
const worldRay = createRay();
const localRay = createRay();
const nearPoint = vec3.create();
const farPoint = vec3.create();
const terrainHit: TerrainHit = { distance: 0, point: vec3.create() };
function unproject(out: vec3.Vec3, x: number, y: number, z: number, inverse: mat4.Mat4): void {
    const w = inverse[3] * x + inverse[7] * y + inverse[11] * z + inverse[15] || 1;
    out[0] = (inverse[0] * x + inverse[4] * y + inverse[8] * z + inverse[12]) / w;
    out[1] = (inverse[1] * x + inverse[5] * y + inverse[9] * z + inverse[13]) / w;
    out[2] = (inverse[2] * x + inverse[6] * y + inverse[10] * z + inverse[14]) / w;
}
export function buildPickRay(out: Ray, camera: PerspectiveCamera, u: number, v: number): Ray | null {
    if (!camera.invertible)
        return null;
    const inverse = camera.inverseViewProjectionMatrix;
    const ndcX = u * 2 - 1;
    const ndcY = 1 - v * 2;
    unproject(nearPoint, ndcX, ndcY, -1, inverse);
    unproject(farPoint, ndcX, ndcY, 1, inverse);
    vec3.copy(out.origin, nearPoint);
    vec3.subtract(out.direction, farPoint, nearPoint);
    vec3.normalize(out.direction, out.direction);
    return out;
}
function intersectLocalRay(entity: Entity): number | null {
    if (entity.terrain) {
        return entity.terrain.raycast(localRay.origin, localRay.direction, terrainHit) ? terrainHit.distance : null;
    }
    return entity.mesh ? intersectRayAabb(localRay, getLocalBounds(entity.mesh)) : null;
}
export function pickEntity(scene: Scene, camera: PerspectiveCamera, u: number, v: number): Entity | null {
    if (!buildPickRay(worldRay, camera, u, v))
        return null;
    let closest: Entity | null = null;
    let closestDistance = Infinity;
    scene.traverseVisible((entity) => {
        if (!entity.mesh && !entity.terrain)
            return;
        if (!mat4.invert(inverseWorld, entity.worldMatrix))
            return;
        transformRay(localRay, worldRay, inverseWorld);
        const distance = intersectLocalRay(entity);
        if (distance === null)
            return;
        if (distance < closestDistance) {
            closestDistance = distance;
            closest = entity;
        }
    });
    return closest;
}
