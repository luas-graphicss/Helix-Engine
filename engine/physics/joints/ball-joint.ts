import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import { Joint } from './joint';
import { PointPart, type JointSolverContext } from './joint-math';
const scratchDelta = vec3.create();
export class BallJoint extends Joint {
    readonly type = 'ball' as const;
    private readonly point = new PointPart();
    resetImpulses(): void {
        this.point.reset();
    }
    protected prepareJoint(): void { }
    protected warmStartJoint(): void {
        this.point.warmStart(this, this.rA, this.rB);
    }
    protected solveJoint(context: JointSolverContext, useBias: boolean): void {
        this.point.solve(this, this.rA, this.rB, context.softness, useBias, context.maxBiasVelocity);
    }
    protected collectReaction(force: Vec3, torque: Vec3): void {
        vec3.copy(force, this.point.impulse);
        vec3.set(torque, 0, 0, 0);
        this.axialForce = 0;
    }
    protected finalizeJoint(): void {
        this.coordinate = vec3.length(this.anchorDelta(scratchDelta));
        this.speed = 0;
    }
}
