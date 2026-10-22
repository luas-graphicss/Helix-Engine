import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { MeshData } from '@/engine/renderer/geometry/mesh-data';
import { createBoxShape, createCapsuleShape, createMeshShape, createSphereShape, type ColliderKind, type ColliderShape, } from '@/engine/physics/shapes/collider-shape';
export type BodyType = 'static' | 'kinematic' | 'dynamic';
export interface RigidBodySettings {
    type: BodyType;
    collider: ColliderKind;
    boxSize: Vec3;
    radius: number;
    height: number;
    center: Vec3;
    mass: number;
    friction: number;
    restitution: number;
    linearDamping: number;
    angularDamping: number;
    gravityScale: number;
    canSleep: boolean;
}
export const DEFAULT_DENSITY = 100;
export function createRigidBodySettings(overrides: Partial<RigidBodySettings> = {}): RigidBodySettings {
    return {
        type: 'dynamic',
        collider: 'box',
        boxSize: vec3.create(1, 1, 1),
        radius: 0.5,
        height: 2,
        center: vec3.create(0, 0, 0),
        mass: 1,
        friction: 0.6,
        restitution: 0,
        linearDamping: 0,
        angularDamping: 0.05,
        gravityScale: 1,
        canSleep: true,
        ...overrides,
    };
}
export function cloneRigidBodySettings(settings: RigidBodySettings): RigidBodySettings {
    return {
        ...settings,
        boxSize: vec3.copy(vec3.create(), settings.boxSize),
        center: vec3.copy(vec3.create(), settings.center),
    };
}
export function copyRigidBodySettings(out: RigidBodySettings, source: RigidBodySettings): RigidBodySettings {
    out.type = source.type;
    out.collider = source.collider;
    vec3.copy(out.boxSize, source.boxSize);
    out.radius = source.radius;
    out.height = source.height;
    vec3.copy(out.center, source.center);
    out.mass = source.mass;
    out.friction = source.friction;
    out.restitution = source.restitution;
    out.linearDamping = source.linearDamping;
    out.angularDamping = source.angularDamping;
    out.gravityScale = source.gravityScale;
    out.canSleep = source.canSleep;
    return out;
}
export function sameRigidBodyShape(a: RigidBodySettings, b: RigidBodySettings): boolean {
    return (a.type === b.type &&
        a.collider === b.collider &&
        a.radius === b.radius &&
        a.height === b.height &&
        a.mass === b.mass &&
        a.boxSize[0] === b.boxSize[0] && a.boxSize[1] === b.boxSize[1] && a.boxSize[2] === b.boxSize[2] &&
        a.center[0] === b.center[0] && a.center[1] === b.center[1] && a.center[2] === b.center[2]);
}
export function colliderRequiresStatic(collider: ColliderKind): boolean {
    return collider === 'mesh';
}
export function createShapeFromSettings(settings: RigidBodySettings, scale: Vec3, mesh: MeshData | null = null): ColliderShape {
    const sx = Math.abs(scale[0]);
    const sy = Math.abs(scale[1]);
    const sz = Math.abs(scale[2]);
    switch (settings.collider) {
        case 'mesh': {
            const shape = mesh ? createMeshShape(mesh, scale) : null;
            if (shape)
                return shape;
            return createBoxShape(settings.boxSize[0] * 0.5 * sx, settings.boxSize[1] * 0.5 * sy, settings.boxSize[2] * 0.5 * sz);
        }
        case 'box':
            return createBoxShape(settings.boxSize[0] * 0.5 * sx, settings.boxSize[1] * 0.5 * sy, settings.boxSize[2] * 0.5 * sz);
        case 'sphere':
            return createSphereShape(settings.radius * Math.max(sx, sy, sz));
        case 'capsule': {
            const radius = settings.radius * Math.max(sx, sz);
            const halfHeight = Math.max(0, settings.height * 0.5 * sy - radius);
            return createCapsuleShape(radius, halfHeight);
        }
    }
}
