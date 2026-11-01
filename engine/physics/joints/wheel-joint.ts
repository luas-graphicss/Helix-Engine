import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import * as quat from '@/engine/core/math/quat';
import { Joint } from './joint';
import { AxisAlignPart, PerpendicularPart, ScalarImpulse, angularEffectiveMass, applyAngularImpulse, applyLinearImpulse, linearEffectiveMass, relativeAngularSpeed, relativeLinearSpeed, solveLowerLimit, solveMotor, solveSpring, type JointSolverContext, } from './joint-math';
export class WheelJoint extends Joint {
    readonly type = 'wheel' as const;
    private readonly perpendicular = new PerpendicularPart();
    private readonly align = new AxisAlignPart();
    private readonly springImpulse = new ScalarImpulse();
    private readonly lowerImpulse = new ScalarImpulse();
    private readonly upperImpulse = new ScalarImpulse();
    private readonly motorImpulse = new ScalarImpulse();
    private readonly brakeImpulse = new ScalarImpulse();
    private readonly localAxle = vec3.create();
    private readonly suspension = vec3.create();
    private readonly axleA = vec3.create();
    private readonly axleB = vec3.create();
    private readonly perp1 = vec3.create();
    private readonly perp2 = vec3.create();
    private readonly alignPerp2 = vec3.create();
    private readonly delta = vec3.create();
    private readonly armA = vec3.create();
    private translation = 0;
    resetImpulses(): void {
        this.perpendicular.reset();
        this.align.reset();
        this.springImpulse.reset();
        this.lowerImpulse.reset();
        this.upperImpulse.reset();
        this.motorImpulse.reset();
        this.brakeImpulse.reset();
    }
    protected prepareJoint(): void {
        const { localSecondaryA, localAxisA, steeringAngle } = this.definition;
        if (steeringAngle !== 0)
            vec3.rotateAroundAxis(this.localAxle, localSecondaryA, localAxisA, steeringAngle);
        else
            vec3.copy(this.localAxle, localSecondaryA);
    }
    private updateFrame(): void {
        const { localAxisA, localSecondaryA, localSecondaryB } = this.definition;
        const qA = this.bodyA.orientation;
        quat.rotateVec3(this.suspension, qA, localAxisA);
        quat.rotateVec3(this.axleA, qA, this.localAxle);
        quat.rotateVec3(this.axleB, this.bodyB.orientation, localSecondaryB);
        quat.rotateVec3(this.perp1, qA, localSecondaryA);
        vec3.cross(this.perp2, this.suspension, this.perp1);
        vec3.cross(this.alignPerp2, this.axleA, this.suspension);
        this.anchorDelta(this.delta);
        this.translation = vec3.dot(this.delta, this.suspension);
        vec3.add(this.armA, this.rA, this.delta);
    }
    private suspensionImpulse(): number {
        return this.springImpulse.impulse + this.lowerImpulse.impulse - this.upperImpulse.impulse;
    }
    private axleImpulse(): number {
        return this.motorImpulse.impulse + this.brakeImpulse.impulse;
    }
    protected warmStartJoint(): void {
        this.updateFrame();
        this.perpendicular.warmStart(this, this.perp1, this.perp2, this.delta, this.rA, this.rB);
        this.align.warmStart(this, this.axleB, this.suspension, this.alignPerp2);
        const s = this.suspension;
        const suspension = this.suspensionImpulse();
        applyLinearImpulse(this, suspension * s[0], suspension * s[1], suspension * s[2], this.armA, this.rB);
        const a = this.axleA;
        const axle = this.axleImpulse();
        applyAngularImpulse(this, axle * a[0], axle * a[1], axle * a[2]);
    }
    protected solveJoint(context: JointSolverContext, useBias: boolean): void {
        this.updateFrame();
        const { limits, motor, spring, brakeTorque } = this.definition;
        const s = this.suspension;
        const a = this.axleA;
        const suspensionMass = linearEffectiveMass(this, s, this.armA, this.rB);
        if (this.springActive) {
            const delta = solveSpring(this.springImpulse, suspensionMass, this.translation - spring.target, relativeLinearSpeed(this, s, this.armA, this.rB), this.springSoftness, context.maxBiasVelocity);
            applyLinearImpulse(this, delta * s[0], delta * s[1], delta * s[2], this.armA, this.rB);
        }
        const axleMass = angularEffectiveMass(this, a);
        if (motor.enabled && motor.maxForce > 0) {
            const delta = solveMotor(this.motorImpulse, axleMass, relativeAngularSpeed(this, a), motor.targetVelocity, motor.maxForce * context.h);
            applyAngularImpulse(this, delta * a[0], delta * a[1], delta * a[2]);
        }
        if (brakeTorque > 0) {
            const delta = solveMotor(this.brakeImpulse, axleMass, relativeAngularSpeed(this, a), 0, brakeTorque * context.h);
            applyAngularImpulse(this, delta * a[0], delta * a[1], delta * a[2]);
        }
        else {
            this.brakeImpulse.reset();
        }
        if (limits.enabled) {
            const lower = solveLowerLimit(this.lowerImpulse, suspensionMass, this.translation - limits.min, relativeLinearSpeed(this, s, this.armA, this.rB), context, useBias);
            applyLinearImpulse(this, lower * s[0], lower * s[1], lower * s[2], this.armA, this.rB);
            const upper = solveLowerLimit(this.upperImpulse, suspensionMass, limits.max - this.translation, -relativeLinearSpeed(this, s, this.armA, this.rB), context, useBias);
            applyLinearImpulse(this, -upper * s[0], -upper * s[1], -upper * s[2], this.armA, this.rB);
        }
        this.perpendicular.solve(this, this.perp1, this.perp2, this.delta, this.rA, this.rB, context.softness, useBias, context.maxBiasVelocity);
        this.align.solve(this, this.axleB, this.suspension, this.alignPerp2, context.softness, useBias, context.maxBiasVelocity);
    }
    protected collectReaction(force: Vec3, torque: Vec3): void {
        this.perpendicular.accumulated(force, this.perp1, this.perp2);
        const suspension = this.suspensionImpulse();
        vec3.scaleAndAdd(force, force, this.suspension, suspension);
        this.align.accumulated(torque);
        vec3.scaleAndAdd(torque, torque, this.axleA, this.axleImpulse());
        this.axialForce = suspension;
    }
    protected finalizeJoint(context: JointSolverContext): void {
        this.updateFrame();
        this.coordinate = this.translation;
        this.speed = relativeAngularSpeed(this, this.axleA);
        this.motorForce = this.motorImpulse.impulse * context.invH;
    }
}
