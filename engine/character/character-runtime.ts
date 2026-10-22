import * as vec3 from '@/engine/core/math/vec3';
import * as mat4 from '@/engine/core/math/mat4';
import * as quat from '@/engine/core/math/quat';
import { RAD_TO_DEG } from '@/engine/core/math/scalar';
import type { Scene } from '@/engine/core/scene/scene';
import type { Entity } from '@/engine/core/scene/entity';
import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import type { PhysicsScene } from '@/engine/physics/scene/physics-scene';
import { applyPose, Pose } from './rig/pose';
import { findModelRoot, resolveCharacterRig, type CharacterRig } from './rig/character-rig';
import { getLoadedMannequinAsset } from './assets/mannequin-asset';
import { getCharacterModel } from './assets/character-model-registry';
import { LocomotionAnimator, type AnimatorInput } from './animation/locomotion-animator';
import { resolveCharacterClips } from './animation/character-clips';
import { CharacterController } from './controller/character-controller';
import { CharacterInput, type InputFrame } from './controller/character-input';
import { ThirdPersonCamera } from './controller/third-person-camera';
import { TerrainCollider } from './controller/terrain-collider';
export interface CharacterInstance {
    readonly entity: Entity;
    readonly controller: CharacterController;
    rig: CharacterRig | null;
    animator: LocomotionAnimator | null;
    pose: Pose | null;
    rigUnavailable: boolean;
}
export interface CharacterRuntimeOptions {
    canvas: HTMLCanvasElement | null;
    camera: PerspectiveCamera;
    onPointerLockChange?: (locked: boolean) => void;
}
const worldPosition = vec3.create();
const worldRotation = quat.create();
const forward = vec3.create();
const inverseParent = mat4.create();
const parentRotation = quat.create();
const localRotation = quat.create();
const yawRotation = quat.create();
const yawEuler = vec3.create();
function lerpAngle(a: number, b: number, t: number): number {
    let delta = (b - a) % 360;
    if (delta > 180)
        delta -= 360;
    else if (delta < -180)
        delta += 360;
    return a + delta * t;
}
export class CharacterRuntime {
    readonly instances: CharacterInstance[] = [];
    readonly possessed: CharacterInstance | null;
    readonly thirdPersonCamera: ThirdPersonCamera;
    private readonly input: CharacterInput | null;
    private readonly terrain: TerrainCollider;
    private readonly removeHook: () => void;
    private readonly frame: InputFrame = { x: 0, z: 0, run: false, jump: false, crouchToggles: 0, lookX: 0, lookY: 0, wheel: 0 };
    private readonly animatorInput: AnimatorInput = { speed: 0, grounded: true, crouching: false, jumped: false, landed: false, landingSpeed: 0, crouchSpeed: 1 };
    private readonly moveForward = vec3.create();
    private readonly moveRight = vec3.create();
    private crouchWanted = false;
    constructor(private readonly scene: Scene, private readonly physics: PhysicsScene, private readonly options: CharacterRuntimeOptions) {
        this.terrain = new TerrainCollider(scene);
        this.thirdPersonCamera = new ThirdPersonCamera(scene.player.camera);
        scene.updateWorldMatrices();
        scene.traverse((entity) => {
            const settings = entity.character;
            if (!settings)
                return;
            mat4.getTranslation(worldPosition, entity.worldMatrix);
            quat.fromMat4Rotation(worldRotation, entity.worldMatrix);
            quat.rotateVec3(forward, worldRotation, vec3.set(forward, 0, 0, 1));
            const yaw = Math.atan2(forward[0], forward[2]) * RAD_TO_DEG;
            const instance: CharacterInstance = {
                entity,
                controller: new CharacterController(physics.world, settings, this.terrain, worldPosition, yaw),
                rig: null,
                animator: null,
                pose: null,
                rigUnavailable: false,
            };
            this.bindRig(instance);
            this.instances.push(instance);
        });
        this.possessed = this.instances.find((instance) => instance.entity.character?.autoPossess) ?? null;
        this.input = this.possessed && options.canvas ? new CharacterInput(options.canvas, (locked) => options.onPointerLockChange?.(locked)) : null;
        if (this.possessed)
            this.thirdPersonCamera.yaw = this.possessed.controller.yaw;
        this.removeHook = physics.world.addPreStepHook((h) => {
            for (const instance of this.instances)
                instance.controller.step(h);
        });
    }
    get isPossessing(): boolean {
        return this.possessed !== null && this.input !== null;
    }
    get pointerLocked(): boolean {
        return this.input?.pointerLocked ?? false;
    }
    instanceOf(entity: Entity): CharacterInstance | null {
        return this.instances.find((instance) => instance.entity === entity) ?? null;
    }
    rebind(entity: Entity): void {
        const instance = this.instanceOf(entity);
        if (!instance)
            return;
        instance.rig = null;
        instance.animator = null;
        instance.pose = null;
        instance.rigUnavailable = false;
    }
    dispose(): void {
        this.removeHook();
        this.input?.dispose();
        for (const instance of this.instances)
            instance.controller.dispose();
    }
    applyInput(): void {
        const { possessed, input, frame } = this;
        if (!possessed || !input)
            return;
        input.consume(frame);
        const camera = this.thirdPersonCamera;
        camera.rotate(frame.lookX, frame.lookY);
        camera.zoom(frame.wheel);
        camera.moveBasis(this.moveForward, this.moveRight);
        const { intent } = possessed.controller;
        const move = intent.move;
        vec3.set(move, 0, 0, 0);
        vec3.scaleAndAdd(move, move, this.moveForward, frame.z);
        vec3.scaleAndAdd(move, move, this.moveRight, frame.x);
        const length = vec3.length(move);
        if (length > 1)
            vec3.scale(move, move, 1 / length);
        intent.run = frame.run;
        if (frame.crouchToggles % 2 === 1)
            this.crouchWanted = !this.crouchWanted;
        intent.crouch = this.crouchWanted;
        if (frame.jump)
            intent.jump = true;
    }
    present(dt: number, alpha: number): void {
        for (const instance of this.instances) {
            const { controller, entity } = instance;
            vec3.set(worldPosition, controller.previousPosition[0] + (controller.position[0] - controller.previousPosition[0]) * alpha, controller.previousPosition[1] + (controller.position[1] - controller.previousPosition[1]) * alpha, controller.previousPosition[2] + (controller.position[2] - controller.previousPosition[2]) * alpha);
            this.writeTransform(entity, worldPosition, lerpAngle(controller.previousYaw, controller.yaw, alpha));
            const input = this.animatorInput;
            input.speed = controller.horizontalSpeed;
            input.grounded = controller.grounded;
            input.crouching = controller.crouching;
            input.jumped = controller.jumped;
            input.landed = controller.landed;
            input.landingSpeed = controller.landingSpeed;
            input.crouchSpeed = entity.character?.crouchSpeed ?? 1;
            controller.consumeEvents();
            if (!instance.rig && !instance.rigUnavailable)
                this.bindRig(instance);
            const { animator, pose, rig } = instance;
            if (animator && pose && rig) {
                animator.update(dt, input, pose);
                applyPose(rig.joints, pose);
            }
        }
        const { possessed } = this;
        if (possessed) {
            const { controller } = possessed;
            this.thirdPersonCamera.update(dt, controller.position, controller.height, this.physics.world, controller.rigidBody, this.terrain, this.options.camera);
        }
    }
    private bindRig(instance: CharacterInstance): void {
        const settings = instance.entity.character;
        if (!settings)
            return;
        const asset = getCharacterModel(settings.model) ?? getLoadedMannequinAsset();
        if (!asset || !findModelRoot(instance.entity))
            return;
        const rig = asset.template ? resolveCharacterRig(this.scene, instance.entity, asset) : null;
        if (!rig || !asset.template) {
            instance.rigUnavailable = true;
            return;
        }
        instance.rig = rig;
        const clips = resolveCharacterClips(asset, settings);
        if (clips) {
            instance.animator = new LocomotionAnimator(asset.template, clips);
            instance.pose = new Pose(asset.template.jointCount);
        }
    }
    private writeTransform(entity: Entity, position: Float32Array, yaw: number): void {
        const { transform, parent } = entity;
        vec3.set(yawEuler, 0, yaw, 0);
        if (!parent) {
            vec3.copy(transform.position, position);
            vec3.copy(transform.rotation, yawEuler);
            return;
        }
        if (!mat4.invert(inverseParent, parent.worldMatrix))
            return;
        mat4.transformPoint(transform.position, inverseParent, position);
        quat.fromMat4Rotation(parentRotation, parent.worldMatrix);
        quat.conjugate(parentRotation, parentRotation);
        quat.fromEulerDegrees(yawRotation, yawEuler);
        quat.multiply(localRotation, parentRotation, yawRotation);
        quat.toEulerDegrees(transform.rotation, localRotation);
    }
}
