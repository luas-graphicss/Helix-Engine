import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { Mat3 } from '@/engine/core/math/mat3';
import * as mat4 from '@/engine/core/math/mat4';
import type { Mat4 } from '@/engine/core/math/mat4';
import * as aabb from '@/engine/core/math/aabb';
import type { Aabb } from '@/engine/core/math/aabb';
import type { Heightfield } from '@/engine/terrain/core/heightfield';
import type { MeshData } from '@/engine/renderer/geometry/mesh-data';
import { getTriangleMeshBvh, type TriangleMeshBvh } from './triangle-mesh-bvh';
export type ColliderKind = 'box' | 'sphere' | 'capsule' | 'mesh';
export type ShapeKind = ColliderKind | 'heightfield';
export interface BoxShape {
    readonly kind: 'box';
    readonly halfExtents: Vec3;
}
export interface SphereShape {
    readonly kind: 'sphere';
    readonly radius: number;
}
export interface CapsuleShape {
    readonly kind: 'capsule';
    readonly radius: number;
    readonly halfHeight: number;
}
export interface HeightfieldSource {
    readonly heightfield: Heightfield;
    readonly resolution: number;
    readonly cellSize: number;
    readonly halfSize: number;
    readonly localBounds: Aabb;
}
export interface HeightfieldShape {
    readonly kind: 'heightfield';
    readonly source: HeightfieldSource;
    readonly matrix: Mat4;
    readonly inverse: Mat4;
    readonly scale: number;
}
export interface MeshShape {
    readonly kind: 'mesh';
    readonly bvh: TriangleMeshBvh;
    readonly localBounds: Aabb;
}
export type ColliderShape = BoxShape | SphereShape | CapsuleShape | HeightfieldShape | MeshShape;
export const MIN_SHAPE_EXTENT = 0.005;
export function createBoxShape(halfX: number, halfY: number, halfZ: number): BoxShape {
    return {
        kind: 'box',
        halfExtents: vec3.create(Math.max(halfX, MIN_SHAPE_EXTENT), Math.max(halfY, MIN_SHAPE_EXTENT), Math.max(halfZ, MIN_SHAPE_EXTENT)),
    };
}
export function createSphereShape(radius: number): SphereShape {
    return { kind: 'sphere', radius: Math.max(radius, MIN_SHAPE_EXTENT) };
}
export function createCapsuleShape(radius: number, halfHeight: number): CapsuleShape {
    return { kind: 'capsule', radius: Math.max(radius, MIN_SHAPE_EXTENT), halfHeight: Math.max(halfHeight, 0) };
}
export function createHeightfieldShape(source: HeightfieldSource, worldMatrix: Mat4): HeightfieldShape | null {
    const inverse = mat4.create();
    if (!mat4.invert(inverse, worldMatrix))
        return null;
    const sx = Math.hypot(worldMatrix[0], worldMatrix[1], worldMatrix[2]);
    const sy = Math.hypot(worldMatrix[4], worldMatrix[5], worldMatrix[6]);
    const sz = Math.hypot(worldMatrix[8], worldMatrix[9], worldMatrix[10]);
    return {
        kind: 'heightfield',
        source,
        matrix: mat4.copy(mat4.create(), worldMatrix),
        inverse,
        scale: Math.max(Math.cbrt(sx * sy * sz), MIN_SHAPE_EXTENT),
    };
}
export function createMeshShape(mesh: MeshData, scale: Vec3): MeshShape | null {
    if (mesh.indices.length < 3)
        return null;
    const bvh = getTriangleMeshBvh(mesh, scale);
    return { kind: 'mesh', bvh, localBounds: bvh.bounds };
}
export function shapeVolume(shape: ColliderShape): number {
    switch (shape.kind) {
        case 'box':
            return 8 * shape.halfExtents[0] * shape.halfExtents[1] * shape.halfExtents[2];
        case 'sphere':
            return (4 / 3) * Math.PI * shape.radius ** 3;
        case 'capsule':
            return Math.PI * shape.radius ** 2 * (2 * shape.halfHeight) + (4 / 3) * Math.PI * shape.radius ** 3;
        case 'heightfield':
            return 0;
        case 'mesh': {
            const { min, max } = shape.localBounds;
            return Math.max(max[0] - min[0], 0) * Math.max(max[1] - min[1], 0) * Math.max(max[2] - min[2], 0);
        }
    }
}
export function shapeMaxExtent(shape: ColliderShape): number {
    switch (shape.kind) {
        case 'box':
            return vec3.length(shape.halfExtents);
        case 'sphere':
            return shape.radius;
        case 'capsule':
            return shape.halfHeight + shape.radius;
        case 'heightfield':
            return aabb.halfDiagonal(shape.source.localBounds) * shape.scale;
        case 'mesh': {
            const { min, max } = shape.localBounds;
            const x = Math.max(Math.abs(min[0]), Math.abs(max[0]));
            const y = Math.max(Math.abs(min[1]), Math.abs(max[1]));
            const z = Math.max(Math.abs(min[2]), Math.abs(max[2]));
            return Math.hypot(x, y, z);
        }
    }
}
export function computeShapeAabb(out: Aabb, shape: ColliderShape, position: Vec3, rotation: Mat3, margin: number): Aabb {
    if (shape.kind === 'heightfield') {
        aabb.transform(out, shape.source.localBounds, shape.matrix);
        for (let axis = 0; axis < 3; axis++) {
            out.min[axis] -= margin;
            out.max[axis] += margin;
        }
        return out;
    }
    let ex: number;
    let ey: number;
    let ez: number;
    let cx = position[0];
    let cy = position[1];
    let cz = position[2];
    switch (shape.kind) {
        case 'sphere':
            ex = ey = ez = shape.radius;
            break;
        case 'box': {
            const h = shape.halfExtents;
            ex = Math.abs(rotation[0]) * h[0] + Math.abs(rotation[3]) * h[1] + Math.abs(rotation[6]) * h[2];
            ey = Math.abs(rotation[1]) * h[0] + Math.abs(rotation[4]) * h[1] + Math.abs(rotation[7]) * h[2];
            ez = Math.abs(rotation[2]) * h[0] + Math.abs(rotation[5]) * h[1] + Math.abs(rotation[8]) * h[2];
            break;
        }
        case 'mesh': {
            const { min, max } = shape.localBounds;
            const lx = (min[0] + max[0]) * 0.5;
            const ly = (min[1] + max[1]) * 0.5;
            const lz = (min[2] + max[2]) * 0.5;
            const hx = (max[0] - min[0]) * 0.5;
            const hy = (max[1] - min[1]) * 0.5;
            const hz = (max[2] - min[2]) * 0.5;
            cx += rotation[0] * lx + rotation[3] * ly + rotation[6] * lz;
            cy += rotation[1] * lx + rotation[4] * ly + rotation[7] * lz;
            cz += rotation[2] * lx + rotation[5] * ly + rotation[8] * lz;
            ex = Math.abs(rotation[0]) * hx + Math.abs(rotation[3]) * hy + Math.abs(rotation[6]) * hz;
            ey = Math.abs(rotation[1]) * hx + Math.abs(rotation[4]) * hy + Math.abs(rotation[7]) * hz;
            ez = Math.abs(rotation[2]) * hx + Math.abs(rotation[5]) * hy + Math.abs(rotation[8]) * hz;
            break;
        }
        case 'capsule': {
            const axisY = shape.halfHeight;
            ex = Math.abs(rotation[3]) * axisY + shape.radius;
            ey = Math.abs(rotation[4]) * axisY + shape.radius;
            ez = Math.abs(rotation[5]) * axisY + shape.radius;
            break;
        }
    }
    out.min[0] = cx - ex - margin;
    out.min[1] = cy - ey - margin;
    out.min[2] = cz - ez - margin;
    out.max[0] = cx + ex + margin;
    out.max[1] = cy + ey + margin;
    out.max[2] = cz + ez + margin;
    return out;
}
