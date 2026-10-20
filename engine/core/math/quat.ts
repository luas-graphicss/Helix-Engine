import type { Vec3 } from './vec3';
import type { Mat4 } from './mat4';
import { clamp, DEG_TO_RAD, RAD_TO_DEG } from './scalar';
export type Quat = Float32Array;
export function create(): Quat {
    const out = new Float32Array(4);
    out[3] = 1;
    return out;
}
export function identity(out: Quat): Quat {
    out[0] = 0;
    out[1] = 0;
    out[2] = 0;
    out[3] = 1;
    return out;
}
export function set(out: Quat, x: number, y: number, z: number, w: number): Quat {
    out[0] = x;
    out[1] = y;
    out[2] = z;
    out[3] = w;
    return out;
}
export function copy(out: Quat, a: Quat): Quat {
    out[0] = a[0];
    out[1] = a[1];
    out[2] = a[2];
    out[3] = a[3];
    return out;
}
export function dot(a: Quat, b: Quat): number {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
}
export function normalize(out: Quat, a: Quat): Quat {
    const len = Math.hypot(a[0], a[1], a[2], a[3]);
    if (len === 0)
        return identity(out);
    const inv = 1 / len;
    out[0] = a[0] * inv;
    out[1] = a[1] * inv;
    out[2] = a[2] * inv;
    out[3] = a[3] * inv;
    return out;
}
export function conjugate(out: Quat, a: Quat): Quat {
    out[0] = -a[0];
    out[1] = -a[1];
    out[2] = -a[2];
    out[3] = a[3];
    return out;
}
export function multiply(out: Quat, a: Quat, b: Quat): Quat {
    const ax = a[0], ay = a[1], az = a[2], aw = a[3];
    const bx = b[0], by = b[1], bz = b[2], bw = b[3];
    out[0] = aw * bx + ax * bw + ay * bz - az * by;
    out[1] = aw * by + ay * bw + az * bx - ax * bz;
    out[2] = aw * bz + az * bw + ax * by - ay * bx;
    out[3] = aw * bw - ax * bx - ay * by - az * bz;
    return out;
}
export function fromAxisAngle(out: Quat, axis: Vec3, angle: number): Quat {
    const half = angle * 0.5;
    const s = Math.sin(half);
    out[0] = axis[0] * s;
    out[1] = axis[1] * s;
    out[2] = axis[2] * s;
    out[3] = Math.cos(half);
    return out;
}
export function fromEulerDegrees(out: Quat, rotationDegrees: Vec3): Quat {
    const hx = rotationDegrees[0] * DEG_TO_RAD * 0.5;
    const hy = rotationDegrees[1] * DEG_TO_RAD * 0.5;
    const hz = rotationDegrees[2] * DEG_TO_RAD * 0.5;
    const cx = Math.cos(hx), sx = Math.sin(hx);
    const cy = Math.cos(hy), sy = Math.sin(hy);
    const cz = Math.cos(hz), sz = Math.sin(hz);
    out[0] = sx * cy * cz - cx * sy * sz;
    out[1] = cx * sy * cz + sx * cy * sz;
    out[2] = cx * cy * sz - sx * sy * cz;
    out[3] = cx * cy * cz + sx * sy * sz;
    return out;
}
export function toEulerDegrees(out: Vec3, q: Quat): Vec3 {
    const x = q[0], y = q[1], z = q[2], w = q[3];
    const m00 = 1 - 2 * (y * y + z * z);
    const m10 = 2 * (x * y + w * z);
    const m20 = 2 * (x * z - w * y);
    const m21 = 2 * (y * z + w * x);
    const m22 = 1 - 2 * (x * x + y * y);
    const m11 = 1 - 2 * (x * x + z * z);
    const m12 = 2 * (y * z - w * x);
    const sinY = clamp(-m20, -1, 1);
    const ey = Math.asin(sinY);
    let ex: number;
    let ez: number;
    if (Math.abs(sinY) < 0.9999999) {
        ex = Math.atan2(m21, m22);
        ez = Math.atan2(m10, m00);
    }
    else {
        ex = Math.atan2(-m12, m11);
        ez = 0;
    }
    out[0] = ex * RAD_TO_DEG;
    out[1] = ey * RAD_TO_DEG;
    out[2] = ez * RAD_TO_DEG;
    return out;
}
export function fromMat4Rotation(out: Quat, m: Mat4): Quat {
    const sx = Math.hypot(m[0], m[1], m[2]) || 1;
    const sy = Math.hypot(m[4], m[5], m[6]) || 1;
    const sz = Math.hypot(m[8], m[9], m[10]) || 1;
    const m00 = m[0] / sx, m10 = m[1] / sx, m20 = m[2] / sx;
    const m01 = m[4] / sy, m11 = m[5] / sy, m21 = m[6] / sy;
    const m02 = m[8] / sz, m12 = m[9] / sz, m22 = m[10] / sz;
    const trace = m00 + m11 + m22;
    if (trace > 0) {
        const s = Math.sqrt(trace + 1) * 2;
        out[3] = 0.25 * s;
        out[0] = (m21 - m12) / s;
        out[1] = (m02 - m20) / s;
        out[2] = (m10 - m01) / s;
    }
    else if (m00 > m11 && m00 > m22) {
        const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
        out[3] = (m21 - m12) / s;
        out[0] = 0.25 * s;
        out[1] = (m01 + m10) / s;
        out[2] = (m02 + m20) / s;
    }
    else if (m11 > m22) {
        const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
        out[3] = (m02 - m20) / s;
        out[0] = (m01 + m10) / s;
        out[1] = 0.25 * s;
        out[2] = (m12 + m21) / s;
    }
    else {
        const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
        out[3] = (m10 - m01) / s;
        out[0] = (m02 + m20) / s;
        out[1] = (m12 + m21) / s;
        out[2] = 0.25 * s;
    }
    return normalize(out, out);
}
export function rotateVec3(out: Vec3, q: Quat, v: Vec3): Vec3 {
    const qx = q[0], qy = q[1], qz = q[2], qw = q[3];
    const vx = v[0], vy = v[1], vz = v[2];
    const tx = 2 * (qy * vz - qz * vy);
    const ty = 2 * (qz * vx - qx * vz);
    const tz = 2 * (qx * vy - qy * vx);
    out[0] = vx + qw * tx + (qy * tz - qz * ty);
    out[1] = vy + qw * ty + (qz * tx - qx * tz);
    out[2] = vz + qw * tz + (qx * ty - qy * tx);
    return out;
}
export function integrate(out: Quat, q: Quat, angularVelocity: Vec3, h: number): Quat {
    const qx = q[0], qy = q[1], qz = q[2], qw = q[3];
    const wx = angularVelocity[0] * h * 0.5;
    const wy = angularVelocity[1] * h * 0.5;
    const wz = angularVelocity[2] * h * 0.5;
    out[0] = qx + (wx * qw + wy * qz - wz * qy);
    out[1] = qy + (wy * qw + wz * qx - wx * qz);
    out[2] = qz + (wz * qw + wx * qy - wy * qx);
    out[3] = qw - (wx * qx + wy * qy + wz * qz);
    return normalize(out, out);
}
export function nlerp(out: Quat, a: Quat, b: Quat, t: number): Quat {
    const sign = dot(a, b) < 0 ? -1 : 1;
    out[0] = a[0] + (b[0] * sign - a[0]) * t;
    out[1] = a[1] + (b[1] * sign - a[1]) * t;
    out[2] = a[2] + (b[2] * sign - a[2]) * t;
    out[3] = a[3] + (b[3] * sign - a[3]) * t;
    return normalize(out, out);
}
