import * as aabb from '@/engine/core/math/aabb';
import type { Aabb } from '@/engine/core/math/aabb';
import * as mat4 from '@/engine/core/math/mat4';
import * as vec3 from '@/engine/core/math/vec3';
import type { Entity } from './entity';
const MATRIX_FLOATS = 16;
const SKIN_PADDING_RATIO = 0.3;
const MIN_PADDING = 0.05;
const inverseOwner = mat4.create();
const jointPosition = vec3.create();
const worldBounds = aabb.create();
export class Skin {
    readonly jointMatrices: Float32Array;
    readonly localBounds: Aabb = aabb.create();
    version = 0;
    private readonly previousWorld: Float32Array;
    private initialized = false;
    constructor(readonly joints: readonly Entity[], readonly inverseBindMatrices: Float32Array, readonly restBounds: Aabb) {
        if (inverseBindMatrices.length !== joints.length * MATRIX_FLOATS) {
            throw new Error(`Skin com ${joints.length} juntas e ${inverseBindMatrices.length / MATRIX_FLOATS} matrizes de ligação.`);
        }
        this.jointMatrices = new Float32Array(joints.length * MATRIX_FLOATS);
        this.previousWorld = new Float32Array((joints.length + 1) * MATRIX_FLOATS).fill(NaN);
        aabb.union(this.localBounds, this.localBounds, restBounds);
    }
    update(owner: Entity): void {
        if (!this.changed(owner))
            return;
        const { joints, inverseBindMatrices, jointMatrices } = this;
        for (let i = 0; i < joints.length; i++) {
            const offset = i * MATRIX_FLOATS;
            mat4.multiply(jointMatrices.subarray(offset, offset + MATRIX_FLOATS), joints[i].worldMatrix, inverseBindMatrices.subarray(offset, offset + MATRIX_FLOATS));
        }
        this.updateBounds(owner);
        this.version++;
    }
    private changed(owner: Entity): boolean {
        const { joints, previousWorld } = this;
        let changed = !this.initialized;
        this.initialized = true;
        for (let i = 0; i <= joints.length; i++) {
            const matrix = i === joints.length ? owner.worldMatrix : joints[i].worldMatrix;
            const offset = i * MATRIX_FLOATS;
            for (let k = 0; k < MATRIX_FLOATS; k++) {
                if (previousWorld[offset + k] !== matrix[k]) {
                    changed = true;
                    previousWorld.set(matrix, offset);
                    break;
                }
            }
        }
        return changed;
    }
    private updateBounds(owner: Entity): void {
        if (!mat4.invert(inverseOwner, owner.worldMatrix))
            return;
        aabb.reset(worldBounds);
        for (const joint of this.joints) {
            mat4.getTranslation(jointPosition, joint.worldMatrix);
            for (let axis = 0; axis < 3; axis++) {
                if (jointPosition[axis] < worldBounds.min[axis])
                    worldBounds.min[axis] = jointPosition[axis];
                if (jointPosition[axis] > worldBounds.max[axis])
                    worldBounds.max[axis] = jointPosition[axis];
            }
        }
        const extent = Math.max(worldBounds.max[0] - worldBounds.min[0], worldBounds.max[1] - worldBounds.min[1], worldBounds.max[2] - worldBounds.min[2]);
        const padding = Math.max(extent * SKIN_PADDING_RATIO, MIN_PADDING);
        for (let axis = 0; axis < 3; axis++) {
            worldBounds.min[axis] -= padding;
            worldBounds.max[axis] += padding;
        }
        aabb.transform(this.localBounds, worldBounds, inverseOwner);
    }
}
