import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import * as quat from '@/engine/core/math/quat';
import * as mat4 from '@/engine/core/math/mat4';
import type { Mat4 } from '@/engine/core/math/mat4';
import type { Scene } from '@/engine/core/scene/scene';
import type { Entity } from '@/engine/core/scene/entity';
import type { RigidBody } from '@/engine/physics/body/rigid-body';
import { cloneRigidBodySettings, createShapeFromSettings, sameCollisionLayers, sameRigidBodyShape, type RigidBodySettings, } from '@/engine/physics/body/rigid-body-settings';
import { DEFAULT_COLLISION_LAYER } from '@/engine/physics/world/collision-layers';
import { createHeightfieldShape } from '@/engine/physics/shapes/collider-shape';
import { getMeshVersion, type MeshData } from '@/engine/renderer/geometry/mesh-data';
import { BuoyancyField } from '@/engine/physics/fluids/buoyancy-field';
import { WaterVolume } from '@/engine/physics/fluids/water-volume';
import { PhysicsWorld, type PhysicsBackend } from '@/engine/physics/world/physics-world';
import { PhysicsWorkerLink, createPhysicsWorkerChannel, type PhysicsChannel } from '@/engine/physics/worker/physics-worker-link';
import { copyMatrix, waterSignature, type WaterTerrainRecord } from '@/engine/physics/worker/physics-protocol';
export interface PhysicsBinding {
    readonly entity: Entity;
    readonly body: RigidBody;
    readonly applied: RigidBodySettings;
    readonly scale: Vec3;
    readonly centerOffset: Vec3;
    readonly writtenPosition: Vec3;
    readonly writtenRotation: Vec3;
    readonly mesh: MeshData | null;
    readonly meshVersion: number;
}
interface TerrainBinding {
    readonly entity: Entity;
    readonly body: RigidBody;
    readonly water: WaterVolume;
    readonly matrix: Mat4;
    readonly key: number;
    waterSignature: string;
}
export interface PhysicsSceneEvents {
    onOutOfBounds?(entity: Entity): void;
    onUnstable?(entity: Entity): void;
    onBackendFallback?(message: string): void;
    onRemoteFrame?(): void;
}
export interface PhysicsSceneOptions {
    readonly backend?: PhysicsBackend;
    readonly channel?: () => PhysicsChannel;
}
const TERRAIN_FRICTION = 0.8;
const worldPosition = vec3.create();
const worldRotation = quat.create();
const worldScale = vec3.create();
const rotatedOffset = vec3.create();
const bodyPosition = vec3.create();
const parentRotation = quat.create();
const localRotation = quat.create();
const inverseParent = mat4.create();
function readWorldScale(out: Vec3, matrix: Mat4): Vec3 {
    out[0] = Math.hypot(matrix[0], matrix[1], matrix[2]);
    out[1] = Math.hypot(matrix[4], matrix[5], matrix[6]);
    out[2] = Math.hypot(matrix[8], matrix[9], matrix[10]);
    return out;
}
function sameVec3(a: Vec3, b: Vec3): boolean {
    return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}
