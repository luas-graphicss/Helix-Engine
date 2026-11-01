import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import * as quat from '@/engine/core/math/quat';
import { Joint } from './joint';
import { PointPart, ScalarImpulse, angularEffectiveMass, applyAngularImpulse, relativeAngularSpeed, solveLowerLimit, type JointSolverContext, } from './joint-math';
const scratchRelative = quat.create();
const MIN_SWING_SINE = 1e-6;
export class ConeTwistJoint extends Joint {
    readonly type = 'cone-twist' as const;
    private readonly point = new PointPart();
    private readonly swingImpulse = new ScalarImpulse();
    private readonly lowerImpulse = new ScalarImpulse();
    private readonly upperImpulse = new ScalarImpulse();
    private readonly axisA = vec3.create();
    private readonly axisB = vec3.create();
    private readonly swingAxis = vec3.create();
    private swingDefined = false;
    private swing = 0;
    private twist = 0;
    resetImpulses(): void {
        this.point.reset();
        this.swingImpulse.reset();
        this.lowerImpulse.reset();
        this.upperImpulse.reset();
    }
    protected prepareJoint(): void { }
    private updateFrame(): void {
        quat.rotateVec3(this.axisA, this.bodyA.orientation, this.definition.localAxisA);
        quat.rotateVec3(this.axisB, this.bodyB.orientation, this.definition.localAxisB);
        const cosine = Math.max(-1, Math.min(1, vec3.dot(this.axisA, this.axisB)));
        this.swing = Math.acos(cosine);
        vec3.cross(this.swingAxis, this.axisA, this.axisB);
        const sine = vec3.length(this.swingAxis);
        this.swingDefined = sine > MIN_SWING_SINE;
        if (this.swingDefined)
            vec3.scale(this.swingAxis, this.swingAxis, -1 / sine);
        this.twist = this.twistAngle(this.relativeRotation(scratchRelative), this.definition.localAxisA);
    }
    protected warmStartJoint(): void {
        this.updateFrame();
        this.point.warmStart(this, this.rA, this.rB);
        if (this.swingDefined) {
            const n = this.swingAxis;
            const swing = this.swingImpulse.impulse;
            applyAngularImpulse(this, swing * n[0], swing * n[1], swing * n[2]);
        }
        const twist = this.lowerImpulse.impulse - this.upperImpulse.impulse;
        const a = this.axisA;
        applyAngularImpulse(this, twist * a[0], twist * a[1], twist * a[2]);
    }
    protected solveJoint(context: JointSolverContext, useBias: boolean): void {
        this.updateFrame();
        const { limits, coneAngle } = this.definition;
        if (this.swingDefined) {
            const n = this.swingAxis;
            const delta = solveLowerLimit(this.swingImpulse, angularEffectiveMass(this, n), coneAngle - this.swing, relativeAngularSpeed(this, n), context, useBias);
            applyAngularImpulse(this, delta * n[0], delta * n[1], delta * n[2]);
        }
        else {
            this.swingImpulse.reset();
        }
        if (limits.enabled) {
            const a = this.axisA;
            const twistMass = angularEffectiveMass(this, a);
            const lower = solveLowerLimit(this.lowerImpulse, twistMass, this.twist - limits.min, relativeAngularSpeed(this, a), context, useBias);
            applyAngularImpulse(this, lower * a[0], lower * a[1], lower * a[2]);
            const upper = solveLowerLimit(this.upperImpulse, twistMass, limits.max - this.twist, -relativeAngularSpeed(this, a), context, useBias);
            applyAngularImpulse(this, -upper * a[0], -upper * a[1], -upper * a[2]);
        }
        this.point.solve(this, this.rA, this.rB, context.softness, useBias, context.maxBiasVelocity);
    }
    protected collectReaction(force: Vec3, torque: Vec3): void {
        vec3.copy(force, this.point.impulse);
        vec3.scale(torque, this.axisA, this.lowerImpulse.impulse - this.upperImpulse.impulse);
        if (this.swingDefined)
            vec3.scaleAndAdd(torque, torque, this.swingAxis, this.swingImpulse.impulse);
        this.axialForce = 0;
    }
    protected finalizeJoint(): void {
        this.updateFrame();
        this.coordinate = this.twist;
        this.speed = relativeAngularSpeed(this, this.axisA);
    }
    get swingAngle(): number {
        return this.swing;
    }
}
