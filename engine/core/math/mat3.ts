import type { Vec3 } from './vec3';
import type { Quat } from './quat';
export type Mat3 = Float32Array;
export function create(): Mat3 {
    const out = new Float32Array(9);
    out[0] = 1;
    out[4] = 1;
    out[8] = 1;
    return out;
}
export function identity(out: Mat3): Mat3 {
    out.fill(0);
    out[0] = 1;
    out[4] = 1;
    out[8] = 1;
    return out;
}
export function copy(out: Mat3, a: Mat3): Mat3 {
    out.set(a);
    return out;
}
export function fromAxisAngle(out: Mat3, axis: Vec3, angle: number): Mat3 {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const t = 1 - c;
    const x = axis[0], y = axis[1], z = axis[2];
    out[0] = t * x * x + c;
    out[1] = t * x * y + s * z;
    out[2] = t * x * z - s * y;
    out[3] = t * x * y - s * z;
    out[4] = t * y * y + c;
    out[5] = t * y * z + s * x;
    out[6] = t * x * z + s * y;
    out[7] = t * y * z - s * x;
    out[8] = t * z * z + c;
    return out;
}
export function fromQuat(out: Mat3, q: Quat): Mat3 {
    const x = q[0], y = q[1], z = q[2], w = q[3];
    const xx = x * x, yy = y * y, zz = z * z;
    const xy = x * y, xz = x * z, yz = y * z;
    const wx = w * x, wy = w * y, wz = w * z;
    out[0] = 1 - 2 * (yy + zz);
    out[1] = 2 * (xy + wz);
    out[2] = 2 * (xz - wy);
    out[3] = 2 * (xy - wz);
    out[4] = 1 - 2 * (xx + zz);
    out[5] = 2 * (yz + wx);
    out[6] = 2 * (xz + wy);
    out[7] = 2 * (yz - wx);
    out[8] = 1 - 2 * (xx + yy);
    return out;
}
export function multiply(out: Mat3, a: Mat3, b: Mat3): Mat3 {
    const a00 = a[0], a10 = a[1], a20 = a[2];
    const a01 = a[3], a11 = a[4], a21 = a[5];
    const a02 = a[6], a12 = a[7], a22 = a[8];
    for (let col = 0; col < 3; col++) {
        const b0 = b[col * 3], b1 = b[col * 3 + 1], b2 = b[col * 3 + 2];
        out[col * 3] = a00 * b0 + a01 * b1 + a02 * b2;
        out[col * 3 + 1] = a10 * b0 + a11 * b1 + a12 * b2;
        out[col * 3 + 2] = a20 * b0 + a21 * b1 + a22 * b2;
    }
    return out;
}
export function transformVec3(out: Vec3, m: Mat3, v: Vec3): Vec3 {
    const x = v[0], y = v[1], z = v[2];
    out[0] = m[0] * x + m[3] * y + m[6] * z;
    out[1] = m[1] * x + m[4] * y + m[7] * z;
    out[2] = m[2] * x + m[5] * y + m[8] * z;
    return out;
}
export function transformVec3Transposed(out: Vec3, m: Mat3, v: Vec3): Vec3 {
    const x = v[0], y = v[1], z = v[2];
    out[0] = m[0] * x + m[1] * y + m[2] * z;
    out[1] = m[3] * x + m[4] * y + m[5] * z;
    out[2] = m[6] * x + m[7] * y + m[8] * z;
    return out;
}
export function getColumn(out: Vec3, m: Mat3, index: 0 | 1 | 2): Vec3 {
    out[0] = m[index * 3];
    out[1] = m[index * 3 + 1];
    out[2] = m[index * 3 + 2];
    return out;
}
export function rotateDiagonal(out: Mat3, rotation: Mat3, diagonal: Vec3): Mat3 {
    const r = rotation;
    const dx = diagonal[0], dy = diagonal[1], dz = diagonal[2];
    const m00 = r[0] * dx, m10 = r[1] * dx, m20 = r[2] * dx;
    const m01 = r[3] * dy, m11 = r[4] * dy, m21 = r[5] * dy;
    const m02 = r[6] * dz, m12 = r[7] * dz, m22 = r[8] * dz;
    out[0] = m00 * r[0] + m01 * r[3] + m02 * r[6];
    out[1] = m10 * r[0] + m11 * r[3] + m12 * r[6];
    out[2] = m20 * r[0] + m21 * r[3] + m22 * r[6];
    out[3] = m00 * r[1] + m01 * r[4] + m02 * r[7];
    out[4] = m10 * r[1] + m11 * r[4] + m12 * r[7];
    out[5] = m20 * r[1] + m21 * r[4] + m22 * r[7];
    out[6] = m00 * r[2] + m01 * r[5] + m02 * r[8];
    out[7] = m10 * r[2] + m11 * r[5] + m12 * r[8];
    out[8] = m20 * r[2] + m21 * r[5] + m22 * r[8];
    return out;
}
