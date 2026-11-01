import * as vec3 from '@/engine/core/math/vec3';
import * as quat from '@/engine/core/math/quat';
import * as mat4 from '@/engine/core/math/mat4';
import * as mat3 from '@/engine/core/math/mat3';
import * as aabb from '@/engine/core/math/aabb';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { Mat4 } from '@/engine/core/math/mat4';
import type { Quat } from '@/engine/core/math/quat';
import type { Aabb } from '@/engine/core/math/aabb';
import { createRay, transformRay, type Ray } from '@/engine/core/math/ray';
import { Entity } from '@/engine/core/scene/entity';
import { raycastMesh } from '@/engine/renderer/geometry/mesh-raycast';
import { getLocalBounds } from '@/engine/renderer/geometry/bounds';
import { PHYSICS_QUALITY_PRESETS, matchPhysicsQuality, type PhysicsQuality } from '@/engine/physics/world/physics-settings';
import { DEFAULT_COLLISION_LAYER, MAX_COLLISION_LAYERS } from '@/engine/physics/world/collision-layers';
import type { PhysicsWorld } from '@/engine/physics/world/physics-world';
import type { ForceField } from '@/engine/physics/world/force-field';
import type { PhysicsScene } from '@/engine/physics/scene/physics-scene';
import { RigidBody } from '@/engine/physics/body/rigid-body';
import { colliderRequiresStatic, createRigidBodySettings, type RigidBodySettings } from '@/engine/physics/body/rigid-body-settings';
import { defaultMassForSettings, densityForSettings, fitColliderToBounds } from '@/engine/physics/body/collider-fit';
import { createBoxShape, createCapsuleShape, createMeshShape, createSphereShape, shapeVolume, computeShapeAabb, type ColliderShape } from '@/engine/physics/shapes/collider-shape';
import { applyPhysicalProperties, colliderVolume, createPhysicalProperties, matchPhysicalPreset, PHYSICAL_PRESETS, type PhysicalProperties } from '@/engine/materials/physical-material';
import { sampleWaterSurface, createWaterSample } from '@/engine/terrain/water/water-surface';
import type { TerrainHit } from '@/engine/terrain/core/terrain';
import { HelixArgumentError, HelixError, HelixNotImplementedError } from '../runtime/script-errors';
import type { RuntimeHost } from '../runtime/runtime-host';
import { assignSettings, requireEntity, requireFunction, requireNumber, requireObject, requireOneOf, requireString, toQuat, toVec3 } from '../runtime/values';
import { createForcesApi } from './physics-forces';
import { createJointsApi } from './physics-joints';
export interface RaycastHit {
    entity: Entity;
    body: RigidBody | null;
    point: Vec3;
    normal: Vec3;
    distance: number;
}
export interface QueryFilter {
    exclude: Set<Entity>;
    tags: string[] | null;
    kinds: string[] | null;
    layers: string[] | null;
    includeInvisible: boolean;
    includeTriggers: boolean;
}
const worldRay = createRay();
const localRay = createRay();
const inverseWorld = mat4.create();
const scratchHit: TerrainHit = { distance: 0, point: vec3.create() };
const scratchBox = aabb.create();
const scratchWorldScale = vec3.create();
const scratchQuat = quat.create();
const scratchVec = vec3.create();
const scratchWater = createWaterSample();
function readWorldScale(out: Vec3, matrix: Mat4): Vec3 {
    out[0] = Math.hypot(matrix[0], matrix[1], matrix[2]);
    out[1] = Math.hypot(matrix[4], matrix[5], matrix[6]);
    out[2] = Math.hypot(matrix[8], matrix[9], matrix[10]);
    return out;
}
function parseFilter(value: unknown, member: string): QueryFilter {
    const filter: QueryFilter = { exclude: new Set(), tags: null, kinds: null, layers: null, includeInvisible: false, includeTriggers: true };
    if (value === undefined || value === null)
        return filter;
    const options = requireObject(value, member, 'o filtro');
    if (Array.isArray(options.exclude))
        for (const entry of options.exclude)
            if (entry instanceof Entity)
                filter.exclude.add(entry);
            else if (options.exclude instanceof Entity)
                filter.exclude.add(options.exclude);
    if (Array.isArray(options.tags))
        filter.tags = options.tags.filter((tag): tag is string => typeof tag === 'string');
    if (Array.isArray(options.kinds))
        filter.kinds = options.kinds.filter((kind): kind is string => typeof kind === 'string');
    if (Array.isArray(options.layers))
        filter.layers = options.layers.filter((layer): layer is string => typeof layer === 'string');
    else if (typeof options.layers === 'string')
        filter.layers = [options.layers];
    if (options.includeInvisible === true)
        filter.includeInvisible = true;
    return filter;
}
function passesFilter(entity: Entity, filter: QueryFilter): boolean {
    for (const excluded of filter.exclude)
        if (excluded.contains(entity))
            return false;
    if (filter.kinds && !filter.kinds.includes(entity.kind))
        return false;
    if (filter.tags && !filter.tags.some((tag) => entity.tags.has(tag)))
        return false;
    if (filter.layers && !filter.layers.includes(entity.rigidBody?.layer ?? DEFAULT_COLLISION_LAYER))
        return false;
    return true;
}
function approximateMeshNormal(out: Vec3, entity: Entity, worldPoint: Vec3, direction: Vec3): Vec3 {
    const mesh = entity.mesh;
    if (!mesh || !mat4.invert(inverseWorld, entity.worldMatrix))
        return vec3.scale(out, direction, -1);
    const epsilon = 0.01;
    const probe = (offsetX: number, offsetY: number, offsetZ: number): number | null => {
        vec3.set(worldRay.origin, worldPoint[0] + offsetX - direction[0] * 0.05, worldPoint[1] + offsetY - direction[1] * 0.05, worldPoint[2] + offsetZ - direction[2] * 0.05);
        vec3.copy(worldRay.direction, direction);
        transformRay(localRay, worldRay, inverseWorld);
        return raycastMesh(localRay, mesh, 0.2);
    };
    const base = probe(0, 0, 0);
    if (base === null)
        return vec3.scale(out, direction, -1);
    const tangent = Math.abs(direction[1]) < 0.9 ? vec3.set(scratchVec, 0, 1, 0) : vec3.set(scratchVec, 1, 0, 0);
    const t1 = vec3.normalize(vec3.create(), vec3.cross(vec3.create(), direction, tangent));
    const t2 = vec3.normalize(vec3.create(), vec3.cross(vec3.create(), direction, t1));
    const d1 = probe(t1[0] * epsilon, t1[1] * epsilon, t1[2] * epsilon);
    const d2 = probe(t2[0] * epsilon, t2[1] * epsilon, t2[2] * epsilon);
    if (d1 === null || d2 === null)
        return vec3.scale(out, direction, -1);
    const p0 = vec3.scaleAndAdd(vec3.create(), worldPoint, direction, 0);
    const p1 = vec3.scaleAndAdd(vec3.create(), vec3.scaleAndAdd(vec3.create(), worldPoint, t1, epsilon), direction, d1 - base);
    const p2 = vec3.scaleAndAdd(vec3.create(), vec3.scaleAndAdd(vec3.create(), worldPoint, t2, epsilon), direction, d2 - base);
    const e1 = vec3.subtract(vec3.create(), p1, p0);
    const e2 = vec3.subtract(vec3.create(), p2, p0);
    vec3.normalize(out, vec3.cross(out, e1, e2));
    if (vec3.dot(out, direction) > 0)
        vec3.scale(out, out, -1);
    return out;
}
export class ContactTracker {
    private previous = new Map<string, {
        a: Entity;
        b: Entity;
    }>();
    private current = new Map<string, {
        a: Entity;
        b: Entity;
        normal: Vec3;
        point: Vec3;
        impulse: number;
        relativeVelocity: number;
    }>();
    constructor(private readonly host: RuntimeHost) { }
    reset(): void {
        this.previous.clear();
        this.current.clear();
    }
    collect(world: PhysicsWorld, entityOf: (body: RigidBody) => Entity | null, dispatch: (entity: Entity, hook: 'onCollisionBegin' | 'onCollisionStay' | 'onCollisionEnd', other: Entity, contact: unknown) => void): void {
        this.current.clear();
        for (const manifold of world.manifolds) {
            if (manifold.pointCount === 0)
                continue;
            const a = entityOf(manifold.bodyA);
            const b = entityOf(manifold.bodyB);
            if (!a || !b)
                continue;
            let impulse = 0;
            let relativeVelocity = 0;
            const point = vec3.create();
            for (let index = 0; index < manifold.pointCount; index++) {
                const contact = manifold.points[index];
                impulse = Math.max(impulse, contact.maxNormalImpulse);
                relativeVelocity = Math.min(relativeVelocity, contact.relativeVelocity);
                vec3.add(point, point, contact.anchorA);
            }
            vec3.scale(point, point, 1 / manifold.pointCount);
            vec3.add(point, point, manifold.bodyA.position);
            const key = a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`;
            this.current.set(key, { a, b, normal: vec3.copy(vec3.create(), manifold.normal), point, impulse, relativeVelocity });
        }
        for (const [key, pair] of this.current) {
            const began = !this.previous.has(key);
            const hook = began ? 'onCollisionBegin' : 'onCollisionStay';
            const contactA = { point: pair.point, normal: pair.normal, impulse: pair.impulse, relativeVelocity: pair.relativeVelocity };
            const contactB = { point: pair.point, normal: vec3.scale(vec3.create(), pair.normal, -1), impulse: pair.impulse, relativeVelocity: pair.relativeVelocity };
            dispatch(pair.a, hook, pair.b, contactA);
            dispatch(pair.b, hook, pair.a, contactB);
            if (began)
                this.host.bus.emit('physics.collisionBegin', { a: pair.a, b: pair.b, contact: contactA });
        }
        for (const [key, pair] of this.previous) {
            if (this.current.has(key))
                continue;
            dispatch(pair.a, 'onCollisionEnd', pair.b, null);
            dispatch(pair.b, 'onCollisionEnd', pair.a, null);
            this.host.bus.emit('physics.collisionEnd', { a: pair.a, b: pair.b });
        }
        const swap = this.previous;
        this.previous = new Map();
        for (const [key, pair] of this.current)
            this.previous.set(key, { a: pair.a, b: pair.b });
        swap.clear();
    }
}
export class AxisLocks {
    readonly rotation = new Map<RigidBody, [
        boolean,
        boolean,
        boolean
    ]>();
    readonly position = new Map<RigidBody, [
        boolean,
        boolean,
        boolean
    ]>();
    clear(): void {
        this.rotation.clear();
        this.position.clear();
    }
    apply(): void {
        for (const [body, axes] of this.rotation) {
            if (axes[0])
                body.angularVelocity[0] = 0;
            if (axes[1])
                body.angularVelocity[1] = 0;
            if (axes[2])
                body.angularVelocity[2] = 0;
        }
        for (const [body, axes] of this.position) {
            if (axes[0])
                body.linearVelocity[0] = 0;
            if (axes[1])
                body.linearVelocity[1] = 0;
            if (axes[2])
                body.linearVelocity[2] = 0;
        }
    }
}
export function createPhysicsApi(host: RuntimeHost, locks: AxisLocks) {
    const { session } = host;
    const { scene } = session;
    const bodyWrappers = new WeakMap<RigidBody, object>();
    function physicsScene(member: string): PhysicsScene {
        const physics = session.playtest.physics;
        if (!physics)
            throw new HelixError(`${member}: a física só existe com a simulação em andamento (helix.play.state).`);
        return physics;
    }
    function world(member: string): PhysicsWorld {
        return physicsScene(member).world;
    }
    function entityOfBody(body: RigidBody): Entity | null {
        const physics = session.playtest.physics;
        if (!physics)
            return null;
        let found: Entity | null = null;
        scene.traverse((entity) => {
            if (found)
                return;
            if (physics.bindingOf(entity)?.body === body)
                found = entity;
        });
        if (!found) {
            const characters = session.playtest.characters;
            const instance = characters?.instances.find((candidate) => candidate.controller.rigidBody === body);
            if (instance)
                found = instance.entity;
        }
        return found;
    }
    function unwrapBody(value: unknown, member: string): RigidBody {
        if (value instanceof RigidBody)
            return value;
        const raw = value && typeof value === 'object' ? (value as {
            raw?: unknown;
        }).raw : undefined;
        if (raw instanceof RigidBody)
            return raw;
        throw new HelixArgumentError(member, 'esperava um corpo rígido (o handle de helix.physics.bodyOf ou body.raw).');
    }
    function bodyOf(value: unknown, member: string): RigidBody {
        if (value instanceof RigidBody)
            return value;
        const entity = requireEntity(value, member);
        const physics = physicsScene(member);
        const binding = physics.ensureBinding(entity);
        if (binding)
            return binding.body;
        const instance = session.playtest.characters?.instanceOf(entity);
        if (instance)
            return instance.controller.rigidBody;
        throw new HelixArgumentError(member, `${entity.name} não tem corpo na simulação (precisa de rigidBody ou character).`);
    }
    function wrapBody(body: RigidBody, member: string) {
        const cached = bodyWrappers.get(body);
        if (cached)
            return cached;
        const h = () => world(member).fixedTimestep;
        const wrapper = {
            get raw() {
                return body;
            },
            get entity() {
                return entityOfBody(body);
            },
            get id() {
                return body.id;
            },
            get type() {
                return body.type;
            },
            get isStatic() {
                return body.isStatic;
            },
            get isKinematic() {
                return body.isKinematic;
            },
            get isDynamic() {
                return body.isDynamic;
            },
            get isMoving() {
                return body.isMoving;
            },
            get isResting() {
                return body.isResting;
            },
            get isActive() {
                return body.isActive;
            },
            get isSleeping() {
                return body.sleeping;
            },
            get motionSpeed() {
                return body.motionSpeed;
            },
            get position() {
                return body.position;
            },
            get orientation() {
                return body.orientation;
            },
            get mass() {
                return body.mass;
            },
            get invMass() {
                return body.invMass;
            },
            get aabb() {
                return body.aabb;
            },
            get linearVelocity() {
                return body.linearVelocity;
            },
            set linearVelocity(value: Vec3) {
                toVec3(value, 'body.linearVelocity', body.linearVelocity);
                body.wake();
            },
            get angularVelocity() {
                return body.angularVelocity;
            },
            set angularVelocity(value: Vec3) {
                toVec3(value, 'body.angularVelocity', body.angularVelocity);
                body.wake();
            },
            get friction() {
                return body.friction;
            },
            get restitution() {
                return body.restitution;
            },
            get gravityScale() {
                return body.gravityScale;
            },
            set gravityScale(value: number) {
                body.gravityScale = requireNumber(value, 'body.gravityScale', 'a escala de gravidade');
            },
            get layer() {
                return world(member).layers.nameOf(body.layer);
            },
            applyImpulse: (impulse: unknown, point?: unknown) => {
                const j = toVec3(impulse, 'body.applyImpulse');
                body.applyImpulse(j);
                if (point !== undefined && point !== null && body.isDynamic) {
                    const p = toVec3(point, 'body.applyImpulse');
                    const r = vec3.subtract(vec3.create(), p, body.position);
                    const torque = vec3.cross(vec3.create(), r, j);
                    applyAngularImpulse(body, torque);
                }
            },
            applyAngularImpulse: (impulse: unknown) => applyAngularImpulse(body, toVec3(impulse, 'body.applyAngularImpulse')),
            applyForce: (force: unknown, point?: unknown) => {
                const f = toVec3(force, 'body.applyForce');
                const j = vec3.scale(vec3.create(), f, h());
                body.applyImpulse(j);
                if (point !== undefined && point !== null && body.isDynamic) {
                    const p = toVec3(point, 'body.applyForce');
                    const r = vec3.subtract(vec3.create(), p, body.position);
                    applyAngularImpulse(body, vec3.cross(vec3.create(), r, j));
                }
            },
            applyTorque: (torque: unknown) => applyAngularImpulse(body, vec3.scale(vec3.create(), toVec3(torque, 'body.applyTorque'), h())),
            setPose: (position: unknown, orientation?: unknown) => {
                body.setPose(toVec3(position, 'body.setPose'), orientation === undefined ? body.orientation : toQuat(orientation, 'body.setPose', scratchQuat));
            },
            teleport: (position: unknown, orientation?: unknown) => {
                world(member).teleport(body, toVec3(position, 'body.teleport'), orientation === undefined ? quat.copy(scratchQuat, body.orientation) : toQuat(orientation, 'body.teleport', scratchQuat));
            },
            moveKinematic: (position: unknown, orientation?: unknown, step?: unknown) => {
                if (!body.isKinematic)
                    throw new HelixError('body.moveKinematic: só corpos cinemáticos; para dinâmicos use applyImpulse/linearVelocity, para estáticos teleport.');
                body.moveKinematic(toVec3(position, 'body.moveKinematic'), orientation === undefined || orientation === null ? quat.copy(scratchQuat, body.orientation) : toQuat(orientation, 'body.moveKinematic', scratchQuat), step === undefined ? h() : requireNumber(step, 'body.moveKinematic', 'o passo'));
            },
            setMaterial: (material: unknown) => {
                const patch = requireObject(material, 'body.setMaterial', 'o material');
                body.setMaterial({
                    friction: patch.friction === undefined ? body.friction : requireNumber(patch.friction, 'body.setMaterial', 'friction'),
                    restitution: patch.restitution === undefined ? body.restitution : requireNumber(patch.restitution, 'body.setMaterial', 'restitution'),
                    linearDamping: patch.linearDamping === undefined ? body.linearDamping : requireNumber(patch.linearDamping, 'body.setMaterial', 'linearDamping'),
                    angularDamping: patch.angularDamping === undefined ? body.angularDamping : requireNumber(patch.angularDamping, 'body.setMaterial', 'angularDamping'),
                    gravityScale: patch.gravityScale === undefined ? body.gravityScale : requireNumber(patch.gravityScale, 'body.setMaterial', 'gravityScale'),
                    canSleep: patch.canSleep === undefined ? body.canSleep : Boolean(patch.canSleep),
                });
            },
            wake: () => body.wake(),
            sleep: () => body.sleep(),
            lockRotation: (x: unknown, y: unknown, z: unknown) => {
                locks.rotation.set(body, [Boolean(x), Boolean(y), Boolean(z)]);
                if (!x && !y && !z)
                    locks.rotation.delete(body);
            },
            lockPosition: (x: unknown, y: unknown, z: unknown) => {
                locks.position.set(body, [Boolean(x), Boolean(y), Boolean(z)]);
                if (!x && !y && !z)
                    locks.position.delete(body);
            },
        };
        bodyWrappers.set(body, wrapper);
        return wrapper;
    }
    function applyAngularImpulse(body: RigidBody, impulse: Vec3): void {
        if (!body.isDynamic)
            return;
        const m = body.invInertiaWorld;
        body.angularVelocity[0] += m[0] * impulse[0] + m[3] * impulse[1] + m[6] * impulse[2];
        body.angularVelocity[1] += m[1] * impulse[0] + m[4] * impulse[1] + m[7] * impulse[2];
        body.angularVelocity[2] += m[2] * impulse[0] + m[5] * impulse[1] + m[8] * impulse[2];
        body.wake();
    }
    function raycastScene(origin: Vec3, direction: Vec3, maxDistance: number, filter: QueryFilter, all: boolean): RaycastHit[] {
        scene.updateWorldMatrices();
        vec3.copy(worldRay.origin, origin);
        vec3.normalize(worldRay.direction, direction);
        const hits: RaycastHit[] = [];
        const visit = (entity: Entity) => {
            if (!entity.mesh && !entity.terrain)
                return;
            if (entity.csgBrush)
                return;
            if (!passesFilter(entity, filter))
                return;
            if (!mat4.invert(inverseWorld, entity.worldMatrix))
                return;
            transformRay(localRay, worldRay, inverseWorld);
            let distance: number | null = null;
            let normal: Vec3 | null = null;
            if (entity.terrain) {
                const hit = entity.terrain.raycast(localRay.origin, localRay.direction, scratchHit);
                if (hit) {
                    distance = hit.distance;
                    normal = entity.terrain.normalAtLocal(vec3.create(), hit.point[0], hit.point[2]);
                    quat.fromMat4Rotation(scratchQuat, entity.worldMatrix);
                    quat.rotateVec3(normal, scratchQuat, normal);
                }
            }
            else if (entity.mesh) {
                distance = raycastMesh(localRay, entity.mesh, maxDistance);
            }
            if (distance === null || distance > maxDistance || distance < 0)
                return;
            const point = vec3.scaleAndAdd(vec3.create(), worldRay.origin, worldRay.direction, distance);
            if (!normal)
                normal = approximateMeshNormal(vec3.create(), entity, point, worldRay.direction);
            const physics = session.playtest.physics;
            const body = physics?.bindingOf(entity)?.body ?? null;
            hits.push({ entity, body, point, normal, distance });
        };
        if (filter.includeInvisible)
            scene.traverse(visit);
        else
            scene.traverseVisible(visit);
        hits.sort((a, b) => a.distance - b.distance);
        return all ? hits : hits.slice(0, 1);
    }
    function bodiesInAabb(box: Aabb, filter: QueryFilter, member: string): Entity[] {
        const current = world(member);
        const result: Entity[] = [];
        const seen = new Set<Entity>();
        current.queryAabb(box, null, (body) => {
            const entity = entityOfBody(body);
            if (!entity || seen.has(entity) || !passesFilter(entity, filter))
                return;
            seen.add(entity);
            result.push(entity);
        });
        return result;
    }
    function requireLayerNames(value: unknown, member: string): string[] {
        const list = typeof value === 'string' ? [value] : Array.isArray(value) ? value : null;
        if (!list)
            throw new HelixArgumentError(member, 'esperava uma lista de nomes de camadas (textos).');
        return list.map((entry) => {
            if (typeof entry !== 'string' || entry.trim().length === 0)
                throw new HelixArgumentError(member, `nome de camada inválido: ${String(entry)}.`);
            return entry;
        });
    }
    const joints = createJointsApi({ host, world, bodyOf, wrapBody, entityOfBody });
    const forces = createForcesApi({ host, world });
    return {
        joints,
        forces,
        get settings() {
            return scene.physics;
        },
        set: (patch: unknown) => {
            const copy: Record<string, unknown> = {};
            assignSettings(copy, patch, 'helix.physics.set', { allowUnknown: true });
            session.updatePhysics(copy as Parameters<typeof session.updatePhysics>[0]);
        },
        get gravity() {
            return scene.physics.gravity;
        },
        set gravity(value: Vec3) {
            toVec3(value, 'helix.physics.gravity', scene.physics.gravity);
            session.notify();
        },
        get quality(): PhysicsQuality | null {
            return matchPhysicsQuality(scene.physics);
        },
        set quality(value: PhysicsQuality | null) {
            session.applyPhysicsQuality(requireOneOf(value, Object.keys(PHYSICS_QUALITY_PRESETS) as PhysicsQuality[], 'helix.physics.quality', 'a qualidade'));
        },
        resetSettings: () => session.resetPhysicsSettings(),
        get running() {
            return session.playtest.physics !== null;
        },
        get enabled() {
            return host.switches.physics;
        },
        set enabled(value: boolean) {
            host.switches.physics = Boolean(value);
        },
    };
}
