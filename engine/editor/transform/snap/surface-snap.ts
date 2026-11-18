import * as mat4 from '@/engine/core/math/mat4';
import type { Mat4 } from '@/engine/core/math/mat4';
import { createRay, intersectRayAabb, transformRay, type Ray } from '@/engine/core/math/ray';
import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { Entity } from '@/engine/core/scene/entity';
import { getLocalBounds } from '@/engine/renderer/geometry/bounds';
import type { MeshData } from '@/engine/renderer/geometry/mesh-data';
import { raycastMesh, type MeshRayHit } from '@/engine/renderer/geometry/mesh-raycast';
import type { TerrainHit } from '@/engine/terrain/core/terrain';
export interface SurfaceHit {
    readonly point: Vec3;
    readonly normal: Vec3;
}
const inverseWorld = mat4.create();
const localRay = createRay();
const localNormal = vec3.create();
const edgeA = vec3.create();
const edgeB = vec3.create();
const meshHit: MeshRayHit = { triangle: -1 };
const terrainHit: TerrainHit = { distance: 0, point: vec3.create() };
export function createSurfaceHit(): SurfaceHit {
    return { point: vec3.create(), normal: vec3.create(0, 1, 0) };
}
export function isSnapSurface(entity: Entity): boolean {
    if (entity.csgBrush)
        return false;
    return entity.terrain !== null || (entity.mesh !== null && entity.skin === null);
}
function triangleNormal(out: Vec3, mesh: MeshData, triangle: number): Vec3 {
    const { positions, indices } = mesh;
    const a = indices[triangle * 3] * 3;
    const b = indices[triangle * 3 + 1] * 3;
    const c = indices[triangle * 3 + 2] * 3;
    vec3.set(edgeA, positions[b] - positions[a], positions[b + 1] - positions[a + 1], positions[b + 2] - positions[a + 2]);
    vec3.set(edgeB, positions[c] - positions[a], positions[c + 1] - positions[a + 1], positions[c + 2] - positions[a + 2]);
    return vec3.cross(out, edgeA, edgeB);
}
function normalToWorld(out: Vec3, inverse: Mat4, normal: Vec3): Vec3 {
    const x = normal[0], y = normal[1], z = normal[2];
    vec3.set(out, inverse[0] * x + inverse[1] * y + inverse[2] * z, inverse[4] * x + inverse[5] * y + inverse[6] * z, inverse[8] * x + inverse[9] * y + inverse[10] * z);
    return vec3.normalize(out, out);
}
function raycastLocal(entity: Entity, nearest: number): number | null {
    if (entity.terrain) {
        const hit = entity.terrain.raycast(localRay.origin, localRay.direction, terrainHit);
        if (!hit || hit.distance >= nearest)
            return null;
        entity.terrain.normalAtLocal(localNormal, hit.point[0], hit.point[2]);
        return hit.distance;
    }
    const mesh = entity.mesh;
    if (!mesh)
        return null;
    const entry = intersectRayAabb(localRay, getLocalBounds(mesh));
    if (entry === null || entry >= nearest)
        return null;
    const distance = raycastMesh(localRay, mesh, nearest, meshHit);
    if (distance !== null)
        triangleNormal(localNormal, mesh, meshHit.triangle);
    return distance;
}
export function raycastSurfaces(out: SurfaceHit, surfaces: readonly Entity[], ray: Ray): boolean {
    let nearest = Infinity;
    for (const entity of surfaces) {
        if (!mat4.invert(inverseWorld, entity.worldMatrix))
            continue;
        transformRay(localRay, ray, inverseWorld);
        const distance = raycastLocal(entity, nearest);
        if (distance === null)
            continue;
        nearest = distance;
        normalToWorld(out.normal, inverseWorld, localNormal);
    }
    if (nearest === Infinity)
        return false;
    if (vec3.dot(out.normal, ray.direction) > 0)
        vec3.scale(out.normal, out.normal, -1);
    vec3.scaleAndAdd(out.point, ray.origin, ray.direction, nearest);
    return true;
}
