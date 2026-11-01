import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import * as quat from '@/engine/core/math/quat';
import { tangentBasis } from '@/engine/physics/collision/closest-points';
import { Joint } from './joint';
import { PerpendicularPart, RotationLockPart, ScalarImpulse, applyLinearImpulse, linearEffectiveMass, relativeLinearSpeed, solveLowerLimit, solveMotor, solveSpring, type JointSolverContext, } from './joint-math';
const scratchError = vec3.create();
export class SliderJoint extends Joint {
    readonly type = 'slider' as const;
    private readonly perpendicular = new PerpendicularPart();
    private readonly lock = new RotationLockPart();
    private readonly motorImpulse = new ScalarImpulse();
    private readonly lowerImpulse = new ScalarImpulse();
    private readonly upperImpulse = new ScalarImpulse();
    private readonly springImpulse = new ScalarImpulse();
    private readonly localPerp1 = vec3.create();
    private readonly localPerp2 = vec3.create();
    private readonly axis = vec3.create();
    private readonly perp1 = vec3.create();
    private readonly perp2 = vec3.create();
    private readonly delta = vec3.create();
    private readonly armA = vec3.create();
    private translation = 0;
    resetImpulses(): void {
        this.perpendicular.reset();
        this.lock.reset();
        this.motorImpulse.reset();
        this.lowerImpulse.reset();
        this.upperImpulse.reset();
        this.springImpulse.reset();
    }
    protected prepareJoint(): void {
        tangentBasis(this.localPerp1, this.localPerp2, this.definition.localAxisA);
    }
    private updateFrame(): void {
        const qA = this.bodyA.orientation;
        quat.rotateVec3(this.axis, qA, this.definition.localAxisA);
        quat.rotateVec3(this.perp1, qA, this.localPerp1);
        quat.rotateVec3(this.perp2, qA, this.localPerp2);
        this.anchorDelta(this.delta);
        this.translation = vec3.dot(this.delta, this.axis);
        vec3.add(this.armA, this.rA, this.delta);
    }
    private axialImpulse(): number {
        return this.motorImpulse.impulse + this.lowerImpulse.impulse - this.upperImpulse.impulse + this.springImpulse.impulse;
    }
    protected warmStartJoint(): void {
        this.updateFrame();
        this.perpendicular.warmStart(this, this.perp1, this.perp2, this.delta, this.rA, this.rB);
        this.lock.warmStart(this);
        const axial = this.axialImpulse();
        const a = this.axis;
        applyLinearImpulse(this, axial * a[0], axial * a[1], axial * a[2], this.armA, this.rB);
    }
    protected solveJoint(context: JointSolverContext, useBias: boolean): void {
        this.updateFrame();
        const { limits, motor, spring } = this.definition;
        const a = this.axis;
        const axialMass = linearEffectiveMass(this, a, this.armA, this.rB);
        if (this.springActive) {
            const delta = solveSpring(this.springImpulse, axialMass, this.translation - spring.target, relativeLinearSpeed(this, a, this.armA, this.rB), this.springSoftness, context.maxBiasVelocity);
            applyLinearImpulse(this, delta * a[0], delta * a[1], delta * a[2], this.armA, this.rB);
        }
        if (motor.enabled && motor.maxForce > 0) {
            const delta = solveMotor(this.motorImpulse, axialMass, relativeLinearSpeed(this, a, this.armA, this.rB), motor.targetVelocity, motor.maxForce * context.h);
            applyLinearImpulse(this, delta * a[0], delta * a[1], delta * a[2], this.armA, this.rB);
        }
        if (limits.enabled) {
            const lower = solveLowerLimit(this.lowerImpulse, axialMass, this.translation - limits.min, relativeLinearSpeed(this, a, this.armA, this.rB), context, useBias);
            applyLinearImpulse(this, lower * a[0], lower * a[1], lower * a[2], this.armA, this.rB);
            const upper = solveLowerLimit(this.upperImpulse, axialMass, limits.max - this.translation, -relativeLinearSpeed(this, a, this.armA, this.rB), context, useBias);
            applyLinearImpulse(this, -upper * a[0], -upper * a[1], -upper * a[2], this.armA, this.rB);
        }
        this.perpendicular.solve(this, this.perp1, this.perp2, this.delta, this.rA, this.rB, context.softness, useBias, context.maxBiasVelocity);
        this.lock.solve(this, this.rotationError(scratchError), context.softness, useBias, context.maxBiasVelocity);
    }
    protected collectReaction(force: Vec3, torque: Vec3): void {
        this.perpendicular.accumulated(force, this.perp1, this.perp2);
        const axial = this.axialImpulse();
        vec3.scaleAndAdd(force, force, this.axis, axial);
        vec3.copy(torque, this.lock.impulse);
        this.axialForce = axial;
    }
    protected finalizeJoint(context: JointSolverContext): void {
        this.updateFrame();
        this.coordinate = this.translation;
        this.speed = relativeLinearSpeed(this, this.axis, this.armA, this.rB);
        this.motorForce = this.motorImpulse.impulse * context.invH;
    }
}
