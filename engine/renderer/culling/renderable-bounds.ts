import * as aabb from '@/engine/core/math/aabb';
import type { Aabb } from '@/engine/core/math/aabb';
import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import { maxAxisScale, type Mat4 } from '@/engine/core/math/mat4';
import type { Entity } from '@/engine/core/scene/entity';
const MATRIX_FLOATS = 16;
export interface RenderableBounds {
    readonly aabb: Aabb;
    readonly center: Vec3;
    readonly radius: number;
    readonly version: number;
}
class BoundsEntry implements RenderableBounds {
    readonly aabb = aabb.create();
    readonly center = vec3.create();
    radius = 0;
    version = 0;
    local: Aabb | null = null;
    localVersion = -1;
    readonly matrix = new Float32Array(MATRIX_FLOATS);
}
const localCenter = vec3.create();
function matrixEquals(stored: Float32Array, matrix: Mat4): boolean {
    for (let i = 0; i < MATRIX_FLOATS; i++) {
        if (stored[i] !== matrix[i])
            return false;
    }
    return true;
}
export class RenderableBoundsCache {
    private readonly entries = new WeakMap<Entity, BoundsEntry>();
    resolve(entity: Entity, local: Aabb, localVersion: number): RenderableBounds {
        let entry = this.entries.get(entity);
        if (!entry) {
            entry = new BoundsEntry();
            this.entries.set(entity, entry);
        }
        const matrix = entity.worldMatrix;
        if (entry.local === local && entry.localVersion === localVersion && matrixEquals(entry.matrix, matrix))
            return entry;
        entry.local = local;
        entry.localVersion = localVersion;
        entry.matrix.set(matrix);
        aabb.transform(entry.aabb, local, matrix);
        aabb.center(localCenter, local);
        entry.center[0] = matrix[0] * localCenter[0] + matrix[4] * localCenter[1] + matrix[8] * localCenter[2] + matrix[12];
        entry.center[1] = matrix[1] * localCenter[0] + matrix[5] * localCenter[1] + matrix[9] * localCenter[2] + matrix[13];
        entry.center[2] = matrix[2] * localCenter[0] + matrix[6] * localCenter[1] + matrix[10] * localCenter[2] + matrix[14];
        entry.radius = aabb.halfDiagonal(local) * maxAxisScale(matrix);
        entry.version++;
        return entry;
    }
}
