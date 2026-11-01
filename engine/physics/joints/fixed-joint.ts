import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import { Joint } from './joint';
import { PointPart, RotationLockPart, type JointSolverContext } from './joint-math';
const scratchError = vec3.create();
const scratchDelta = vec3.create();
export class FixedJoint extends Joint {
    readonly type = 'fixed' as const;
    private readonly point = new PointPart();
    private readonly lock = new RotationLockPart();
    resetImpulses(): void {
        this.point.reset();
        this.lock.reset();
    }
    protected prepareJoint(): void { }
    protected warmStartJoint(): void {
        this.point.warmStart(this, this.rA, this.rB);
        this.lock.warmStart(this);
    }
    protected solveJoint(context: JointSolverContext, useBias: boolean): void {
        const softness = this.springActive ? this.springSoftness : context.softness;
        const useSoftness = this.springActive || useBias;
        this.point.solve(this, this.rA, this.rB, softness, useSoftness, context.maxBiasVelocity);
        this.lock.solve(this, this.rotationError(scratchError), softness, useSoftness, context.maxBiasVelocity);
    }
    protected collectReaction(force: Vec3, torque: Vec3): void {
        vec3.copy(force, this.point.impulse);
        vec3.copy(torque, this.lock.impulse);
        this.axialForce = 0;
    }
    protected finalizeJoint(): void {
        this.coordinate = vec3.length(this.anchorDelta(scratchDelta));
        this.speed = vec3.length(this.rotationError(scratchError));
    }
}
