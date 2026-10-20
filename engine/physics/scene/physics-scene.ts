import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import * as quat from '@/engine/core/math/quat';
import * as mat4 from '@/engine/core/math/mat4';
import type { Mat4 } from '@/engine/core/math/mat4';
import type { Scene } from '@/engine/core/scene/scene';
import type { Entity } from '@/engine/core/scene/entity';
import type { RigidBody } from '@/engine/physics/body/rigid-body';
import { cloneRigidBodySettings, createShapeFromSettings, sameRigidBodyShape, type RigidBodySettings, } from '@/engine/physics/body/rigid-body-settings';
import { PhysicsWorld } from '@/engine/physics/world/physics-world';
export interface PhysicsBinding {
    readonly entity: Entity;
    readonly body: RigidBody;
    readonly applied: RigidBodySettings;
    readonly scale: Vec3;
    readonly centerOffset: Vec3;
    readonly writtenPosition: Vec3;
    readonly writtenRotation: Vec3;
}
export interface PhysicsSceneEvents {
    onOutOfBounds?(entity: Entity): void;
    onUnstable?(entity: Entity): void;
}
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
export class PhysicsScene {
    readonly world: PhysicsWorld;
    private readonly bindings = new Map<Entity, PhysicsBinding>();
    private readonly entityByBody = new Map<RigidBody, Entity>();
    private readonly visited = new Set<Entity>();
    constructor(readonly scene: Scene, events: PhysicsSceneEvents = {}) {
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
        });
    }
    bindingOf(entity: Entity): PhysicsBinding | null {
        return this.bindings.get(entity) ?? null;
    }
    update(deltaSeconds: number): number {
        this.reconcile();
        const steps = this.world.advance(deltaSeconds);
        this.syncToScene(this.world.interpolation);
        return steps;
    }
    stepOnce(): void {
        this.reconcile();
        this.world.step();
        this.world.discardAccumulatedTime();
        this.syncToScene(1);
    }
    dispose(): void {
        this.world.clear();
        this.bindings.clear();
        this.entityByBody.clear();
    }
    reconcile(): void {
        this.scene.updateWorldMatrices();
        this.visited.clear();
        this.scene.traverse((entity) => {
            const settings = entity.rigidBody;
            if (!settings)
                return;
            this.visited.add(entity);
            let binding = this.bindings.get(entity);
            if (binding && this.needsRebuild(binding, settings)) {
                const previous = binding.body;
                this.destroyBinding(binding);
                binding = this.createBinding(entity, settings);
                vec3.copy(binding.body.linearVelocity, previous.linearVelocity);
                vec3.copy(binding.body.angularVelocity, previous.angularVelocity);
                return;
            }
            if (!binding) {
                this.createBinding(entity, settings);
                return;
            }
            binding.body.setMaterial(settings);
            if (!sameVec3(entity.transform.position, binding.writtenPosition) || !sameVec3(entity.transform.rotation, binding.writtenRotation)) {
                this.teleportToEntity(binding);
            }
        });
        for (const binding of this.bindings.values()) {
            if (!this.visited.has(binding.entity))
                this.destroyBinding(binding);
        }
    }
    syncToScene(alpha: number): void {
        this.scene.updateWorldMatrices();
        this.writeSubtree(this.scene.root, alpha);
        this.scene.updateWorldMatrices();
    }
    private writeSubtree(entity: Entity, alpha: number): void {
        const binding = this.bindings.get(entity);
        if (binding && binding.body.type === 'dynamic') {
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
        readWorldScale(worldScale, binding.entity.worldMatrix);
        return !sameVec3(worldScale, binding.scale);
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
        const body = this.world.createBody({
            type: applied.type,
            shape: createShapeFromSettings(applied, scale),
            position: bodyPosition,
            orientation: worldRotation,
            mass: applied.mass,
            friction: applied.friction,
            restitution: applied.restitution,
            linearDamping: applied.linearDamping,
            angularDamping: applied.angularDamping,
            gravityScale: applied.gravityScale,
            canSleep: applied.canSleep,
        });
        const binding: PhysicsBinding = {
            entity,
            body,
            applied,
            scale,
            centerOffset: vec3.create(applied.center[0] * scale[0], applied.center[1] * scale[1], applied.center[2] * scale[2]),
            writtenPosition: vec3.copy(vec3.create(), entity.transform.position),
            writtenRotation: vec3.copy(vec3.create(), entity.transform.rotation),
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
    private teleportToEntity(binding: PhysicsBinding): void {
        this.readBodyPose(binding.entity, binding.applied);
        this.world.teleport(binding.body, bodyPosition, worldRotation);
        vec3.copy(binding.writtenPosition, binding.entity.transform.position);
        vec3.copy(binding.writtenRotation, binding.entity.transform.rotation);
    }
}