const SCALE_TOLERANCE = 1e-4;
function nearlySameScale(a: Vec3, b: Vec3): boolean {
    for (let axis = 0; axis < 3; axis++) {
        if (Math.abs(a[axis] - b[axis]) > SCALE_TOLERANCE * Math.max(1, Math.abs(b[axis])))
            return false;
    }
    return true;
}
function sameMat4(a: Mat4, b: Mat4): boolean {
    for (let i = 0; i < 16; i++)
        if (a[i] !== b[i])
            return false;
    return true;
}
export class PhysicsScene {
    readonly world: PhysicsWorld;
    private readonly bindings = new Map<Entity, PhysicsBinding>();
    private readonly terrains = new Map<Entity, TerrainBinding>();
    private readonly entityByBody = new Map<RigidBody, Entity>();
    private readonly visited = new Set<Entity>();
    private readonly buoyancy: BuoyancyField;
    private removeBuoyancy: () => void;
    private nextTerrainKey = 1;
    private waterDirty = false;
    private readonly waterHeightsPending = new Set<number>();
    constructor(readonly scene: Scene, private readonly events: PhysicsSceneEvents = {}, options: PhysicsSceneOptions = {}) {
        this.world = new PhysicsWorld(scene.physics, {
            onOutOfBounds: (body) => {
                const entity = this.entityByBody.get(body);
                if (entity)
                    events.onOutOfBounds?.(entity);
            },
            onUnstable: (body) => {
                const entity = this.entityByBody.get(body);
                if (entity)
                    events.onUnstable?.(entity);
            },
            onBackendFallback: (message) => events.onBackendFallback?.(message),
        });
        this.buoyancy = new BuoyancyField(() => this.waterVolumes(), scene.physics);
        this.removeBuoyancy = this.world.addForceField(this.buoyancy, { remote: true });
        const backend = options.backend ?? 'local';
        if (backend !== 'local')
            this.attachWorker(backend, options.channel ?? createPhysicsWorkerChannel);
    }
    private attachWorker(backend: Exclude<PhysicsBackend, 'local'>, channel: () => PhysicsChannel): void {
        try {
            this.world.attachRemote(new PhysicsWorkerLink(this.world, backend, channel()));
        }
        catch (cause) {
            this.events.onBackendFallback?.(cause instanceof Error ? cause.message : String(cause));
        }
    }
    bindingOf(entity: Entity): PhysicsBinding | null {
        return this.bindings.get(entity) ?? null;
    }
    ensureBinding(entity: Entity): PhysicsBinding | null {
        const existing = this.bindings.get(entity);
        if (existing)
            return existing;
        const settings = entity.rigidBody;
        if (!settings || entity.terrain || !this.scene.root.contains(entity))
            return null;
        this.scene.updateWorldMatrices();
        return this.createBinding(entity, settings);
    }
    ensureBindings(): void {
        let updated = false;
        const entities = this.scene.entities;
        for (let i = 0; i < entities.length; i++) {
            const entity = entities[i];
            const settings = entity.rigidBody;
            if (!settings || entity.terrain || this.bindings.has(entity))
                continue;
            if (!updated) {
                this.scene.updateWorldMatrices();
                updated = true;
            }
            this.createBinding(entity, settings);
        }
    }
    entityOf(body: RigidBody): Entity | null {
        return this.entityByBody.get(body) ?? null;
    }
    update(deltaSeconds: number, sceneTime?: number): number {
        this.reconcile();
        if (sceneTime !== undefined)
            this.world.time = sceneTime;
        const steps = this.world.advance(deltaSeconds);
        this.syncToScene(this.world.interpolation);
        return steps;
    }
    stepOnce(): void {
        this.reconcile();
        const remote = this.world.remoteLink;
        if (remote) {
            remote.onceFrame(() => {
                this.syncToScene(1);
                this.events.onRemoteFrame?.();
            });
        }
        this.world.step();
        this.world.discardAccumulatedTime();
        if (!remote)
            this.syncToScene(1);
    }
    dispose(): void {
        this.removeBuoyancy();
        this.world.clear();
        this.world.detachRemote();
        this.bindings.clear();
        this.terrains.clear();
        this.entityByBody.clear();
        this.removeBuoyancy = this.world.addForceField(this.buoyancy, { remote: true });
    }
    private publishWater(withHeights: Set<number> | null): void {
        const remote = this.world.remoteLink;
        if (!(remote instanceof PhysicsWorkerLink))
            return;
        const records: WaterTerrainRecord[] = [];
        for (const binding of this.terrains.values()) {
            const terrain = binding.entity.terrain;
            if (!terrain)
                continue;
            const includeHeights = withHeights === null || withHeights.has(binding.key);
            records.push({
                key: binding.key,
                matrix: copyMatrix(binding.matrix),
                size: terrain.size,
                resolution: terrain.resolution,
                heights: includeHeights ? terrain.heightfield.heights.slice() : undefined,
                water: terrain.water,
            });
        }
        remote.setWater(records);
    }
    private *waterVolumes(): Iterable<WaterVolume> {
        for (const binding of this.terrains.values()) {
            if (binding.water.enabled)
                yield binding.water;
        }
    }
    reconcile(): void {
        this.scene.updateWorldMatrices();
        this.visited.clear();
        const entities = this.scene.entities;
        for (let i = 0; i < entities.length; i++) {
            const entity = entities[i];
            if (entity.terrain && entity.visible) {
                this.visited.add(entity);
                this.reconcileTerrain(entity);
                continue;
            }
            const settings = entity.rigidBody;
            if (!settings)
                continue;
            this.visited.add(entity);
            let binding = this.bindings.get(entity);
            if (binding && this.needsRebuild(binding, settings)) {
                const previous = binding.body;
                this.destroyBinding(binding);
                binding = this.createBinding(entity, settings);
                vec3.copy(binding.body.linearVelocity, previous.linearVelocity);
                vec3.copy(binding.body.angularVelocity, previous.angularVelocity);
                continue;
            }
            if (!binding) {
                this.createBinding(entity, settings);
                continue;
            }
            binding.body.setMaterial(settings);
            if (!sameCollisionLayers(binding.applied, settings))
                this.applyCollisionLayers(binding, settings);
            if (!sameVec3(entity.transform.position, binding.writtenPosition) || !sameVec3(entity.transform.rotation, binding.writtenRotation)) {
                this.teleportToEntity(binding);
            }
        }
        for (const binding of this.bindings.values()) {
            if (!this.visited.has(binding.entity))
                this.destroyBinding(binding);
        }
        for (const binding of this.terrains.values()) {
            if (!this.visited.has(binding.entity))
                this.destroyTerrainBinding(binding);
        }
        if (this.waterDirty) {
            this.waterDirty = false;
            this.publishWater(this.waterHeightsPending);
            this.waterHeightsPending.clear();
        }
    }
    private reconcileTerrain(entity: Entity): void {
        const existing = this.terrains.get(entity);
        if (existing && sameMat4(existing.matrix, entity.worldMatrix)) {
            const signature = waterSignature(existing.water.terrain.water);
            if (signature !== existing.waterSignature) {
                existing.waterSignature = signature;
                this.waterDirty = true;
            }
            return;
        }
        if (existing)
            this.destroyTerrainBinding(existing);
        const terrain = entity.terrain;
        if (!terrain)
            return;
        const shape = createHeightfieldShape(terrain, entity.worldMatrix);
        if (!shape)
            return;
        mat4.getTranslation(worldPosition, entity.worldMatrix);
        quat.fromMat4Rotation(worldRotation, entity.worldMatrix);
        const body = this.world.createBody({
            type: 'static',
            shape,
            position: worldPosition,
            orientation: worldRotation,
            mass: 0,
            friction: TERRAIN_FRICTION,
            restitution: 0,
            linearDamping: 0,
            angularDamping: 0,
            gravityScale: 1,
            canSleep: true,
        });
        const matrix = mat4.copy(mat4.create(), entity.worldMatrix);
        const key = this.nextTerrainKey++;
        this.terrains.set(entity, { entity, body, water: new WaterVolume(terrain, matrix), matrix, key, waterSignature: waterSignature(terrain.water) });
        this.entityByBody.set(body, entity);
        this.waterHeightsPending.add(key);
        this.waterDirty = true;
    }
    private destroyTerrainBinding(binding: TerrainBinding): void {
        this.world.removeBody(binding.body);
        this.terrains.delete(binding.entity);
        this.entityByBody.delete(binding.body);
        this.waterHeightsPending.delete(binding.key);
        this.waterDirty = true;
    }
    syncToScene(alpha: number): void {
        this.scene.updateWorldMatrices();
        this.writeSubtree(this.scene.root, alpha);
        this.scene.updateWorldMatrices();
    }
    private writeSubtree(entity: Entity, alpha: number): void {
        const binding = this.bindings.get(entity);
        if (binding && !binding.body.isStatic) {
            this.writePose(binding, alpha);
            entity.transform.updateLocalMatrix();
            if (entity.parent)
                mat4.multiply(entity.worldMatrix, entity.parent.worldMatrix, entity.transform.localMatrix);
            else
                mat4.copy(entity.worldMatrix, entity.transform.localMatrix);
            entity.worldMatrixStale = true;
        }
        for (const child of entity.children)
            this.writeSubtree(child, alpha);
    }
    private writePose(binding: PhysicsBinding, alpha: number): void {
        const { body, entity } = binding;
        const previous = body.previousPosition;
        const current = body.position;
        bodyPosition[0] = previous[0] + (current[0] - previous[0]) * alpha;
        bodyPosition[1] = previous[1] + (current[1] - previous[1]) * alpha;
        bodyPosition[2] = previous[2] + (current[2] - previous[2]) * alpha;
        quat.nlerp(worldRotation, body.previousOrientation, body.orientation, alpha);
        quat.rotateVec3(rotatedOffset, worldRotation, binding.centerOffset);
        vec3.subtract(worldPosition, bodyPosition, rotatedOffset);
        const parent = entity.parent;
        if (parent) {
            if (!mat4.invert(inverseParent, parent.worldMatrix))
                return;
            mat4.transformPoint(entity.transform.position, inverseParent, worldPosition);
            quat.fromMat4Rotation(parentRotation, parent.worldMatrix);
            quat.conjugate(parentRotation, parentRotation);
            quat.multiply(localRotation, parentRotation, worldRotation);
            quat.toEulerDegrees(entity.transform.rotation, localRotation);
        }
        else {
            vec3.copy(entity.transform.position, worldPosition);
            quat.toEulerDegrees(entity.transform.rotation, worldRotation);
        }
        vec3.copy(binding.writtenPosition, entity.transform.position);
        vec3.copy(binding.writtenRotation, entity.transform.rotation);
    }
    private needsRebuild(binding: PhysicsBinding, settings: RigidBodySettings): boolean {
        if (!sameRigidBodyShape(binding.applied, settings))
            return true;
        if (settings.collider === 'mesh') {
            const mesh = binding.entity.mesh;
            if (mesh !== binding.mesh || (mesh && getMeshVersion(mesh) !== binding.meshVersion))
                return true;
        }
        readWorldScale(worldScale, binding.entity.worldMatrix);
        return !nearlySameScale(worldScale, binding.scale);
    }
    private readBodyPose(entity: Entity, settings: RigidBodySettings): void {
        const matrix = entity.worldMatrix;
        mat4.getTranslation(worldPosition, matrix);
        quat.fromMat4Rotation(worldRotation, matrix);
        readWorldScale(worldScale, matrix);
        vec3.set(rotatedOffset, settings.center[0] * worldScale[0], settings.center[1] * worldScale[1], settings.center[2] * worldScale[2]);
        quat.rotateVec3(rotatedOffset, worldRotation, rotatedOffset);
        vec3.add(bodyPosition, worldPosition, rotatedOffset);
    }
    private createBinding(entity: Entity, settings: RigidBodySettings): PhysicsBinding {
        this.readBodyPose(entity, settings);
        const applied = cloneRigidBodySettings(settings);
        const scale = vec3.copy(vec3.create(), worldScale);
        const mesh = applied.collider === 'mesh' ? entity.mesh : null;
        const body = this.world.createBody({
            type: applied.type,
            shape: createShapeFromSettings(applied, scale, mesh),
            position: bodyPosition,
            orientation: worldRotation,
            mass: applied.mass,
            friction: applied.friction,
            restitution: applied.restitution,
            linearDamping: applied.linearDamping,
            angularDamping: applied.angularDamping,
            gravityScale: applied.gravityScale,
            canSleep: applied.canSleep,
            layer: this.world.layers.indexOf(applied.layer ?? DEFAULT_COLLISION_LAYER),
            collisionMask: this.world.layers.maskOf(applied.collidesWith),
        });
        const binding: PhysicsBinding = {
            entity,
            body,
            applied,
            scale,
            centerOffset: vec3.create(applied.center[0] * scale[0], applied.center[1] * scale[1], applied.center[2] * scale[2]),
            writtenPosition: vec3.copy(vec3.create(), entity.transform.position),
            writtenRotation: vec3.copy(vec3.create(), entity.transform.rotation),
            mesh,
            meshVersion: mesh ? getMeshVersion(mesh) : 0,
        };
        this.bindings.set(entity, binding);
        this.entityByBody.set(body, entity);
        return binding;
    }
    private destroyBinding(binding: PhysicsBinding): void {
        this.world.removeBody(binding.body);
        this.bindings.delete(binding.entity);
        this.entityByBody.delete(binding.body);
    }
    private applyCollisionLayers(binding: PhysicsBinding, settings: RigidBodySettings): void {
        const { body, applied } = binding;
        body.layer = this.world.layers.indexOf(settings.layer ?? DEFAULT_COLLISION_LAYER);
        body.collisionMask = this.world.layers.maskOf(settings.collidesWith);
        if (settings.layer === undefined)
            delete applied.layer;
        else
            applied.layer = settings.layer;
        if (settings.collidesWith === undefined)
            delete applied.collidesWith;
        else
            applied.collidesWith = settings.collidesWith.slice();
        body.wake();
    }
    private teleportToEntity(binding: PhysicsBinding): void {
        this.readBodyPose(binding.entity, binding.applied);
        this.world.teleport(binding.body, bodyPosition, worldRotation);
        vec3.copy(binding.writtenPosition, binding.entity.transform.position);
        vec3.copy(binding.writtenRotation, binding.entity.transform.rotation);
    }
}
