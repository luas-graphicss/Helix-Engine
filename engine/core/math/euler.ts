import { RAD_TO_DEG } from './scalar';
import type { Vec3 } from './vec3';
const GIMBAL_LOCK_COS = 1e-6;
export function eulerDegreesFromRotation(out: Vec3, m00: number, m10: number, m20: number, m11: number, m21: number, m12: number, m22: number): Vec3 {
    const cosY = Math.hypot(m00, m10);
    const y = Math.atan2(-m20, cosY);
    let x: number;
    let z: number;
    if (cosY > GIMBAL_LOCK_COS) {
        x = Math.atan2(m21, m22);
        z = Math.atan2(m10, m00);
    }
    else {
        x = Math.atan2(-m12, m11);
        z = 0;
    }
    out[0] = x * RAD_TO_DEG;
    out[1] = y * RAD_TO_DEG;
    out[2] = z * RAD_TO_DEG;
    return out;
}
export function unwrapDegreesNear(degrees: number, reference: number): number {
    return degrees + Math.round((reference - degrees) / 360) * 360;
}
export function nearestEquivalentEuler(out: Vec3, euler: Vec3, reference: Vec3): Vec3 {
    const ax = unwrapDegreesNear(euler[0], reference[0]);
    const ay = unwrapDegreesNear(euler[1], reference[1]);
    const az = unwrapDegreesNear(euler[2], reference[2]);
    const bx = unwrapDegreesNear(euler[0] + 180, reference[0]);
    const by = unwrapDegreesNear(180 - euler[1], reference[1]);
    const bz = unwrapDegreesNear(euler[2] + 180, reference[2]);
    const distanceA = Math.abs(ax - reference[0]) + Math.abs(ay - reference[1]) + Math.abs(az - reference[2]);
    const distanceB = Math.abs(bx - reference[0]) + Math.abs(by - reference[1]) + Math.abs(bz - reference[2]);
    if (distanceB < distanceA) {
        out[0] = bx;
        out[1] = by;
        out[2] = bz;
    }
    else {
        out[0] = ax;
        out[1] = ay;
        out[2] = az;
    }
    return out;
}
