import * as mat4 from '@/engine/core/math/mat4';
import type { Mat4 } from '@/engine/core/math/mat4';
import * as aabb from '@/engine/core/math/aabb';
import type { RigidBody } from '@/engine/physics/body/rigid-body';
import type { BodyType } from '@/engine/physics/body/rigid-body-settings';
import { Heightfield } from '@/engine/terrain/core/heightfield';
import type { MeshData } from '@/engine/renderer/geometry/mesh-data';
import type { WaterSettings } from '@/engine/terrain/water/water-settings';
import { TriangleMeshBvh } from '@/engine/physics/shapes/triangle-mesh-bvh';
import { createBoxShape, createCapsuleShape, createHeightfieldShape, createSphereShape, type ColliderShape, type HeightfieldSource } from '@/engine/physics/shapes/collider-shape';
import type { PhysicsSettings } from '@/engine/physics/world/physics-settings';
import type { PhysicsStats } from '@/engine/physics/world/physics-world';
import type { CollisionLayersSnapshot } from '@/engine/physics/world/collision-layers';
import type { Joint } from '@/engine/physics/joints/joint';
import { cloneJointDefinition, type JointDefinition } from '@/engine/physics/joints/joint-settings';
export type Triple = [
    number,
    number,
    number
];
export type Quadruple = [
    number,
    number,
    number,
    number
];
export type ShapeRecord = {
    readonly kind: 'box';
    readonly halfExtents: Triple;
} | {
    readonly kind: 'sphere';
    readonly radius: number;
} | {
    readonly kind: 'capsule';
    readonly radius: number;
    readonly halfHeight: number;
} | {
    readonly kind: 'mesh';
    readonly positions: Float32Array;
    readonly indices: Uint16Array | Uint32Array;
} | {
    readonly kind: 'heightfield';
    readonly resolution: number;
    readonly heights: Float32Array;
    readonly cellSize: number;
    readonly halfSize: number;
    readonly boundsMin: Triple;
    readonly boundsMax: Triple;
    readonly matrix: Float32Array;
};
export interface BodyRecord {
    readonly id: number;
    readonly slot: number;
    readonly type: BodyType;
    readonly shape: ShapeRecord;
    readonly position: Triple;
    readonly orientation: Quadruple;
    readonly mass: number;
    readonly friction: number;
    readonly restitution: number;
    readonly linearDamping: number;
    readonly angularDamping: number;
    readonly gravityScale: number;
    readonly canSleep: boolean;
    readonly layer: number;
    readonly collisionMask: number;
}
export interface JointRecord {
    readonly id: number;
    readonly bodyA: number;
    readonly bodyB: number;
    readonly definition: JointDefinition;
}
export interface WaterTerrainRecord {
    readonly key: number;
    readonly matrix: Float32Array;
    readonly size: number;
    readonly resolution: number;
    readonly heights?: Float32Array;
    readonly water: WaterSettings;
}
export type PhysicsCommand = {
    readonly op: 'create';
    readonly body: BodyRecord;
} | {
    readonly op: 'remove';
    readonly id: number;
} | {
    readonly op: 'teleport';
    readonly id: number;
    readonly position: Triple;
    readonly orientation: Quadruple;
} | {
    readonly op: 'pose';
    readonly id: number;
    readonly position: Triple;
    readonly orientation: Quadruple;
} | {
    readonly op: 'velocity';
    readonly id: number;
    readonly linear: Triple;
    readonly angular: Triple;
} | {
    readonly op: 'kinematic';
    readonly id: number;
    readonly position: Triple;
    readonly orientation: Quadruple;
    readonly seconds: number;
} | {
    readonly op: 'material';
    readonly id: number;
    readonly friction: number;
    readonly restitution: number;
    readonly linearDamping: number;
    readonly angularDamping: number;
    readonly gravityScale: number;
    readonly canSleep: boolean;
} | {
    readonly op: 'layers-of';
    readonly id: number;
    readonly layer: number;
    readonly collisionMask: number;
} | {
    readonly op: 'wake';
    readonly id: number;
} | {
    readonly op: 'sleep';
    readonly id: number;
} | {
    readonly op: 'force';
    readonly id: number;
    readonly force: Triple;
    readonly torque: Triple;
    readonly seconds: number;
} | {
    readonly op: 'joint-create';
    readonly joint: JointRecord;
} | {
    readonly op: 'joint-remove';
    readonly id: number;
} | {
    readonly op: 'joint-update';
    readonly id: number;
    readonly definition: JointDefinition;
} | {
    readonly op: 'settings';
    readonly settings: PhysicsSettings;
} | {
    readonly op: 'layers';
    readonly snapshot: CollisionLayersSnapshot;
} | {
    readonly op: 'water';
    readonly terrains: readonly WaterTerrainRecord[];
} | {
    readonly op: 'clear';
} | {
    readonly op: 'buffer';
    readonly buffer: ArrayBufferLike;
} | {
    readonly op: 'step';
} | {
    readonly op: 'discard';
};
export interface PhysicsInitRequest {
    readonly type: 'init';
    readonly settings: PhysicsSettings;
    readonly layers: CollisionLayersSnapshot;
    readonly buffer: ArrayBufferLike;
}
export interface PhysicsAdvanceRequest {
    readonly type: 'advance';
    readonly frame: number;
    readonly commands: readonly PhysicsCommand[];
    readonly deltaSeconds: number;
    readonly time: number;
    readonly budgetMs: number;
    readonly recycle?: ArrayBuffer;
}
export type PhysicsRequest = PhysicsInitRequest | PhysicsAdvanceRequest;
export const CONTACT_RECORD_FLOATS = 10;
export const JOINT_RECORD_FLOATS = 12;
export interface PhysicsFrameReply {
    readonly type: 'frame';
    readonly frame: number;
    readonly stats: Omit<PhysicsStats, 'backend'>;
    readonly interpolation: number;
    readonly contacts: Float32Array;
    readonly joints: Float32Array;
    readonly outOfBounds: readonly number[];
    readonly unstable: readonly number[];
    readonly poses?: ArrayBuffer;
}
export interface PhysicsReadyReply {
    readonly type: 'ready';
}
export interface PhysicsErrorReply {
    readonly type: 'error';
    readonly message: string;
}
export type PhysicsReply = PhysicsFrameReply | PhysicsReadyReply | PhysicsErrorReply;
export function triple(source: ArrayLike<number>): Triple {
    return [source[0], source[1], source[2]];
}
export function quadruple(source: ArrayLike<number>): Quadruple {
    return [source[0], source[1], source[2], source[3]];
}
export function encodeShape(shape: ColliderShape, transfer: Transferable[]): ShapeRecord {
    switch (shape.kind) {
        case 'box':
            return { kind: 'box', halfExtents: triple(shape.halfExtents) };
        case 'sphere':
            return { kind: 'sphere', radius: shape.radius };
        case 'capsule':
            return { kind: 'capsule', radius: shape.radius, halfHeight: shape.halfHeight };
        case 'mesh': {
            const positions = shape.bvh.positions.slice();
            const indices = shape.bvh.indices.slice();
            transfer.push(positions.buffer, indices.buffer);
            return { kind: 'mesh', positions, indices };
        }
        case 'heightfield': {
            const { source } = shape;
            const heights = source.heightfield.heights.slice();
            const matrix = new Float32Array(shape.matrix);
            transfer.push(heights.buffer, matrix.buffer);
            return {
                kind: 'heightfield',
                resolution: source.resolution,
                heights,
                cellSize: source.cellSize,
                halfSize: source.halfSize,
                boundsMin: triple(source.localBounds.min),
                boundsMax: triple(source.localBounds.max),
                matrix,
            };
        }
    }
}
export function decodeShape(record: ShapeRecord): ColliderShape | null {
    switch (record.kind) {
        case 'box':
            return createBoxShape(record.halfExtents[0], record.halfExtents[1], record.halfExtents[2]);
        case 'sphere':
            return createSphereShape(record.radius);
        case 'capsule':
            return createCapsuleShape(record.radius, record.halfHeight);
        case 'mesh': {
            const mesh: MeshData = { name: 'collider', positions: record.positions, normals: new Float32Array(0), uvs: new Float32Array(0), indices: record.indices };
            const bvh = new TriangleMeshBvh(mesh, new Float32Array([1, 1, 1]));
            return { kind: 'mesh', bvh, localBounds: bvh.bounds };
        }
        case 'heightfield': {
            const localBounds = aabb.create();
            localBounds.min.set(record.boundsMin);
            localBounds.max.set(record.boundsMax);
            const source: HeightfieldSource = {
                heightfield: new Heightfield(record.resolution, record.heights),
                resolution: record.resolution,
                cellSize: record.cellSize,
                halfSize: record.halfSize,
                localBounds,
            };
            return createHeightfieldShape(source, record.matrix as Mat4);
        }
    }
}
export function encodeBody(body: RigidBody, slot: number, transfer: Transferable[]): BodyRecord {
    return {
        id: body.id,
        slot,
        type: body.type,
        shape: encodeShape(body.shape, transfer),
        position: triple(body.position),
        orientation: quadruple(body.orientation),
        mass: body.mass,
        friction: body.friction,
        restitution: body.restitution,
        linearDamping: body.linearDamping,
        angularDamping: body.angularDamping,
        gravityScale: body.gravityScale,
        canSleep: body.canSleep,
        layer: body.layer,
        collisionMask: body.collisionMask,
    };
}
export function encodeJoint(joint: Joint): JointRecord {
    return { id: joint.id, bodyA: joint.bodyA.id, bodyB: joint.bodyB.id, definition: cloneJointDefinition(joint.definition) };
}
export function cloneSettings(settings: PhysicsSettings): PhysicsSettings {
    return { ...settings, gravity: new Float32Array(settings.gravity) };
}
export function settingsSignature(settings: PhysicsSettings): string {
    const parts: (number | boolean)[] = [settings.gravity[0], settings.gravity[1], settings.gravity[2]];
    for (const key of Object.keys(settings).sort()) {
        if (key === 'gravity')
            continue;
        const value = (settings as unknown as Record<string, unknown>)[key];
        if (typeof value === 'number' || typeof value === 'boolean')
            parts.push(value);
    }
    return parts.join('|');
}
export function waterSignature(water: WaterSettings): string {
    return `${water.enabled ? 1 : 0}|${water.level}|${water.waveHeight}|${water.waveLength}|${water.waveSpeed}|${water.waveDirection}|${water.choppiness}|${water.ripples}`;
}
export function copyMatrix(matrix: Mat4): Float32Array {
    return mat4.copy(mat4.create(), matrix) as Float32Array;
}
