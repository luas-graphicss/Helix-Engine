import * as vec3 from '@/engine/core/math/vec3';
import * as aabb from '@/engine/core/math/aabb';
import type { Aabb } from '@/engine/core/math/aabb';
import type { Scene } from '@/engine/core/scene/scene';
import type { Entity } from '@/engine/core/scene/entity';
import { getMeshVersion, type MeshData } from './mesh-data';
interface BoundsEntry {
    bounds: Aabb;
    version: number;
}
const boundsCache = new WeakMap<MeshData, BoundsEntry>();
const scratchBounds = aabb.create();
export function getLocalBounds(mesh: MeshData): Aabb {
    const version = getMeshVersion(mesh);
    const entry = boundsCache.get(mesh);
    if (entry && entry.version === version)
        return entry.bounds;
    const bounds = entry?.bounds ?? { min: vec3.create(), max: vec3.create() };
    vec3.set(bounds.min, Infinity, Infinity, Infinity);
    vec3.set(bounds.max, -Infinity, -Infinity, -Infinity);
    const { positions } = mesh;
    for (let i = 0; i < positions.length; i += 3) {
        for (let axis = 0; axis < 3; axis++) {
            const value = positions[i + axis];
            if (value < bounds.min[axis])
                bounds.min[axis] = value;
            if (value > bounds.max[axis])
                bounds.max[axis] = value;
        }
    }
    boundsCache.set(mesh, { bounds, version });
    return bounds;
}
export function getEntityLocalBounds(entity: Entity): Aabb | null {
    if (entity.terrain)
        return entity.terrain.localBounds;
    return entity.mesh ? getLocalBounds(entity.mesh) : null;
}
export function computeWorldBounds(scene: Scene, root: Entity, out: Aabb = aabb.create()): Aabb {
    aabb.reset(out);
    scene.traverse((entity) => {
        const local = getEntityLocalBounds(entity);
        if (!local)
            return;
        aabb.transform(scratchBounds, local, entity.worldMatrix);
        aabb.union(out, out, scratchBounds);
    }, root);
    return out;
}
