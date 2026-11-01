import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import * as mat3 from '@/engine/core/math/mat3';
import type { Mat3 } from '@/engine/core/math/mat3';
import type { RigidBody } from '@/engine/physics/body/rigid-body';
import type { Softness } from '@/engine/physics/solver/soft-constraint';
export interface JointSolverContext {
    softness: Softness;
    h: number;
    invH: number;
    maxBiasVelocity: number;
    warmStarting: boolean;
}
export interface JointPair {
    readonly bodyA: RigidBody;
    readonly bodyB: RigidBody;
    mA: number;
    mB: number;
    IA: Mat3;
    IB: Mat3;
}
export class ScalarImpulse {
    impulse = 0;
    reset(): void {
        this.impulse = 0;
    }
}
export const ZERO_MAT3: Mat3 = new Float32Array(9);
const scratchK = mat3.create();
const scratchKinv = mat3.create();
const scratchRhs = vec3.create();
const scratchImpulse = vec3.create();
const scratchCross = vec3.create();
const scratchAxisA = vec3.create();
const scratchAxisB = vec3.create();
const scratchArmA = vec3.create();
function mulMat3(out: Vec3, m: Mat3, x: number, y: number, z: number): Vec3 {
    out[0] = m[0] * x + m[3] * y + m[6] * z;
    out[1] = m[1] * x + m[4] * y + m[7] * z;
    out[2] = m[2] * x + m[5] * y + m[8] * z;
    return out;
}
function quadraticForm(a: Vec3, m: Mat3, b: Vec3): number {
    const bx = m[0] * b[0] + m[3] * b[1] + m[6] * b[2];
    const by = m[1] * b[0] + m[4] * b[1] + m[7] * b[2];
    const bz = m[2] * b[0] + m[5] * b[1] + m[8] * b[2];
    return a[0] * bx + a[1] * by + a[2] * bz;
}
function clampBias(out: Vec3, maxBias: number): void {
    const length = Math.hypot(out[0], out[1], out[2]);
    if (length > maxBias && length > 0)
        vec3.scale(out, out, maxBias / length);
}
export function applyLinearImpulse(pair: JointPair, px: number, py: number, pz: number, armA: Vec3, armB: Vec3): void {
    const { bodyA, bodyB, mA, mB, IA, IB } = pair;
    if (mA > 0) {
        const v = bodyA.linearVelocity;
        v[0] -= mA * px;
        v[1] -= mA * py;
        v[2] -= mA * pz;
        const tx = armA[1] * pz - armA[2] * py;
        const ty = armA[2] * px - armA[0] * pz;
        const tz = armA[0] * py - armA[1] * px;
        const w = bodyA.angularVelocity;
        w[0] -= IA[0] * tx + IA[3] * ty + IA[6] * tz;
        w[1] -= IA[1] * tx + IA[4] * ty + IA[7] * tz;
        w[2] -= IA[2] * tx + IA[5] * ty + IA[8] * tz;
    }
    if (mB > 0) {
        const v = bodyB.linearVelocity;
        v[0] += mB * px;
        v[1] += mB * py;
        v[2] += mB * pz;
        const tx = armB[1] * pz - armB[2] * py;
        const ty = armB[2] * px - armB[0] * pz;
        const tz = armB[0] * py - armB[1] * px;
        const w = bodyB.angularVelocity;
        w[0] += IB[0] * tx + IB[3] * ty + IB[6] * tz;
        w[1] += IB[1] * tx + IB[4] * ty + IB[7] * tz;
        w[2] += IB[2] * tx + IB[5] * ty + IB[8] * tz;
    }
}
export function applyAngularImpulse(pair: JointPair, lx: number, ly: number, lz: number): void {
    const { bodyA, bodyB, mA, mB, IA, IB } = pair;
    if (mA > 0) {
        const w = bodyA.angularVelocity;
        w[0] -= IA[0] * lx + IA[3] * ly + IA[6] * lz;
        w[1] -= IA[1] * lx + IA[4] * ly + IA[7] * lz;
        w[2] -= IA[2] * lx + IA[5] * ly + IA[8] * lz;
    }
    if (mB > 0) {
        const w = bodyB.angularVelocity;
        w[0] += IB[0] * lx + IB[3] * ly + IB[6] * lz;
        w[1] += IB[1] * lx + IB[4] * ly + IB[7] * lz;
        w[2] += IB[2] * lx + IB[5] * ly + IB[8] * lz;
    }
}
export function angularEffectiveMass(pair: JointPair, axis: Vec3): number {
    const k = quadraticForm(axis, pair.IA, axis) + quadraticForm(axis, pair.IB, axis);
    return k > 0 ? 1 / k : 0;
}
export function relativeAngularSpeed(pair: JointPair, axis: Vec3): number {
    const wA = pair.bodyA.angularVelocity;
    const wB = pair.bodyB.angularVelocity;
    return (wB[0] - wA[0]) * axis[0] + (wB[1] - wA[1]) * axis[1] + (wB[2] - wA[2]) * axis[2];
}
export function linearEffectiveMass(pair: JointPair, axis: Vec3, armA: Vec3, armB: Vec3): number {
    let k = pair.mA + pair.mB;
    vec3.cross(scratchCross, armA, axis);
    k += quadraticForm(scratchCross, pair.IA, scratchCross);
    vec3.cross(scratchCross, armB, axis);
    k += quadraticForm(scratchCross, pair.IB, scratchCross);
    return k > 0 ? 1 / k : 0;
}
export function relativeLinearSpeed(pair: JointPair, axis: Vec3, armA: Vec3, armB: Vec3): number {
    const vA = pair.bodyA.linearVelocity;
    const vB = pair.bodyB.linearVelocity;
    const wA = pair.bodyA.angularVelocity;
    const wB = pair.bodyB.angularVelocity;
    let speed = axis[0] * (vB[0] - vA[0]) + axis[1] * (vB[1] - vA[1]) + axis[2] * (vB[2] - vA[2]);
    vec3.cross(scratchCross, armB, axis);
    speed += vec3.dot(wB, scratchCross);
    vec3.cross(scratchCross, armA, axis);
    speed -= vec3.dot(wA, scratchCross);
    return speed;
}
export function solveMotor(state: ScalarImpulse, effectiveMass: number, cdot: number, targetVelocity: number, maxImpulse: number): number {
    const impulse = -effectiveMass * (cdot - targetVelocity);
    const accumulated = Math.max(-maxImpulse, Math.min(state.impulse + impulse, maxImpulse));
    const delta = accumulated - state.impulse;
    state.impulse = accumulated;
    return delta;
}
export function solveLowerLimit(state: ScalarImpulse, effectiveMass: number, C: number, cdot: number, context: JointSolverContext, useBias: boolean): number {
    let bias = 0;
    let massScale = 1;
    let impulseScale = 0;
    if (C > 0) {
        bias = C * context.invH;
    }
    else if (useBias) {
        bias = Math.max(context.softness.biasRate * C, -context.maxBiasVelocity);
        massScale = context.softness.massScale;
        impulseScale = context.softness.impulseScale;
    }
    const impulse = -effectiveMass * massScale * (cdot + bias) - impulseScale * state.impulse;
    const accumulated = Math.max(state.impulse + impulse, 0);
    const delta = accumulated - state.impulse;
    state.impulse = accumulated;
    return delta;
}
export function solveEquality(state: ScalarImpulse, effectiveMass: number, C: number, cdot: number, context: JointSolverContext, useBias: boolean): number {
    let bias = 0;
    let massScale = 1;
    let impulseScale = 0;
    if (useBias) {
        const { softness, maxBiasVelocity } = context;
        bias = Math.max(-maxBiasVelocity, Math.min(softness.biasRate * C, maxBiasVelocity));
        massScale = softness.massScale;
        impulseScale = softness.impulseScale;
    }
    const impulse = -effectiveMass * massScale * (cdot + bias) - impulseScale * state.impulse;
    state.impulse += impulse;
    return impulse;
}
export function solveSpring(state: ScalarImpulse, effectiveMass: number, C: number, cdot: number, softness: Softness, maxBiasVelocity: number): number {
    const bias = Math.max(-maxBiasVelocity, Math.min(softness.biasRate * C, maxBiasVelocity));
    const impulse = -softness.massScale * effectiveMass * (cdot + bias) - softness.impulseScale * state.impulse;
    state.impulse += impulse;
    return impulse;
}
export class PointPart {
    readonly impulse = vec3.create();
    reset(): void {
        vec3.set(this.impulse, 0, 0, 0);
    }
    warmStart(pair: JointPair, rA: Vec3, rB: Vec3): void {
        const P = this.impulse;
        applyLinearImpulse(pair, P[0], P[1], P[2], rA, rB);
    }
    solve(pair: JointPair, rA: Vec3, rB: Vec3, softness: Softness, useSoftness: boolean, maxBias: number): void {
        const { bodyA, bodyB } = pair;
        const pA = bodyA.position;
        const pB = bodyB.position;
        const vA = bodyA.linearVelocity;
        const vB = bodyB.linearVelocity;
        const wA = bodyA.angularVelocity;
        const wB = bodyB.angularVelocity;
        const K = mat3.fromScalar(scratchK, pair.mA + pair.mB);
        mat3.subtractSkewSandwich(K, rA, pair.IA);
        mat3.subtractSkewSandwich(K, rB, pair.IB);
        if (!mat3.invert(scratchKinv, K))
            return;
        const rhs = scratchRhs;
        rhs[0] = vB[0] + (wB[1] * rB[2] - wB[2] * rB[1]) - vA[0] - (wA[1] * rA[2] - wA[2] * rA[1]);
        rhs[1] = vB[1] + (wB[2] * rB[0] - wB[0] * rB[2]) - vA[1] - (wA[2] * rA[0] - wA[0] * rA[2]);
        rhs[2] = vB[2] + (wB[0] * rB[1] - wB[1] * rB[0]) - vA[2] - (wA[0] * rA[1] - wA[1] * rA[0]);
        let massScale = 1;
        let impulseScale = 0;
        if (useSoftness) {
            const bias = scratchImpulse;
            bias[0] = (pB[0] + rB[0] - pA[0] - rA[0]) * softness.biasRate;
            bias[1] = (pB[1] + rB[1] - pA[1] - rA[1]) * softness.biasRate;
            bias[2] = (pB[2] + rB[2] - pA[2] - rA[2]) * softness.biasRate;
            clampBias(bias, maxBias);
            vec3.add(rhs, rhs, bias);
            massScale = softness.massScale;
            impulseScale = softness.impulseScale;
        }
        const P = mulMat3(scratchImpulse, scratchKinv, rhs[0], rhs[1], rhs[2]);
        const acc = this.impulse;
        P[0] = -massScale * P[0] - impulseScale * acc[0];
        P[1] = -massScale * P[1] - impulseScale * acc[1];
        P[2] = -massScale * P[2] - impulseScale * acc[2];
        vec3.add(acc, acc, P);
        applyLinearImpulse(pair, P[0], P[1], P[2], rA, rB);
    }
}
export class RotationLockPart {
    readonly impulse = vec3.create();
    reset(): void {
        vec3.set(this.impulse, 0, 0, 0);
    }
    warmStart(pair: JointPair): void {
        const L = this.impulse;
        applyAngularImpulse(pair, L[0], L[1], L[2]);
    }
    solve(pair: JointPair, error: Vec3, softness: Softness, useSoftness: boolean, maxBias: number): void {
        const K = mat3.add(scratchK, pair.IA, pair.IB);
        if (!mat3.invert(scratchKinv, K))
            return;
        const wA = pair.bodyA.angularVelocity;
        const wB = pair.bodyB.angularVelocity;
        const rhs = vec3.subtract(scratchRhs, wB, wA);
        let massScale = 1;
        let impulseScale = 0;
        if (useSoftness) {
            const bias = vec3.scale(scratchImpulse, error, softness.biasRate);
            clampBias(bias, maxBias);
            vec3.add(rhs, rhs, bias);
            massScale = softness.massScale;
            impulseScale = softness.impulseScale;
        }
        const L = mulMat3(scratchImpulse, scratchKinv, rhs[0], rhs[1], rhs[2]);
        const acc = this.impulse;
        L[0] = -massScale * L[0] - impulseScale * acc[0];
        L[1] = -massScale * L[1] - impulseScale * acc[1];
        L[2] = -massScale * L[2] - impulseScale * acc[2];
        vec3.add(acc, acc, L);
        applyAngularImpulse(pair, L[0], L[1], L[2]);
    }
}
function solve2x2(k11: number, k12: number, k22: number, b1: number, b2: number, out: Float32Array): boolean {
    const det = k11 * k22 - k12 * k12;
    if (!(Math.abs(det) > 1e-18))
        return false;
    const inv = 1 / det;
    out[0] = (k22 * b1 - k12 * b2) * inv;
    out[1] = (k11 * b2 - k12 * b1) * inv;
    return true;
}
const scratch2 = new Float32Array(2);
export class AxisAlignPart {
    impulse1 = 0;
    impulse2 = 0;
    private readonly u1 = vec3.create();
    private readonly u2 = vec3.create();
    reset(): void {
        this.impulse1 = 0;
        this.impulse2 = 0;
    }
    private updateAxes(axisB: Vec3, perp1: Vec3, perp2: Vec3): void {
        vec3.cross(this.u1, axisB, perp1);
        vec3.cross(this.u2, axisB, perp2);
    }
    warmStart(pair: JointPair, axisB: Vec3, perp1: Vec3, perp2: Vec3): void {
        this.updateAxes(axisB, perp1, perp2);
        const { u1, u2 } = this;
        applyAngularImpulse(pair, this.impulse1 * u1[0] + this.impulse2 * u2[0], this.impulse1 * u1[1] + this.impulse2 * u2[1], this.impulse1 * u1[2] + this.impulse2 * u2[2]);
    }
    solve(pair: JointPair, axisB: Vec3, perp1: Vec3, perp2: Vec3, softness: Softness, useSoftness: boolean, maxBias: number): void {
        this.updateAxes(axisB, perp1, perp2);
        const { u1, u2 } = this;
        const M1 = mulMat3(scratchAxisA, pair.IA, u1[0], u1[1], u1[2]);
        const M2 = mulMat3(scratchAxisB, pair.IB, u1[0], u1[1], u1[2]);
        const k11 = vec3.dot(u1, M1) + vec3.dot(u1, M2);
        const k12 = vec3.dot(u2, M1) + vec3.dot(u2, M2);
        const k22 = quadraticForm(u2, pair.IA, u2) + quadraticForm(u2, pair.IB, u2);
        const wA = pair.bodyA.angularVelocity;
        const wB = pair.bodyB.angularVelocity;
        const dwx = wB[0] - wA[0];
        const dwy = wB[1] - wA[1];
        const dwz = wB[2] - wA[2];
        let cdot1 = dwx * u1[0] + dwy * u1[1] + dwz * u1[2];
        let cdot2 = dwx * u2[0] + dwy * u2[1] + dwz * u2[2];
        let massScale = 1;
        let impulseScale = 0;
        if (useSoftness) {
            const c1 = vec3.dot(axisB, perp1);
            const c2 = vec3.dot(axisB, perp2);
            cdot1 += Math.max(-maxBias, Math.min(softness.biasRate * c1, maxBias));
            cdot2 += Math.max(-maxBias, Math.min(softness.biasRate * c2, maxBias));
            massScale = softness.massScale;
            impulseScale = softness.impulseScale;
        }
        if (!solve2x2(k11, k12, k22, cdot1, cdot2, scratch2))
            return;
        const d1 = -massScale * scratch2[0] - impulseScale * this.impulse1;
        const d2 = -massScale * scratch2[1] - impulseScale * this.impulse2;
        this.impulse1 += d1;
        this.impulse2 += d2;
        applyAngularImpulse(pair, d1 * u1[0] + d2 * u2[0], d1 * u1[1] + d2 * u2[1], d1 * u1[2] + d2 * u2[2]);
    }
    accumulated(out: Vec3): Vec3 {
        const { u1, u2 } = this;
        out[0] = this.impulse1 * u1[0] + this.impulse2 * u2[0];
        out[1] = this.impulse1 * u1[1] + this.impulse2 * u2[1];
        out[2] = this.impulse1 * u1[2] + this.impulse2 * u2[2];
        return out;
    }
}
export class PerpendicularPart {
    impulse1 = 0;
    impulse2 = 0;
    reset(): void {
        this.impulse1 = 0;
        this.impulse2 = 0;
    }
    warmStart(pair: JointPair, perp1: Vec3, perp2: Vec3, d: Vec3, rA: Vec3, rB: Vec3): void {
        const armA = vec3.add(scratchArmA, rA, d);
        applyLinearImpulse(pair, this.impulse1 * perp1[0] + this.impulse2 * perp2[0], this.impulse1 * perp1[1] + this.impulse2 * perp2[1], this.impulse1 * perp1[2] + this.impulse2 * perp2[2], armA, rB);
    }
    solve(pair: JointPair, perp1: Vec3, perp2: Vec3, d: Vec3, rA: Vec3, rB: Vec3, softness: Softness, useSoftness: boolean, maxBias: number): void {
        const armA = vec3.add(scratchArmA, rA, d);
        const { mA, mB, IA, IB } = pair;
        const a1 = vec3.cross(scratchAxisA, armA, perp1);
        const b1 = vec3.cross(scratchAxisB, rB, perp1);
        const a2 = vec3.cross(scratchCross, armA, perp2);
        const b2 = vec3.cross(scratchRhs, rB, perp2);
        const k11 = mA + mB + quadraticForm(a1, IA, a1) + quadraticForm(b1, IB, b1);
        const k12 = quadraticForm(a1, IA, a2) + quadraticForm(b1, IB, b2);
        const k22 = mA + mB + quadraticForm(a2, IA, a2) + quadraticForm(b2, IB, b2);
        const vA = pair.bodyA.linearVelocity;
        const vB = pair.bodyB.linearVelocity;
        const wA = pair.bodyA.angularVelocity;
        const wB = pair.bodyB.angularVelocity;
        const dvx = vB[0] - vA[0];
        const dvy = vB[1] - vA[1];
        const dvz = vB[2] - vA[2];
        let cdot1 = perp1[0] * dvx + perp1[1] * dvy + perp1[2] * dvz + vec3.dot(wB, b1) - vec3.dot(wA, a1);
        let cdot2 = perp2[0] * dvx + perp2[1] * dvy + perp2[2] * dvz + vec3.dot(wB, b2) - vec3.dot(wA, a2);
        let massScale = 1;
        let impulseScale = 0;
        if (useSoftness) {
            cdot1 += Math.max(-maxBias, Math.min(softness.biasRate * vec3.dot(d, perp1), maxBias));
            cdot2 += Math.max(-maxBias, Math.min(softness.biasRate * vec3.dot(d, perp2), maxBias));
            massScale = softness.massScale;
            impulseScale = softness.impulseScale;
        }
        if (!solve2x2(k11, k12, k22, cdot1, cdot2, scratch2))
            return;
        const d1 = -massScale * scratch2[0] - impulseScale * this.impulse1;
        const d2 = -massScale * scratch2[1] - impulseScale * this.impulse2;
        this.impulse1 += d1;
        this.impulse2 += d2;
        applyLinearImpulse(pair, d1 * perp1[0] + d2 * perp2[0], d1 * perp1[1] + d2 * perp2[1], d1 * perp1[2] + d2 * perp2[2], armA, rB);
    }
    accumulated(out: Vec3, perp1: Vec3, perp2: Vec3): Vec3 {
        out[0] = this.impulse1 * perp1[0] + this.impulse2 * perp2[0];
        out[1] = this.impulse1 * perp1[1] + this.impulse2 * perp2[1];
        out[2] = this.impulse1 * perp1[2] + this.impulse2 * perp2[2];
        return out;
    }
}
