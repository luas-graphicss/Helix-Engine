import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import { clamp } from '@/engine/core/math/scalar';
const EPSILON = 1e-8;
const d1 = vec3.create();
const d2 = vec3.create();
const r = vec3.create();
export function closestPointOnSegment(out: Vec3, a: Vec3, b: Vec3, p: Vec3): number {
    vec3.subtract(d1, b, a);
    const lengthSquared = vec3.dot(d1, d1);
    let t = 0;
    if (lengthSquared > EPSILON) {
        vec3.subtract(r, p, a);
        t = clamp(vec3.dot(r, d1) / lengthSquared, 0, 1);
    }
    vec3.scaleAndAdd(out, a, d1, t);
    return t;
}
export function closestPointsSegmentSegment(p1: Vec3, q1: Vec3, p2: Vec3, q2: Vec3, outC1: Vec3, outC2: Vec3): number {
    vec3.subtract(d1, q1, p1);
    vec3.subtract(d2, q2, p2);
    vec3.subtract(r, p1, p2);
    const a = vec3.dot(d1, d1);
    const e = vec3.dot(d2, d2);
    const f = vec3.dot(d2, r);
    let s = 0;
    let t = 0;
    if (a <= EPSILON && e <= EPSILON) {
        vec3.copy(outC1, p1);
        vec3.copy(outC2, p2);
        return vec3.distance(outC1, outC2) ** 2;
    }
    if (a <= EPSILON) {
        t = clamp(f / e, 0, 1);
    }
    else {
        const c = vec3.dot(d1, r);
        if (e <= EPSILON) {
            s = clamp(-c / a, 0, 1);
        }
        else {
            const b = vec3.dot(d1, d2);
            const denom = a * e - b * b;
            s = denom !== 0 ? clamp((b * f - c * e) / denom, 0, 1) : 0;
            t = (b * s + f) / e;
            if (t < 0) {
                t = 0;
                s = clamp(-c / a, 0, 1);
            }
            else if (t > 1) {
                t = 1;
                s = clamp((b - c) / a, 0, 1);
            }
        }
    }
    vec3.scaleAndAdd(outC1, p1, d1, s);
    vec3.scaleAndAdd(outC2, p2, d2, t);
    return vec3.distance(outC1, outC2) ** 2;
}
export function closestPointOnBoxSurface(outSurface: Vec3, outNormal: Vec3, point: Vec3, halfExtents: Vec3): number {
    const px = point[0], py = point[1], pz = point[2];
    const hx = halfExtents[0], hy = halfExtents[1], hz = halfExtents[2];
    const cx = clamp(px, -hx, hx);
    const cy = clamp(py, -hy, hy);
    const cz = clamp(pz, -hz, hz);
    const dx = px - cx;
    const dy = py - cy;
    const dz = pz - cz;
    const distanceSquared = dx * dx + dy * dy + dz * dz;
    if (distanceSquared > EPSILON) {
        const distance = Math.sqrt(distanceSquared);
        vec3.set(outSurface, cx, cy, cz);
        vec3.set(outNormal, dx / distance, dy / distance, dz / distance);
        return distance;
    }
    const gapX = hx - Math.abs(px);
    const gapY = hy - Math.abs(py);
    const gapZ = hz - Math.abs(pz);
    if (gapX <= gapY && gapX <= gapZ) {
        const sign = px >= 0 ? 1 : -1;
        vec3.set(outSurface, sign * hx, py, pz);
        vec3.set(outNormal, sign, 0, 0);
        return -gapX;
    }
    if (gapY <= gapZ) {
        const sign = py >= 0 ? 1 : -1;
        vec3.set(outSurface, px, sign * hy, pz);
        vec3.set(outNormal, 0, sign, 0);
        return -gapY;
    }
    const sign = pz >= 0 ? 1 : -1;
    vec3.set(outSurface, px, py, sign * hz);
    vec3.set(outNormal, 0, 0, sign);
    return -gapZ;
}
export function tangentBasis(outT1: Vec3, outT2: Vec3, normal: Vec3): void {
    if (Math.abs(normal[0]) >= 0.57735) {
        vec3.set(outT1, normal[1], -normal[0], 0);
    }
    else {
        vec3.set(outT1, 0, normal[2], -normal[1]);
    }
    vec3.normalize(outT1, outT1);
    vec3.cross(outT2, normal, outT1);
}
