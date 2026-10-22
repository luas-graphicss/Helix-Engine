import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import * as quat from '@/engine/core/math/quat';
import type { Quat } from '@/engine/core/math/quat';
import * as mat3 from '@/engine/core/math/mat3';
import * as aabb from '@/engine/core/math/aabb';
import { clamp } from '@/engine/core/math/scalar';
import { shapeMaxExtent, type ColliderShape } from '@/engine/physics/shapes/collider-shape';
import { computeLocalInertia } from './mass-properties';
import type { BodyType } from './rigid-body-settings';
export interface RigidBodyMaterial {
    friction: number;
    restitution: number;
    linearDamping: number;
    angularDamping: number;
    gravityScale: number;
    canSleep: boolean;
}
export interface RigidBodyOptions extends RigidBodyMaterial {
    type: BodyType;
    shape: ColliderShape;
    position: Vec3;
    orientation: Quat;
    mass: number;
}
const MIN_MASS = 0.001;
const FALLBACK_MASS = 1;
const scratchInertia = vec3.create();
const inverseOrientation = quat.create();
const orientationDelta = quat.create();
function finiteOr(value: number, fallback: number): number {
    return Number.isFinite(value) ? value : fallback;
}
export class RigidBody {
    readonly type: BodyType;
    readonly shape: ColliderShape;
    friction = 0.6;
    restitution = 0;
    linearDamping = 0;
    angularDamping = 0;
    gravityScale = 1;
    canSleep = true;
    readonly position = vec3.create();
    readonly orientation = quat.create();
    readonly rotation = mat3.create();
    readonly linearVelocity = vec3.create();
    readonly angularVelocity = vec3.create();
    readonly previousPosition = vec3.create();
    readonly previousOrientation = quat.create();
    readonly mass: number;
    readonly invMass: number;
    readonly invInertiaLocal = vec3.create();
    readonly invInertiaWorld = mat3.create();
    readonly maxExtent: number;
    readonly deltaPosition = vec3.create();
    readonly deltaOrientation = quat.create();
    readonly aabb = aabb.create();
    sleeping = false;
    sleepTime = 0;
    outOfBounds = false;
    islandSlot = -1;
    constructor(readonly id: number, options: RigidBodyOptions) {
        this.type = options.type;
        this.shape = options.shape;
        this.maxExtent = shapeMaxExtent(options.shape);
        this.setMaterial(options);
        if (options.type === 'dynamic') {
            const requested = finiteOr(options.mass, FALLBACK_MASS);
            this.mass = Math.max(requested > 0 ? requested : FALLBACK_MASS, MIN_MASS);
            this.invMass = 1 / this.mass;
            computeLocalInertia(scratchInertia, options.shape, this.mass);
            vec3.set(this.invInertiaLocal, 1 / scratchInertia[0], 1 / scratchInertia[1], 1 / scratchInertia[2]);
        }
        else {
            this.mass = 0;
            this.invMass = 0;
        }
        this.setPose(options.position, options.orientation);
    }
    get isStatic(): boolean {
        return this.type === 'static';
    }
    get isKinematic(): boolean {
        return this.type === 'kinematic';
    }
    get isDynamic(): boolean {
        return this.type === 'dynamic';
    }
    get isMoving(): boolean {
        const v = this.linearVelocity;
        const w = this.angularVelocity;
        return v[0] !== 0 || v[1] !== 0 || v[2] !== 0 || w[0] !== 0 || w[1] !== 0 || w[2] !== 0;
    }
    get isResting(): boolean {
        if (this.type === 'static' || this.sleeping)
            return true;
        return this.type === 'kinematic' && !this.isMoving;
    }
    get isSimulated(): boolean {
        return this.type === 'dynamic' && !this.sleeping && !this.outOfBounds;
    }
    get isActive(): boolean {
        return this.isSimulated || (this.type === 'kinematic' && this.isMoving);
    }
    get motionSpeed(): number {
        return vec3.length(this.linearVelocity) + vec3.length(this.angularVelocity) * this.maxExtent;
    }
    setMaterial(material: RigidBodyMaterial): void {
        this.friction = clamp(finiteOr(material.friction, 0.6), 0, 10);
        this.restitution = clamp(finiteOr(material.restitution, 0), 0, 1);
        this.linearDamping = clamp(finiteOr(material.linearDamping, 0), 0, 1000);
        this.angularDamping = clamp(finiteOr(material.angularDamping, 0), 0, 1000);
        this.gravityScale = clamp(finiteOr(material.gravityScale, 1), -100, 100);
        this.canSleep = material.canSleep;
    }
    setPose(position: Vec3, orientation: Quat): void {
        vec3.copy(this.position, position);
        quat.normalize(this.orientation, orientation);
        this.updateRotation();
        this.storePreviousPose();
        this.resetStepDeltas();
    }
    applyImpulse(impulse: Vec3): void {
        if (this.type !== 'dynamic' || this.outOfBounds)
            return;
        vec3.scaleAndAdd(this.linearVelocity, this.linearVelocity, impulse, this.invMass);
        this.wake();
    }
    teleport(position: Vec3, orientation: Quat): void {
        this.setPose(position, orientation);
        vec3.set(this.linearVelocity, 0, 0, 0);
        vec3.set(this.angularVelocity, 0, 0, 0);
        this.wake();
    }
    moveKinematic(position: Vec3, orientation: Quat, h: number): void {
        const invH = h > 0 ? 1 / h : 0;
        const v = this.linearVelocity;
        v[0] = (position[0] - this.position[0]) * invH;
        v[1] = (position[1] - this.position[1]) * invH;
        v[2] = (position[2] - this.position[2]) * invH;
        quat.conjugate(inverseOrientation, this.orientation);
        quat.multiply(orientationDelta, orientation, inverseOrientation);
        quat.normalize(orientationDelta, orientationDelta);
        const sinHalf = Math.hypot(orientationDelta[0], orientationDelta[1], orientationDelta[2]);
        const angle = 2 * Math.atan2(sinHalf, Math.abs(orientationDelta[3]));
        const w = this.angularVelocity;
        if (sinHalf > 1e-9 && angle > 0) {
            const scale = (angle * invH * (orientationDelta[3] < 0 ? -1 : 1)) / sinHalf;
            vec3.set(w, orientationDelta[0] * scale, orientationDelta[1] * scale, orientationDelta[2] * scale);
        }
        else {
            vec3.set(w, 0, 0, 0);
        }
        vec3.copy(this.position, position);
        quat.normalize(this.orientation, orientation);
        this.updateRotation();
    }
    updateRotation(): void {
        mat3.fromQuat(this.rotation, this.orientation);
        mat3.rotateDiagonal(this.invInertiaWorld, this.rotation, this.invInertiaLocal);
    }
    storePreviousPose(): void {
        vec3.copy(this.previousPosition, this.position);
        quat.copy(this.previousOrientation, this.orientation);
    }
    resetStepDeltas(): void {
        vec3.set(this.deltaPosition, 0, 0, 0);
        quat.identity(this.deltaOrientation);
    }
    isStateFinite(): boolean {
        const { position: p, linearVelocity: v, angularVelocity: w, orientation: q } = this;
        return (Number.isFinite(p[0]) && Number.isFinite(p[1]) && Number.isFinite(p[2]) &&
            Number.isFinite(v[0]) && Number.isFinite(v[1]) && Number.isFinite(v[2]) &&
            Number.isFinite(w[0]) && Number.isFinite(w[1]) && Number.isFinite(w[2]) &&
            Number.isFinite(q[0]) && Number.isFinite(q[1]) && Number.isFinite(q[2]) && Number.isFinite(q[3]));
    }
    recoverFromInstability(): void {
        this.setPose(this.previousPosition, this.previousOrientation);
        this.sleep();
    }
    wake(): void {
        if (this.type === 'static' || this.outOfBounds)
            return;
        this.sleeping = false;
        this.sleepTime = 0;
    }
    sleep(): void {
        this.sleeping = true;
        this.sleepTime = 0;
        vec3.set(this.linearVelocity, 0, 0, 0);
        vec3.set(this.angularVelocity, 0, 0, 0);
        this.storePreviousPose();
    }
}
