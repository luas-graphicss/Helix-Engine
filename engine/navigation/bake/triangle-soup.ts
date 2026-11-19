import * as mat4 from '@/engine/core/math/mat4';
import type { Mat4 } from '@/engine/core/math/mat4';
import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
const TRIANGLE_FLOATS = 9;
const VERTEX_FLOATS = 3;
const INITIAL_TRIANGLES = 1024;
const localPoint = vec3.create();
const worldPoint = vec3.create();
export interface TriangleSoup {
    readonly positions: Float32Array;
    readonly areas: Uint8Array;
    readonly count: number;
}
export interface TriangleMesh {
    readonly positions: ArrayLike<number>;
    readonly indices: ArrayLike<number>;
}
export class TriangleSoupBuilder implements TriangleSoup {
    positions = new Float32Array(INITIAL_TRIANGLES * TRIANGLE_FLOATS);
    areas = new Uint8Array(INITIAL_TRIANGLES);
    count = 0;
    readonly min = vec3.create(Infinity, Infinity, Infinity);
    readonly max = vec3.create(-Infinity, -Infinity, -Infinity);
    addMesh(mesh: TriangleMesh, world: Mat4, area: number): void {
        const { positions, indices } = mesh;
        for (let index = 0; index + 2 < indices.length; index += 3) {
            if (this.count === this.areas.length)
                this.grow();
            for (let corner = 0; corner < 3; corner++) {
                const vertex = indices[index + corner] * VERTEX_FLOATS;
                vec3.set(localPoint, positions[vertex], positions[vertex + 1], positions[vertex + 2]);
                this.writeVertex(this.count * TRIANGLE_FLOATS + corner * VERTEX_FLOATS, mat4.transformPoint(worldPoint, world, localPoint));
            }
            this.areas[this.count++] = area;
        }
    }
    private writeVertex(offset: number, point: Vec3): void {
        for (let axis = 0; axis < VERTEX_FLOATS; axis++) {
            this.positions[offset + axis] = point[axis];
            this.min[axis] = Math.min(this.min[axis], point[axis]);
            this.max[axis] = Math.max(this.max[axis], point[axis]);
        }
    }
    private grow(): void {
        const positions = new Float32Array(this.positions.length * 2);
        const areas = new Uint8Array(this.areas.length * 2);
        positions.set(this.positions);
        areas.set(this.areas);
        this.positions = positions;
        this.areas = areas;
    }
}
