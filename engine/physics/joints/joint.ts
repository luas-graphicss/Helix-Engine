import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import * as quat from '@/engine/core/math/quat';
import type { Quat } from '@/engine/core/math/quat';
import type { Mat3 } from '@/engine/core/math/mat3';
import type { RigidBody } from '@/engine/physics/body/rigid-body';
import { computeSoftness, createSoftness, type Softness } from '@/engine/physics/solver/soft-constraint';
import { ZERO_MAT3, type JointPair, type JointSolverContext } from './joint-math';
import { sanitizeJointDefinition, type JointDefinition, type JointType } from './joint-settings';
const scratchQuat = quat.create();
const scratchTarget = quat.create();
const scratchConjugate = quat.create();
export abstract class Joint implements JointPair {
    abstract readonly type: JointType;
    version = 0;
    broken = false;
    readonly reactionForce = vec3.create();
    readonly reactionTorque = vec3.create();
    coordinate = 0;
    speed = 0;
    axialForce = 0;
    motorForce = 0;
    mA = 0;
    mB = 0;
    IA: Mat3 = ZERO_MAT3;
    IB: Mat3 = ZERO_MAT3;
    protected readonly rA = vec3.create();
    protected readonly rB = vec3.create();
    protected readonly springSoftness: Softness = createSoftness();
    protected springActive = false;
    protected idle = true;
    constructor(readonly id: number, readonly bodyA: RigidBody, readonly bodyB: RigidBody, readonly definition: JointDefinition) {
        sanitizeJointDefinition(definition);
    }
    get isActive(): boolean {
        return this.definition.enabled && !this.broken && (this.bodyA.isSimulated || this.bodyB.isSimulated);
    }
    markChanged(): void {
        sanitizeJointDefinition(this.definition);
        this.version++;
        this.wakeBodies();
    }
    wakeBodies(): void {
        this.bodyA.wake();
        this.bodyB.wake();
    }
    break(): void {
        if (this.broken)
            return;
        this.broken = true;
        this.resetImpulses();
        this.wakeBodies();
    }
    prepare(context: JointSolverContext): void {
        const { bodyA, bodyB } = this;
        const simulatedA = bodyA.isSimulated;
        const simulatedB = bodyB.isSimulated;
        this.idle = !simulatedA && !simulatedB;
        this.mA = simulatedA ? bodyA.invMass : 0;
        this.mB = simulatedB ? bodyB.invMass : 0;
        this.IA = simulatedA ? bodyA.invInertiaWorld : ZERO_MAT3;
        this.IB = simulatedB ? bodyB.invInertiaWorld : ZERO_MAT3;
        if (this.idle)
            return;
        const { spring } = this.definition;
        this.springActive = spring.enabled && spring.hertz > 0;
        if (this.springActive) {
            computeSoftness(this.springSoftness, Math.min(spring.hertz, 0.25 * context.invH), spring.dampingRatio, context.h);
        }
        if (!context.warmStarting)
            this.resetImpulses();
        this.prepareJoint(context);
    }
    warmStart(context: JointSolverContext): void {
        if (this.idle)
            return;
        this.updateAnchors();
        this.warmStartJoint(context);
    }
    solve(context: JointSolverContext, useBias: boolean): void {
        if (this.idle)
            return;
        this.updateAnchors();
        this.solveJoint(context, useBias);
    }
    finalize(context: JointSolverContext): void {
        if (this.idle) {
            vec3.set(this.reactionForce, 0, 0, 0);
            vec3.set(this.reactionTorque, 0, 0, 0);
            this.axialForce = 0;
            this.motorForce = 0;
            this.speed = 0;
            return;
        }
        this.updateAnchors();
        this.collectReaction(this.reactionForce, this.reactionTorque);
        vec3.scale(this.reactionForce, this.reactionForce, context.invH);
        vec3.scale(this.reactionTorque, this.reactionTorque, context.invH);
        this.axialForce *= context.invH;
        this.finalizeJoint(context);
        const { breakForce, breakTorque } = this.definition;
        if ((breakForce !== Infinity && vec3.length(this.reactionForce) > breakForce) || (breakTorque !== Infinity && vec3.length(this.reactionTorque) > breakTorque)) {
            this.break();
        }
    }
    abstract resetImpulses(): void;
    protected abstract prepareJoint(context: JointSolverContext): void;
    protected abstract warmStartJoint(context: JointSolverContext): void;
    protected abstract solveJoint(context: JointSolverContext, useBias: boolean): void;
    protected abstract collectReaction(force: Vec3, torque: Vec3): void;
    protected abstract finalizeJoint(context: JointSolverContext): void;
    protected updateAnchors(): void {
        quat.rotateVec3(this.rA, this.bodyA.orientation, this.definition.localAnchorA);
        quat.rotateVec3(this.rB, this.bodyB.orientation, this.definition.localAnchorB);
    }
    protected anchorDelta(out: Vec3): Vec3 {
        const pA = this.bodyA.position;
        const pB = this.bodyB.position;
        out[0] = pB[0] + this.rB[0] - pA[0] - this.rA[0];
        out[1] = pB[1] + this.rB[1] - pA[1] - this.rA[1];
        out[2] = pB[2] + this.rB[2] - pA[2] - this.rA[2];
        return out;
    }
    protected relativeRotation(out: Quat): Quat {
        quat.conjugate(scratchConjugate, this.bodyA.orientation);
        quat.multiply(scratchQuat, scratchConjugate, this.bodyB.orientation);
        quat.conjugate(scratchConjugate, this.definition.referenceRotation);
        quat.multiply(out, scratchConjugate, scratchQuat);
        return quat.normalize(out, out);
    }
    protected rotationError(out: Vec3): Vec3 {
        quat.multiply(scratchTarget, this.bodyA.orientation, this.definition.referenceRotation);
        quat.conjugate(scratchTarget, scratchTarget);
        const error = quat.multiply(scratchQuat, this.bodyB.orientation, scratchTarget);
        quat.normalize(error, error);
        const sign = error[3] < 0 ? -1 : 1;
        const vx = error[0] * sign;
        const vy = error[1] * sign;
        const vz = error[2] * sign;
        const w = error[3] * sign;
        const sinHalf = Math.hypot(vx, vy, vz);
        if (sinHalf < 1e-9)
            return vec3.set(out, 2 * vx, 2 * vy, 2 * vz);
        const angle = 2 * Math.atan2(sinHalf, w);
        const scale = angle / sinHalf;
        return vec3.set(out, vx * scale, vy * scale, vz * scale);
    }
    protected twistAngle(relative: Quat, axis: Vec3): number {
        const along = relative[0] * axis[0] + relative[1] * axis[1] + relative[2] * axis[2];
        let angle = 2 * Math.atan2(along, relative[3]);
        if (angle > Math.PI)
            angle -= 2 * Math.PI;
        else if (angle <= -Math.PI)
            angle += 2 * Math.PI;
        return angle;
    }
}
