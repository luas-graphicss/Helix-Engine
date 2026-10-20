import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import * as mat3 from '@/engine/core/math/mat3';
import type { Mat3 } from '@/engine/core/math/mat3';
import * as quat from '@/engine/core/math/quat';
import type { Manifold, ManifoldPoint } from '@/engine/physics/collision/manifold';
import { tangentBasis } from '@/engine/physics/collision/closest-points';
import type { Softness } from './soft-constraint';
export interface ContactSolverContext {
    contactSoftness: Softness;
    staticSoftness: Softness;
    linearSlop: number;
    maxPushVelocity: number;
    invH: number;
}
const rotatedAnchorA = vec3.create();
const rotatedAnchorB = vec3.create();
const relativeVelocity = vec3.create();
function angularMassTerm(invInertia: Mat3, r: Vec3, dx: number, dy: number, dz: number): number {
    const cx = r[1] * dz - r[2] * dy;
    const cy = r[2] * dx - r[0] * dz;
    const cz = r[0] * dy - r[1] * dx;
    const ix = invInertia[0] * cx + invInertia[3] * cy + invInertia[6] * cz;
    const iy = invInertia[1] * cx + invInertia[4] * cy + invInertia[7] * cz;
    const iz = invInertia[2] * cx + invInertia[5] * cy + invInertia[8] * cz;
    return cx * ix + cy * iy + cz * iz;
}
function applyImpulse(v: Vec3, w: Vec3, invMass: number, invInertia: Mat3, r: Vec3, px: number, py: number, pz: number, sign: 1 | -1): void {
    v[0] += sign * invMass * px;
    v[1] += sign * invMass * py;
    v[2] += sign * invMass * pz;
    const tx = r[1] * pz - r[2] * py;
    const ty = r[2] * px - r[0] * pz;
    const tz = r[0] * py - r[1] * px;
    w[0] += sign * (invInertia[0] * tx + invInertia[3] * ty + invInertia[6] * tz);
    w[1] += sign * (invInertia[1] * tx + invInertia[4] * ty + invInertia[7] * tz);
    w[2] += sign * (invInertia[2] * tx + invInertia[5] * ty + invInertia[8] * tz);
}
function pointRelativeVelocity(out: Vec3, manifold: Manifold, point: ManifoldPoint): Vec3 {
    const vA = manifold.bodyA.linearVelocity;
    const wA = manifold.bodyA.angularVelocity;
    const vB = manifold.bodyB.linearVelocity;
    const wB = manifold.bodyB.angularVelocity;
    const rA = point.anchorA;
    const rB = point.anchorB;
    out[0] = vB[0] + (wB[1] * rB[2] - wB[2] * rB[1]) - vA[0] - (wA[1] * rA[2] - wA[2] * rA[1]);
    out[1] = vB[1] + (wB[2] * rB[0] - wB[0] * rB[2]) - vA[1] - (wA[2] * rA[0] - wA[0] * rA[2]);
    out[2] = vB[2] + (wB[0] * rB[1] - wB[1] * rB[0]) - vA[2] - (wA[0] * rA[1] - wA[1] * rA[0]);
    return out;
}
function applyPointImpulse(manifold: Manifold, point: ManifoldPoint, px: number, py: number, pz: number): void {
    const { bodyA, bodyB } = manifold;
    applyImpulse(bodyA.linearVelocity, bodyA.angularVelocity, manifold.invMassA, manifold.invInertiaA, point.anchorA, px, py, pz, -1);
    applyImpulse(bodyB.linearVelocity, bodyB.angularVelocity, manifold.invMassB, manifold.invInertiaB, point.anchorB, px, py, pz, 1);
}
export function prepareContacts(manifolds: readonly Manifold[], context: ContactSolverContext): void {
    for (const manifold of manifolds) {
        const { bodyA, bodyB, normal, tangent1, tangent2 } = manifold;
        const simulatedA = bodyA.isSimulated;
        const simulatedB = bodyB.isSimulated;
        manifold.invMassA = simulatedA ? bodyA.invMass : 0;
        manifold.invMassB = simulatedB ? bodyB.invMass : 0;
        if (simulatedA)
            mat3.copy(manifold.invInertiaA, bodyA.invInertiaWorld);
        else
            manifold.invInertiaA.fill(0);
        if (simulatedB)
            mat3.copy(manifold.invInertiaB, bodyB.invInertiaWorld);
        else
            manifold.invInertiaB.fill(0);
        manifold.friction = Math.sqrt(bodyA.friction * bodyB.friction);
        manifold.restitution = Math.max(bodyA.restitution, bodyB.restitution);
        const softness = bodyA.isStatic || bodyB.isStatic ? context.staticSoftness : context.contactSoftness;
        manifold.biasRate = softness.biasRate;
        manifold.massScale = softness.massScale;
        manifold.impulseScale = softness.impulseScale;
        tangentBasis(tangent1, tangent2, normal);
        const mA = manifold.invMassA;
        const mB = manifold.invMassB;
        const IA = manifold.invInertiaA;
        const IB = manifold.invInertiaB;
        for (let i = 0; i < manifold.pointCount; i++) {
            const point = manifold.points[i];
            const rA = point.anchorA;
            const rB = point.anchorB;
            point.adjustedSeparation =
                point.separation - ((rB[0] - rA[0]) * normal[0] + (rB[1] - rA[1]) * normal[1] + (rB[2] - rA[2]) * normal[2]);
            const kNormal = mA + mB + angularMassTerm(IA, rA, normal[0], normal[1], normal[2]) + angularMassTerm(IB, rB, normal[0], normal[1], normal[2]);
            point.normalMass = kNormal > 0 ? 1 / kNormal : 0;
            const kTangent1 = mA + mB + angularMassTerm(IA, rA, tangent1[0], tangent1[1], tangent1[2]) + angularMassTerm(IB, rB, tangent1[0], tangent1[1], tangent1[2]);
            point.tangentMass1 = kTangent1 > 0 ? 1 / kTangent1 : 0;
            const kTangent2 = mA + mB + angularMassTerm(IA, rA, tangent2[0], tangent2[1], tangent2[2]) + angularMassTerm(IB, rB, tangent2[0], tangent2[1], tangent2[2]);
            point.tangentMass2 = kTangent2 > 0 ? 1 / kTangent2 : 0;
            pointRelativeVelocity(relativeVelocity, manifold, point);
            point.relativeVelocity = vec3.dot(relativeVelocity, normal);
            point.maxNormalImpulse = 0;
        }
    }
}
export function warmStartContacts(manifolds: readonly Manifold[]): void {
    for (const manifold of manifolds) {
        const { normal, tangent1, tangent2 } = manifold;
        for (let i = 0; i < manifold.pointCount; i++) {
            const point = manifold.points[i];
            const n = point.normalImpulse;
            const t1 = point.tangentImpulse1;
            const t2 = point.tangentImpulse2;
            applyPointImpulse(manifold, point, n * normal[0] + t1 * tangent1[0] + t2 * tangent2[0], n * normal[1] + t1 * tangent1[1] + t2 * tangent2[1], n * normal[2] + t1 * tangent1[2] + t2 * tangent2[2]);
        }
    }
}
export function solveContacts(manifolds: readonly Manifold[], context: ContactSolverContext, useBias: boolean): void {
    const { linearSlop, maxPushVelocity, invH } = context;
    for (const manifold of manifolds) {
        const { bodyA, bodyB, normal, tangent1, tangent2, friction } = manifold;
        const dpA = bodyA.deltaPosition;
        const dpB = bodyB.deltaPosition;
        for (let i = 0; i < manifold.pointCount; i++) {
            const point = manifold.points[i];
            quat.rotateVec3(rotatedAnchorA, bodyA.deltaOrientation, point.anchorA);
            quat.rotateVec3(rotatedAnchorB, bodyB.deltaOrientation, point.anchorB);
            const dx = dpB[0] - dpA[0] + rotatedAnchorB[0] - rotatedAnchorA[0];
            const dy = dpB[1] - dpA[1] + rotatedAnchorB[1] - rotatedAnchorA[1];
            const dz = dpB[2] - dpA[2] + rotatedAnchorB[2] - rotatedAnchorA[2];
            const separation = dx * normal[0] + dy * normal[1] + dz * normal[2] + point.adjustedSeparation;
            let bias = 0;
            let massScale = 1;
            let impulseScale = 0;
            if (separation > 0) {
                bias = separation * invH;
            }
            else if (useBias) {
                bias = Math.max(manifold.biasRate * Math.min(separation + linearSlop, 0), -maxPushVelocity);
                massScale = manifold.massScale;
                impulseScale = manifold.impulseScale;
            }
            pointRelativeVelocity(relativeVelocity, manifold, point);
            const normalVelocity = vec3.dot(relativeVelocity, normal);
            let impulse = -point.normalMass * massScale * (normalVelocity + bias) - impulseScale * point.normalImpulse;
            const accumulated = Math.max(point.normalImpulse + impulse, 0);
            impulse = accumulated - point.normalImpulse;
            point.normalImpulse = accumulated;
            if (impulse > point.maxNormalImpulse)
                point.maxNormalImpulse = impulse;
            applyPointImpulse(manifold, point, impulse * normal[0], impulse * normal[1], impulse * normal[2]);
        }
        for (let i = 0; i < manifold.pointCount; i++) {
            const point = manifold.points[i];
            pointRelativeVelocity(relativeVelocity, manifold, point);
            const tangentVelocity1 = vec3.dot(relativeVelocity, tangent1);
            const tangentVelocity2 = vec3.dot(relativeVelocity, tangent2);
            let impulse1 = point.tangentImpulse1 - point.tangentMass1 * tangentVelocity1;
            let impulse2 = point.tangentImpulse2 - point.tangentMass2 * tangentVelocity2;
            const maxFriction = friction * point.normalImpulse;
            const magnitudeSquared = impulse1 * impulse1 + impulse2 * impulse2;
            if (magnitudeSquared > maxFriction * maxFriction) {
                const scale = maxFriction / Math.sqrt(magnitudeSquared);
                impulse1 *= scale;
                impulse2 *= scale;
            }
            const delta1 = impulse1 - point.tangentImpulse1;
            const delta2 = impulse2 - point.tangentImpulse2;
            point.tangentImpulse1 = impulse1;
            point.tangentImpulse2 = impulse2;
            applyPointImpulse(manifold, point, delta1 * tangent1[0] + delta2 * tangent2[0], delta1 * tangent1[1] + delta2 * tangent2[1], delta1 * tangent1[2] + delta2 * tangent2[2]);
        }
    }
}
export function applyRestitution(manifolds: readonly Manifold[], threshold: number): void {
    for (const manifold of manifolds) {
        const { restitution, normal } = manifold;
        if (restitution === 0)
            continue;
        for (let i = 0; i < manifold.pointCount; i++) {
            const point = manifold.points[i];
            if (point.relativeVelocity > -threshold || point.maxNormalImpulse === 0)
                continue;
            pointRelativeVelocity(relativeVelocity, manifold, point);
            const normalVelocity = vec3.dot(relativeVelocity, normal);
            let impulse = -point.normalMass * (normalVelocity + restitution * point.relativeVelocity);
            const accumulated = Math.max(point.normalImpulse + impulse, 0);
            impulse = accumulated - point.normalImpulse;
            point.normalImpulse = accumulated;
            if (impulse > point.maxNormalImpulse)
                point.maxNormalImpulse = impulse;
            applyPointImpulse(manifold, point, impulse * normal[0], impulse * normal[1], impulse * normal[2]);
        }
    }
}
