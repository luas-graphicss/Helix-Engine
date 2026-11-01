import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import { Joint } from './joint';
import { ScalarImpulse, applyLinearImpulse, linearEffectiveMass, relativeLinearSpeed, solveEquality, solveLowerLimit, solveMotor, solveSpring, type JointSolverContext, } from './joint-math';
const MIN_LENGTH = 1e-6;
export class DistanceJoint extends Joint {
    readonly type = 'distance' as const;
    private readonly rigidImpulse = new ScalarImpulse();
    private readonly springImpulse = new ScalarImpulse();
    private readonly motorImpulse = new ScalarImpulse();
    private readonly lowerImpulse = new ScalarImpulse();
    private readonly upperImpulse = new ScalarImpulse();
    private readonly axis = vec3.create(0, 1, 0);
    private readonly delta = vec3.create();
    private length = 0;
    resetImpulses(): void {
        this.rigidImpulse.reset();
        this.springImpulse.reset();
        this.motorImpulse.reset();
        this.lowerImpulse.reset();
        this.upperImpulse.reset();
    }
    protected prepareJoint(): void { }
    private updateFrame(): void {
        this.anchorDelta(this.delta);
        this.length = vec3.length(this.delta);
        if (this.length > MIN_LENGTH)
            vec3.scale(this.axis, this.delta, 1 / this.length);
    }
    private get rigid(): boolean {
        const { spring, limits } = this.definition;
        if (limits.enabled)
            return limits.min >= limits.max;
        return !spring.enabled;
    }
    private axialImpulse(): number {
        return this.rigid ? this.rigidImpulse.impulse : this.springImpulse.impulse + this.motorImpulse.impulse + this.lowerImpulse.impulse - this.upperImpulse.impulse;
    }
    private applyAxial(delta: number): void {
        const a = this.axis;
        applyLinearImpulse(this, delta * a[0], delta * a[1], delta * a[2], this.rA, this.rB);
    }
    protected warmStartJoint(): void {
        this.updateFrame();
        this.applyAxial(this.axialImpulse());
    }
    protected solveJoint(context: JointSolverContext, useBias: boolean): void {
        this.updateFrame();
        const { limits, motor, length } = this.definition;
        const a = this.axis;
        const axialMass = linearEffectiveMass(this, a, this.rA, this.rB);
        if (this.rigid) {
            this.applyAxial(solveEquality(this.rigidImpulse, axialMass, this.length - length, relativeLinearSpeed(this, a, this.rA, this.rB), context, useBias));
            return;
        }
        if (this.springActive) {
            this.applyAxial(solveSpring(this.springImpulse, axialMass, this.length - length, relativeLinearSpeed(this, a, this.rA, this.rB), this.springSoftness, context.maxBiasVelocity));
        }
        if (motor.enabled && motor.maxForce > 0) {
            this.applyAxial(solveMotor(this.motorImpulse, axialMass, relativeLinearSpeed(this, a, this.rA, this.rB), motor.targetVelocity, motor.maxForce * context.h));
        }
        if (limits.enabled) {
            this.applyAxial(solveLowerLimit(this.lowerImpulse, axialMass, this.length - limits.min, relativeLinearSpeed(this, a, this.rA, this.rB), context, useBias));
            this.applyAxial(-solveLowerLimit(this.upperImpulse, axialMass, limits.max - this.length, -relativeLinearSpeed(this, a, this.rA, this.rB), context, useBias));
        }
    }
    protected collectReaction(force: Vec3, torque: Vec3): void {
        const axial = this.axialImpulse();
        vec3.scale(force, this.axis, axial);
        vec3.set(torque, 0, 0, 0);
        this.axialForce = axial;
    }
    protected finalizeJoint(context: JointSolverContext): void {
        this.updateFrame();
        this.coordinate = this.length;
        this.speed = relativeLinearSpeed(this, this.axis, this.rA, this.rB);
        this.motorForce = this.motorImpulse.impulse * context.invH;
    }
}
