export type Vec3 = Float32Array;
export function create(x = 0, y = 0, z = 0): Vec3 {
    const out = new Float32Array(3);
    out[0] = x;
    out[1] = y;
    out[2] = z;
    return out;
}
export function set(out: Vec3, x: number, y: number, z: number): Vec3 {
    out[0] = x;
    out[1] = y;
    out[2] = z;
    return out;
}
export function copy(out: Vec3, a: Vec3): Vec3 {
    out[0] = a[0];
    out[1] = a[1];
    out[2] = a[2];
    return out;
}
export function add(out: Vec3, a: Vec3, b: Vec3): Vec3 {
    out[0] = a[0] + b[0];
    out[1] = a[1] + b[1];
    out[2] = a[2] + b[2];
    return out;
}
export function subtract(out: Vec3, a: Vec3, b: Vec3): Vec3 {
    out[0] = a[0] - b[0];
    out[1] = a[1] - b[1];
    out[2] = a[2] - b[2];
    return out;
}
export function scale(out: Vec3, a: Vec3, s: number): Vec3 {
    out[0] = a[0] * s;
    out[1] = a[1] * s;
    out[2] = a[2] * s;
    return out;
}
export function scaleAndAdd(out: Vec3, a: Vec3, b: Vec3, s: number): Vec3 {
    out[0] = a[0] + b[0] * s;
    out[1] = a[1] + b[1] * s;
    out[2] = a[2] + b[2] * s;
    return out;
}
export function dot(a: Vec3, b: Vec3): number {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
export function cross(out: Vec3, a: Vec3, b: Vec3): Vec3 {
    const ax = a[0];
    const ay = a[1];
    const az = a[2];
    const bx = b[0];
    const by = b[1];
    const bz = b[2];
    out[0] = ay * bz - az * by;
    out[1] = az * bx - ax * bz;
    out[2] = ax * by - ay * bx;
    return out;
}
export function length(a: Vec3): number {
    return Math.hypot(a[0], a[1], a[2]);
}
export function distance(a: Vec3, b: Vec3): number {
    return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}
export function rotateY(out: Vec3, a: Vec3, angle: number): Vec3 {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const x = a[0];
    const z = a[2];
    out[0] = x * c + z * s;
    out[1] = a[1];
    out[2] = -x * s + z * c;
    return out;
}
export function rotateAroundAxis(out: Vec3, a: Vec3, axis: Vec3, angle: number): Vec3 {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const k = dot(axis, a) * (1 - c);
    const ax = a[0], ay = a[1], az = a[2];
    const ux = axis[0], uy = axis[1], uz = axis[2];
    out[0] = ax * c + (uy * az - uz * ay) * s + ux * k;
    out[1] = ay * c + (uz * ax - ux * az) * s + uy * k;
    out[2] = az * c + (ux * ay - uy * ax) * s + uz * k;
    return out;
}
export function normalize(out: Vec3, a: Vec3): Vec3 {
    const len = length(a);
    if (len === 0) {
        out[0] = 0;
        out[1] = 0;
        out[2] = 0;
        return out;
    }
    const inv = 1 / len;
    out[0] = a[0] * inv;
    out[1] = a[1] * inv;
    out[2] = a[2] * inv;
    return out;
}
