import type { Vec3 } from './vec3';
import type { Mat3 } from './mat3';
import { clamp, DEG_TO_RAD, RAD_TO_DEG } from './scalar';
const ZERO_VEC3 = new Float32Array(3);
const ONE_VEC3 = new Float32Array([1, 1, 1]);
export type Mat4 = Float32Array;
export function create(): Mat4 {
    const out = new Float32Array(16);
    out[0] = 1;
    out[5] = 1;
    out[10] = 1;
    out[15] = 1;
    return out;
}
export function identity(out: Mat4): Mat4 {
    out.fill(0);
    out[0] = 1;
    out[5] = 1;
    out[10] = 1;
    out[15] = 1;
    return out;
}
export function copy(out: Mat4, a: Mat4): Mat4 {
    out.set(a);
    return out;
}
export function multiply(out: Mat4, a: Mat4, b: Mat4): Mat4 {
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
    const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
    const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
    const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
    let b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3];
    out[0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
    b0 = b[4];
    b1 = b[5];
    b2 = b[6];
    b3 = b[7];
    out[4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[5] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[6] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[7] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
    b0 = b[8];
    b1 = b[9];
    b2 = b[10];
    b3 = b[11];
    out[8] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[9] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[10] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[11] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
    b0 = b[12];
    b1 = b[13];
    b2 = b[14];
    b3 = b[15];
    out[12] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[13] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[14] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[15] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
    return out;
}
export function perspective(out: Mat4, fovYRadians: number, aspect: number, near: number, far: number): Mat4 {
    const f = 1 / Math.tan(fovYRadians / 2);
    const nf = 1 / (near - far);
    out.fill(0);
    out[0] = f / aspect;
    out[5] = f;
    out[10] = (far + near) * nf;
    out[11] = -1;
    out[14] = 2 * far * near * nf;
    return out;
}
export function ortho(out: Mat4, left: number, right: number, bottom: number, top: number, near: number, far: number): Mat4 {
    const lr = 1 / (left - right);
    const bt = 1 / (bottom - top);
    const nf = 1 / (near - far);
    out.fill(0);
    out[0] = -2 * lr;
    out[5] = -2 * bt;
    out[10] = 2 * nf;
    out[12] = (left + right) * lr;
    out[13] = (top + bottom) * bt;
    out[14] = (far + near) * nf;
    out[15] = 1;
    return out;
}
export function lookAt(out: Mat4, eye: Vec3, target: Vec3, up: Vec3): Mat4 {
    let z0 = eye[0] - target[0];
    let z1 = eye[1] - target[1];
    let z2 = eye[2] - target[2];
    let len = Math.hypot(z0, z1, z2);
    if (len === 0) {
        z2 = 1;
    }
    else {
        len = 1 / len;
        z0 *= len;
        z1 *= len;
        z2 *= len;
    }
    let x0 = up[1] * z2 - up[2] * z1;
    let x1 = up[2] * z0 - up[0] * z2;
    let x2 = up[0] * z1 - up[1] * z0;
    len = Math.hypot(x0, x1, x2);
    if (len === 0) {
        x0 = 0;
        x1 = 0;
        x2 = 0;
    }
    else {
        len = 1 / len;
        x0 *= len;
        x1 *= len;
        x2 *= len;
    }
    const y0 = z1 * x2 - z2 * x1;
    const y1 = z2 * x0 - z0 * x2;
    const y2 = z0 * x1 - z1 * x0;
    out[0] = x0;
    out[1] = y0;
    out[2] = z0;
    out[3] = 0;
    out[4] = x1;
    out[5] = y1;
    out[6] = z1;
    out[7] = 0;
    out[8] = x2;
    out[9] = y2;
    out[10] = z2;
    out[11] = 0;
    out[12] = -(x0 * eye[0] + x1 * eye[1] + x2 * eye[2]);
    out[13] = -(y0 * eye[0] + y1 * eye[1] + y2 * eye[2]);
    out[14] = -(z0 * eye[0] + z1 * eye[1] + z2 * eye[2]);
    out[15] = 1;
    return out;
}
export function fromTranslationRotationScale(out: Mat4, translation: Vec3, rotationDegrees: Vec3, scale: Vec3): Mat4 {
    const rx = rotationDegrees[0] * DEG_TO_RAD;
    const ry = rotationDegrees[1] * DEG_TO_RAD;
    const rz = rotationDegrees[2] * DEG_TO_RAD;
    const cx = Math.cos(rx), sx = Math.sin(rx);
    const cy = Math.cos(ry), sy = Math.sin(ry);
    const cz = Math.cos(rz), sz = Math.sin(rz);
    const scx = scale[0], scy = scale[1], scz = scale[2];
    out[0] = cz * cy * scx;
    out[1] = sz * cy * scx;
    out[2] = -sy * scx;
    out[3] = 0;
    out[4] = (cz * sy * sx - sz * cx) * scy;
    out[5] = (sz * sy * sx + cz * cx) * scy;
    out[6] = cy * sx * scy;
    out[7] = 0;
    out[8] = (cz * sy * cx + sz * sx) * scz;
    out[9] = (sz * sy * cx - cz * sx) * scz;
    out[10] = cy * cx * scz;
    out[11] = 0;
    out[12] = translation[0];
    out[13] = translation[1];
    out[14] = translation[2];
    out[15] = 1;
    return out;
}
export function invert(out: Mat4, a: Mat4): Mat4 | null {
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
    const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
    const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
    const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
    const b00 = a00 * a11 - a01 * a10;
    const b01 = a00 * a12 - a02 * a10;
    const b02 = a00 * a13 - a03 * a10;
    const b03 = a01 * a12 - a02 * a11;
    const b04 = a01 * a13 - a03 * a11;
    const b05 = a02 * a13 - a03 * a12;
    const b06 = a20 * a31 - a21 * a30;
    const b07 = a20 * a32 - a22 * a30;
    const b08 = a20 * a33 - a23 * a30;
    const b09 = a21 * a32 - a22 * a31;
    const b10 = a21 * a33 - a23 * a31;
    const b11 = a22 * a33 - a23 * a32;
    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!det)
        return null;
    det = 1 / det;
    out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
    out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
    out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
    out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
    out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
    out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
    out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
    out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
    out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
    out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
    out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
    out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
    out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
    out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
    return out;
}
export function fromTranslationMat3Scale(out: Mat4, translation: Vec3, rotation: Mat3, scale: Vec3): Mat4 {
    const sx = scale[0], sy = scale[1], sz = scale[2];
    out[0] = rotation[0] * sx;
    out[1] = rotation[1] * sx;
    out[2] = rotation[2] * sx;
    out[3] = 0;
    out[4] = rotation[3] * sy;
    out[5] = rotation[4] * sy;
    out[6] = rotation[5] * sy;
    out[7] = 0;
    out[8] = rotation[6] * sz;
    out[9] = rotation[7] * sz;
    out[10] = rotation[8] * sz;
    out[11] = 0;
    out[12] = translation[0];
    out[13] = translation[1];
    out[14] = translation[2];
    out[15] = 1;
    return out;
}
export function fromAxisAngle(out: Mat4, axis: Vec3, angle: number): Mat4 {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const t = 1 - c;
    const x = axis[0], y = axis[1], z = axis[2];
    out[0] = t * x * x + c;
    out[1] = t * x * y + s * z;
    out[2] = t * x * z - s * y;
    out[3] = 0;
    out[4] = t * x * y - s * z;
    out[5] = t * y * y + c;
    out[6] = t * y * z + s * x;
    out[7] = 0;
    out[8] = t * x * z + s * y;
    out[9] = t * y * z - s * x;
    out[10] = t * z * z + c;
    out[11] = 0;
    out[12] = 0;
    out[13] = 0;
    out[14] = 0;
    out[15] = 1;
    return out;
}
export function normalMatrix(out: Mat3, a: Mat4): Mat3 | null {
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
    const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
    const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
    const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
    const b00 = a00 * a11 - a01 * a10;
    const b01 = a00 * a12 - a02 * a10;
    const b02 = a00 * a13 - a03 * a10;
    const b03 = a01 * a12 - a02 * a11;
    const b04 = a01 * a13 - a03 * a11;
    const b05 = a02 * a13 - a03 * a12;
    const b06 = a20 * a31 - a21 * a30;
    const b07 = a20 * a32 - a22 * a30;
    const b08 = a20 * a33 - a23 * a30;
    const b09 = a21 * a32 - a22 * a31;
    const b10 = a21 * a33 - a23 * a31;
    const b11 = a22 * a33 - a23 * a32;
    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!det)
        return null;
    det = 1 / det;
    out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
    out[1] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
    out[2] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
    out[3] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    out[4] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    out[5] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
    out[6] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
    out[7] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
    out[8] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
    return out;
}
export function fromRotationDegrees(out: Mat4, rotationDegrees: Vec3): Mat4 {
    return fromTranslationRotationScale(out, ZERO_VEC3, rotationDegrees, ONE_VEC3);
}
export function getTranslation(out: Vec3, m: Mat4): Vec3 {
    out[0] = m[12];
    out[1] = m[13];
    out[2] = m[14];
    return out;
}
export function maxAxisScale(m: Mat4): number {
    const x = Math.hypot(m[0], m[1], m[2]);
    const y = Math.hypot(m[4], m[5], m[6]);
    const z = Math.hypot(m[8], m[9], m[10]);
    return Math.max(x, y, z);
}
export function transformPoint(out: Vec3, m: Mat4, p: Vec3): Vec3 {
    const x = p[0], y = p[1], z = p[2];
    const w = m[3] * x + m[7] * y + m[11] * z + m[15] || 1;
    out[0] = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
    out[1] = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
    out[2] = (m[2] * x + m[6] * y + m[10] * z + m[14]) / w;
    return out;
}
export function transformDirection(out: Vec3, m: Mat4, d: Vec3): Vec3 {
    const x = d[0], y = d[1], z = d[2];
    out[0] = m[0] * x + m[4] * y + m[8] * z;
    out[1] = m[1] * x + m[5] * y + m[9] * z;
    out[2] = m[2] * x + m[6] * y + m[10] * z;
    return out;
}
export function decomposeTranslationRotationScale(outTranslation: Vec3, outRotationDegrees: Vec3, outScale: Vec3, m: Mat4): void {
    getTranslation(outTranslation, m);
    let sx = Math.hypot(m[0], m[1], m[2]);
    const sy = Math.hypot(m[4], m[5], m[6]);
    const sz = Math.hypot(m[8], m[9], m[10]);
    const det = m[0] * (m[5] * m[10] - m[6] * m[9]) - m[4] * (m[1] * m[10] - m[2] * m[9]) + m[8] * (m[1] * m[6] - m[2] * m[5]);
    if (det < 0)
        sx = -sx;
    outScale[0] = sx;
    outScale[1] = sy;
    outScale[2] = sz;
    const isx = sx ? 1 / sx : 0;
    const isy = sy ? 1 / sy : 0;
    const isz = sz ? 1 / sz : 0;
    const m00 = m[0] * isx, m10 = m[1] * isx, m20 = m[2] * isx;
    const m11 = m[5] * isy, m21 = m[6] * isy;
    const m12 = m[9] * isz, m22 = m[10] * isz;
    const sinY = clamp(-m20, -1, 1);
    const y = Math.asin(sinY);
    let x: number;
    let z: number;
    if (Math.abs(sinY) < 0.9999999) {
        x = Math.atan2(m21, m22);
        z = Math.atan2(m10, m00);
    }
    else {
        x = Math.atan2(-m12, m11);
        z = 0;
    }
    outRotationDegrees[0] = x * RAD_TO_DEG;
    outRotationDegrees[1] = y * RAD_TO_DEG;
    outRotationDegrees[2] = z * RAD_TO_DEG;
}
