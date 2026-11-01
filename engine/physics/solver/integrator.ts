import * as quat from '@/engine/core/math/quat';
import type { RigidBody } from '@/engine/physics/body/rigid-body';
import type { PhysicsSettings } from '@/engine/physics/world/physics-settings';
const MAX_ROTATION_PER_SUBSTEP = 0.25 * Math.PI;
export function integrateVelocities(bodies: readonly RigidBody[], settings: PhysicsSettings, h: number, invH: number): void {
    const gravity = settings.gravity;
    const maxAngularSpeed = MAX_ROTATION_PER_SUBSTEP * invH;
    for (const body of bodies) {
        const v = body.linearVelocity;
        const w = body.angularVelocity;
        const gravityScale = body.gravityScale * h;
        v[0] += gravity[0] * gravityScale;
        v[1] += gravity[1] * gravityScale;
        v[2] += gravity[2] * gravityScale;
        if (body.hasForces) {
            const f = body.force;
            const t = body.torque;
            const linear = body.invMass * h;
            v[0] += f[0] * linear;
            v[1] += f[1] * linear;
            v[2] += f[2] * linear;
            const m = body.invInertiaWorld;
            w[0] += (m[0] * t[0] + m[3] * t[1] + m[6] * t[2]) * h;
            w[1] += (m[1] * t[0] + m[4] * t[1] + m[7] * t[2]) * h;
            w[2] += (m[2] * t[0] + m[5] * t[1] + m[8] * t[2]) * h;
        }
        const linearDamping = 1 / (1 + h * body.linearDamping);
        const angularDamping = 1 / (1 + h * body.angularDamping);
        v[0] *= linearDamping;
        v[1] *= linearDamping;
        v[2] *= linearDamping;
        w[0] *= angularDamping;
        w[1] *= angularDamping;
        w[2] *= angularDamping;
        const maxLinearSpeed = Math.min(settings.maxLinearSpeed, body.maxExtent * invH);
        const speedSquared = v[0] * v[0] + v[1] * v[1] + v[2] * v[2];
        if (speedSquared > maxLinearSpeed * maxLinearSpeed) {
            const scale = maxLinearSpeed / Math.sqrt(speedSquared);
            v[0] *= scale;
            v[1] *= scale;
            v[2] *= scale;
        }
        const spinSquared = w[0] * w[0] + w[1] * w[1] + w[2] * w[2];
        if (spinSquared > maxAngularSpeed * maxAngularSpeed) {
            const scale = maxAngularSpeed / Math.sqrt(spinSquared);
            w[0] *= scale;
            w[1] *= scale;
            w[2] *= scale;
        }
    }
}
export function integratePositions(bodies: readonly RigidBody[], h: number): void {
    for (const body of bodies) {
        const v = body.linearVelocity;
        const position = body.position;
        const delta = body.deltaPosition;
        const dx = v[0] * h;
        const dy = v[1] * h;
        const dz = v[2] * h;
        position[0] += dx;
        position[1] += dy;
        position[2] += dz;
        delta[0] += dx;
        delta[1] += dy;
        delta[2] += dz;
        quat.integrate(body.orientation, body.orientation, body.angularVelocity, h);
        quat.integrate(body.deltaOrientation, body.deltaOrientation, body.angularVelocity, h);
        body.updateRotation();
    }
}
