import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import * as quat from '@/engine/core/math/quat';
import { tangentBasis } from '@/engine/physics/collision/closest-points';
import { Joint } from './joint';
import { AxisAlignPart, PointPart, ScalarImpulse, angularEffectiveMass, applyAngularImpulse, relativeAngularSpeed, solveLowerLimit, solveMotor, solveSpring, type JointSolverContext, } from './joint-math';
const scratchRelative = quat.create();
export class HingeJoint extends Joint {
    readonly type = 'hinge' as const;
    private readonly point = new PointPart();
    private readonly align = new AxisAlignPart();
    private readonly motorImpulse = new ScalarImpulse();
    private readonly lowerImpulse = new ScalarImpulse();
    private readonly upperImpulse = new ScalarImpulse();
    private readonly springImpulse = new ScalarImpulse();
    private readonly localPerp1 = vec3.create();
    private readonly localPerp2 = vec3.create();
    private readonly axisA = vec3.create();
    private readonly axisB = vec3.create();
    private readonly perp1 = vec3.create();
    private readonly perp2 = vec3.create();
    private angle = 0;
    resetImpulses(): void {
        this.point.reset();
        this.align.reset();
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
        quat.rotateVec3(this.axisA, qA, this.definition.localAxisA);
        quat.rotateVec3(this.axisB, this.bodyB.orientation, this.definition.localAxisB);
        quat.rotateVec3(this.perp1, qA, this.localPerp1);
        quat.rotateVec3(this.perp2, qA, this.localPerp2);
        this.angle = this.twistAngle(this.relativeRotation(scratchRelative), this.definition.localAxisA);
    }
    private axialImpulse(): number {
        return this.motorImpulse.impulse + this.lowerImpulse.impulse - this.upperImpulse.impulse + this.springImpulse.impulse;
    }
    protected warmStartJoint(): void {
        this.updateFrame();
        this.point.warmStart(this, this.rA, this.rB);
        this.align.warmStart(this, this.axisB, this.perp1, this.perp2);
        const axial = this.axialImpulse();
        const a = this.axisA;
        applyAngularImpulse(this, axial * a[0], axial * a[1], axial * a[2]);
    }
    protected solveJoint(context: JointSolverContext, useBias: boolean): void {
        this.updateFrame();
        const { limits, motor, spring } = this.definition;
        const a = this.axisA;
        const axialMass = angularEffectiveMass(this, a);
        if (this.springActive) {
            const delta = solveSpring(this.springImpulse, axialMass, this.angle - spring.target, relativeAngularSpeed(this, a), this.springSoftness, context.maxBiasVelocity);
            applyAngularImpulse(this, delta * a[0], delta * a[1], delta * a[2]);
        }
        if (motor.enabled && motor.maxForce > 0) {
            const delta = solveMotor(this.motorImpulse, axialMass, relativeAngularSpeed(this, a), motor.targetVelocity, motor.maxForce * context.h);
            applyAngularImpulse(this, delta * a[0], delta * a[1], delta * a[2]);
        }
        if (limits.enabled) {
            const lower = solveLowerLimit(this.lowerImpulse, axialMass, this.angle - limits.min, relativeAngularSpeed(this, a), context, useBias);
            applyAngularImpulse(this, lower * a[0], lower * a[1], lower * a[2]);
            const upper = solveLowerLimit(this.upperImpulse, axialMass, limits.max - this.angle, -relativeAngularSpeed(this, a), context, useBias);
            applyAngularImpulse(this, -upper * a[0], -upper * a[1], -upper * a[2]);
        }
        this.point.solve(this, this.rA, this.rB, context.softness, useBias, context.maxBiasVelocity);
        this.align.solve(this, this.axisB, this.perp1, this.perp2, context.softness, useBias, context.maxBiasVelocity);
    }
    protected collectReaction(force: Vec3, torque: Vec3): void {
        vec3.copy(force, this.point.impulse);
        this.align.accumulated(torque);
        vec3.scaleAndAdd(torque, torque, this.axisA, this.axialImpulse());
        this.axialForce = 0;
    }
    protected finalizeJoint(context: JointSolverContext): void {
        this.updateFrame();
        this.coordinate = this.angle;
        this.speed = relativeAngularSpeed(this, this.axisA);
        this.motorForce = this.motorImpulse.impulse * context.invH;
    }
}
