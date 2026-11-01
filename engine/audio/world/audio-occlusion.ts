import * as mat4 from '@/engine/core/math/mat4';
import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import { createRay, intersectRayAabb, transformRay } from '@/engine/core/math/ray';
import type { Entity } from '@/engine/core/scene/entity';
import type { Scene } from '@/engine/core/scene/scene';
import { getLocalBounds } from '@/engine/renderer/geometry/bounds';
import { raycastMesh } from '@/engine/renderer/geometry/mesh-raycast';
import type { TerrainHit } from '@/engine/terrain/core/terrain';
const worldRay = createRay();
const localRay = createRay();
const inverseWorld = mat4.create();
const terrainHit: TerrainHit = { distance: 0, point: vec3.create() };
const END_MARGIN = 0.15;
const LISTENER_SPREAD = 0.18;
const SOURCE_SPREAD = 0.45;
const CENTER_WEIGHT = 2;
const LATERAL_RAYS = 4;
const direction = vec3.create();
const sideU = vec3.create();
const sideV = vec3.create();
const fromOffset = vec3.create();
const toOffset = vec3.create();
const WORLD_UP = vec3.create(0, 1, 0);
const WORLD_X = vec3.create(1, 0, 0);
function segmentBlocked(scene: Scene, from: Vec3, to: Vec3, emitter: Entity | null): boolean {
    vec3.subtract(worldRay.direction, to, from);
    const total = vec3.length(worldRay.direction);
    if (total <= END_MARGIN * 2)
        return false;
    vec3.scale(worldRay.direction, worldRay.direction, 1 / total);
    vec3.scaleAndAdd(worldRay.origin, from, worldRay.direction, END_MARGIN);
    const maxDistance = total - END_MARGIN * 2;
    const walk = (entity: Entity): boolean => {
        if (!entity.visible || entity.character || entity === emitter)
            return false;
        if (entity.mesh && !entity.csgBrush && mat4.invert(inverseWorld, entity.worldMatrix)) {
            transformRay(localRay, worldRay, inverseWorld);
            const entry = intersectRayAabb(localRay, getLocalBounds(entity.mesh));
            if (entry !== null && entry <= maxDistance && raycastMesh(localRay, entity.mesh, maxDistance) !== null)
                return true;
        }
        else if (entity.terrain && mat4.invert(inverseWorld, entity.worldMatrix)) {
            transformRay(localRay, worldRay, inverseWorld);
            if (entity.terrain.raycast(localRay.origin, localRay.direction, terrainHit) && terrainHit.distance <= maxDistance)
                return true;
        }
        for (const child of entity.children)
            if (walk(child))
                return true;
        return false;
    };
    return walk(scene.root);
}
export function occlusionAmount(scene: Scene, from: Vec3, to: Vec3, emitter: Entity | null): number {
    vec3.subtract(direction, to, from);
    const total = vec3.length(direction);
    if (total <= END_MARGIN * 2)
        return 0;
    vec3.scale(direction, direction, 1 / total);
    const center = segmentBlocked(scene, from, to, emitter) ? CENTER_WEIGHT : 0;
    vec3.cross(sideU, direction, Math.abs(direction[1]) > 0.9 ? WORLD_X : WORLD_UP);
    vec3.normalize(sideU, sideU);
    vec3.cross(sideV, direction, sideU);
    let lateral = 0;
    for (let i = 0; i < LATERAL_RAYS; i++) {
        const axis = i < 2 ? sideU : sideV;
        const sign = i % 2 === 0 ? 1 : -1;
        vec3.scaleAndAdd(fromOffset, from, axis, sign * LISTENER_SPREAD);
        vec3.scaleAndAdd(toOffset, to, axis, sign * SOURCE_SPREAD);
        if (segmentBlocked(scene, fromOffset, toOffset, emitter))
            lateral++;
    }
    return (center + lateral) / (CENTER_WEIGHT + LATERAL_RAYS);
}
