import * as vec3 from '@/engine/core/math/vec3';
import * as quat from '@/engine/core/math/quat';
import * as mat4 from '@/engine/core/math/mat4';
import * as mat3 from '@/engine/core/math/mat3';
import * as aabb from '@/engine/core/math/aabb';
import { createRay, intersectRayAabb, transformRay, type Ray } from '@/engine/core/math/ray';
import { clamp, degToRad, lerp, radToDeg, DEG_TO_RAD, RAD_TO_DEG } from '@/engine/core/math/scalar';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { Quat } from '@/engine/core/math/quat';
import type { Mat4 } from '@/engine/core/math/mat4';
import type { Mat3 } from '@/engine/core/math/mat3';
import { perlin2, perlinFbm2 } from '@/engine/core/noise/perlin';
import { fbm3, ridgedFbm3, valueNoise3 } from '@/engine/core/noise/value-noise';
import { worley2, worley3 } from '@/engine/core/noise/worley';
import { hexToLinearRgb, linearRgbToCss, linearRgbToHex, linearToSrgb, srgbToLinear } from '@/engine/core/color/srgb';
import { temperatureToLinearRgb } from '@/engine/core/scene/light';
import { HelixArgumentError } from '../runtime/script-errors';
import { requireNumber, toLinearColor, toQuat, toVec3 } from '../runtime/values';
const M = 'helix.math';
function v(value: unknown, member: string): Vec3 {
    return toVec3(value, `${M}.${member}`);
}
function q(value: unknown, member: string): Quat {
    return toQuat(value, `${M}.${member}`);
}
function m4(value: unknown, member: string): Mat4 {
    if (value instanceof Float32Array && value.length === 16)
        return value;
    if (Array.isArray(value) && value.length === 16)
        return new Float32Array(value as number[]);
    throw new HelixArgumentError(`${M}.${member}`, 'esperava uma Mat4 (Float32Array de 16 elementos).');
}
function m3(value: unknown, member: string): Mat3 {
    if (value instanceof Float32Array && value.length === 9)
        return value;
    if (Array.isArray(value) && value.length === 9)
        return new Float32Array(value as number[]);
    throw new HelixArgumentError(`${M}.${member}`, 'esperava uma Mat3 (Float32Array de 9 elementos).');
}
function n(value: unknown, member: string, what = 'o número'): number {
    return requireNumber(value, `${M}.${member}`, what);
}
function seedOf(value: unknown, member: string): number {
    if (typeof value === 'string') {
        let hash = 0x811c9dc5;
        for (let index = 0; index < value.length; index++) {
            hash ^= value.charCodeAt(index);
            hash = Math.imul(hash, 0x01000193);
        }
        return hash >>> 0;
    }
    return n(value, member, 'a semente (número ou texto)');
}
function box(value: unknown, member: string): aabb.Aabb {
    const candidate = value as {
        min?: unknown;
        max?: unknown;
    };
    if (candidate && candidate.min !== undefined && candidate.max !== undefined)
        return { min: v(candidate.min, member), max: v(candidate.max, member) };
    throw new HelixArgumentError(`${M}.${member}`, 'esperava uma Aabb ({ min, max }).');
}
function ray(value: unknown, member: string): Ray {
    const candidate = value as {
        origin?: unknown;
        direction?: unknown;
    };
    if (candidate && candidate.origin !== undefined && candidate.direction !== undefined)
        return { origin: v(candidate.origin, member), direction: v(candidate.direction, member) };
    throw new HelixArgumentError(`${M}.${member}`, 'esperava um Ray ({ origin, direction }).');
}
function lookRotation(out: Quat, forward: Vec3, up: Vec3): Quat {
    const f = vec3.normalize(vec3.create(), forward);
    if (vec3.length(f) === 0)
        return quat.identity(out);
    const r = vec3.cross(vec3.create(), up, f);
    if (vec3.length(r) < 1e-6)
        vec3.cross(r, vec3.create(1, 0, 0), f);
    vec3.normalize(r, r);
    const u = vec3.cross(vec3.create(), f, r);
    const m = mat4.identity(mat4.create());
    m[0] = r[0];
    m[1] = r[1];
    m[2] = r[2];
    m[4] = u[0];
    m[5] = u[1];
    m[6] = u[2];
    m[8] = -f[0];
    m[9] = -f[1];
    m[10] = -f[2];
    return quat.fromMat4Rotation(out, m);
}
function slerp(out: Quat, a: Quat, b: Quat, t: number): Quat {
    let cosom = quat.dot(a, b);
    const bx = cosom < 0 ? -b[0] : b[0];
    const by = cosom < 0 ? -b[1] : b[1];
    const bz = cosom < 0 ? -b[2] : b[2];
    const bw = cosom < 0 ? -b[3] : b[3];
    if (cosom < 0)
        cosom = -cosom;
    let scale0: number;
    let scale1: number;
    if (1 - cosom > 1e-6) {
        const omega = Math.acos(cosom);
        const sinom = Math.sin(omega);
        scale0 = Math.sin((1 - t) * omega) / sinom;
        scale1 = Math.sin(t * omega) / sinom;
    }
    else {
        scale0 = 1 - t;
        scale1 = t;
    }
    return quat.set(out, scale0 * a[0] + scale1 * bx, scale0 * a[1] + scale1 * by, scale0 * a[2] + scale1 * bz, scale0 * a[3] + scale1 * bw);
}
export class SeededRandom {
    private state: number;
    constructor(seed = 0x9e3779b9) {
        this.state = seed >>> 0;
    }
    seed(value: number): void {
        this.state = (Math.floor(value) >>> 0) || 0x9e3779b9;
    }
    value(): number {
        let t = (this.state += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    range(min: number, max: number): number {
        return min + (max - min) * this.value();
    }
    int(min: number, max: number): number {
        const low = Math.ceil(Math.min(min, max));
        const high = Math.floor(Math.max(min, max));
        return low + Math.floor(this.value() * (high - low + 1));
    }
    gaussian(mean = 0, deviation = 1): number {
        let u = 0;
        let w = 0;
        while (u === 0)
            u = this.value();
        while (w === 0)
            w = this.value();
        return mean + deviation * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * w);
    }
    unitVector(out = vec3.create()): Vec3 {
        const z = this.range(-1, 1);
        const angle = this.range(0, Math.PI * 2);
        const r = Math.sqrt(Math.max(0, 1 - z * z));
        return vec3.set(out, r * Math.cos(angle), r * Math.sin(angle), z);
    }
}
export function createMathApi() {
    const random = new SeededRandom();
    const vec3Api = {
        create: (x = 0, y = 0, z = 0) => vec3.create(n(x, 'vec3.create'), n(y, 'vec3.create'), n(z, 'vec3.create')),
        from: (value: unknown) => v(value, 'vec3.from'),
        clone: (a: unknown) => vec3.copy(vec3.create(), v(a, 'vec3.clone')),
        copy: (out: unknown, a: unknown) => vec3.copy(v(out, 'vec3.copy'), v(a, 'vec3.copy')),
        set: (out: unknown, x: unknown, y: unknown, z: unknown) => vec3.set(v(out, 'vec3.set'), n(x, 'vec3.set'), n(y, 'vec3.set'), n(z, 'vec3.set')),
        add: (a: unknown, b: unknown) => vec3.add(vec3.create(), v(a, 'vec3.add'), v(b, 'vec3.add')),
        sub: (a: unknown, b: unknown) => vec3.subtract(vec3.create(), v(a, 'vec3.sub'), v(b, 'vec3.sub')),
        subtract: (a: unknown, b: unknown) => vec3.subtract(vec3.create(), v(a, 'vec3.subtract'), v(b, 'vec3.subtract')),
        scale: (a: unknown, s: unknown) => vec3.scale(vec3.create(), v(a, 'vec3.scale'), n(s, 'vec3.scale', 'o fator')),
        multiply: (a: unknown, b: unknown) => {
            const x = v(a, 'vec3.multiply');
            const y = v(b, 'vec3.multiply');
            return vec3.create(x[0] * y[0], x[1] * y[1], x[2] * y[2]);
        },
        scaleAndAdd: (a: unknown, b: unknown, s: unknown) => vec3.scaleAndAdd(vec3.create(), v(a, 'vec3.scaleAndAdd'), v(b, 'vec3.scaleAndAdd'), n(s, 'vec3.scaleAndAdd', 'o fator')),
        negate: (a: unknown) => vec3.scale(vec3.create(), v(a, 'vec3.negate'), -1),
        dot: (a: unknown, b: unknown) => vec3.dot(v(a, 'vec3.dot'), v(b, 'vec3.dot')),
        cross: (a: unknown, b: unknown) => vec3.cross(vec3.create(), v(a, 'vec3.cross'), v(b, 'vec3.cross')),
        length: (a: unknown) => vec3.length(v(a, 'vec3.length')),
        squaredLength: (a: unknown) => {
            const x = v(a, 'vec3.squaredLength');
            return x[0] * x[0] + x[1] * x[1] + x[2] * x[2];
        },
        normalize: (a: unknown) => vec3.normalize(vec3.create(), v(a, 'vec3.normalize')),
        lerp: (a: unknown, b: unknown, t: unknown) => {
            const x = v(a, 'vec3.lerp');
            const y = v(b, 'vec3.lerp');
            const k = n(t, 'vec3.lerp', 'o fator t');
            return vec3.create(lerp(x[0], y[0], k), lerp(x[1], y[1], k), lerp(x[2], y[2], k));
        },
        distance: (a: unknown, b: unknown) => vec3.distance(v(a, 'vec3.distance'), v(b, 'vec3.distance')),
        squaredDistance: (a: unknown, b: unknown) => {
            const x = v(a, 'vec3.squaredDistance');
            const y = v(b, 'vec3.squaredDistance');
            return (x[0] - y[0]) ** 2 + (x[1] - y[1]) ** 2 + (x[2] - y[2]) ** 2;
        },
        transformMat4: (a: unknown, m: unknown) => mat4.transformPoint(vec3.create(), m4(m, 'vec3.transformMat4'), v(a, 'vec3.transformMat4')),
        transformQuat: (a: unknown, r: unknown) => quat.rotateVec3(vec3.create(), q(r, 'vec3.transformQuat'), v(a, 'vec3.transformQuat')),
        transformDirection: (a: unknown, m: unknown) => mat4.transformDirection(vec3.create(), m4(m, 'vec3.transformDirection'), v(a, 'vec3.transformDirection')),
        rotateY: (a: unknown, radians: unknown) => vec3.rotateY(vec3.create(), v(a, 'vec3.rotateY'), n(radians, 'vec3.rotateY', 'o ângulo')),
        rotateAroundAxis: (a: unknown, axis: unknown, radians: unknown) => vec3.rotateAroundAxis(vec3.create(), v(a, 'vec3.rotateAroundAxis'), vec3.normalize(vec3.create(), v(axis, 'vec3.rotateAroundAxis')), n(radians, 'vec3.rotateAroundAxis', 'o ângulo')),
        min: (a: unknown, b: unknown) => {
            const x = v(a, 'vec3.min');
            const y = v(b, 'vec3.min');
            return vec3.create(Math.min(x[0], y[0]), Math.min(x[1], y[1]), Math.min(x[2], y[2]));
        },
        max: (a: unknown, b: unknown) => {
            const x = v(a, 'vec3.max');
            const y = v(b, 'vec3.max');
            return vec3.create(Math.max(x[0], y[0]), Math.max(x[1], y[1]), Math.max(x[2], y[2]));
        },
        abs: (a: unknown) => {
            const x = v(a, 'vec3.abs');
            return vec3.create(Math.abs(x[0]), Math.abs(x[1]), Math.abs(x[2]));
        },
        equals: (a: unknown, b: unknown, epsilon = 1e-6) => {
            const x = v(a, 'vec3.equals');
            const y = v(b, 'vec3.equals');
            return Math.abs(x[0] - y[0]) <= epsilon && Math.abs(x[1] - y[1]) <= epsilon && Math.abs(x[2] - y[2]) <= epsilon;
        },
        angle: (a: unknown, b: unknown) => {
            const x = vec3.normalize(vec3.create(), v(a, 'vec3.angle'));
            const y = vec3.normalize(vec3.create(), v(b, 'vec3.angle'));
            return radToDeg(Math.acos(clamp(vec3.dot(x, y), -1, 1)));
        },
        project: (a: unknown, onto: unknown) => {
            const x = v(a, 'vec3.project');
            const axis = v(onto, 'vec3.project');
            const denominator = vec3.dot(axis, axis);
            return denominator === 0 ? vec3.create() : vec3.scale(vec3.create(), axis, vec3.dot(x, axis) / denominator);
        },
        reflect: (a: unknown, normal: unknown) => {
            const x = v(a, 'vec3.reflect');
            const nrm = vec3.normalize(vec3.create(), v(normal, 'vec3.reflect'));
            return vec3.scaleAndAdd(vec3.create(), x, nrm, -2 * vec3.dot(x, nrm));
        },
        moveTowards: (a: unknown, b: unknown, maxDelta: unknown) => {
            const x = v(a, 'vec3.moveTowards');
            const y = v(b, 'vec3.moveTowards');
            const step = n(maxDelta, 'vec3.moveTowards', 'o passo máximo');
            const delta = vec3.subtract(vec3.create(), y, x);
            const distance = vec3.length(delta);
            if (distance <= step || distance === 0)
                return vec3.copy(vec3.create(), y);
            return vec3.scaleAndAdd(vec3.create(), x, delta, step / distance);
        },
        toArray: (a: unknown) => Array.from(v(a, 'vec3.toArray')),
        toObject: (a: unknown) => {
            const x = v(a, 'vec3.toObject');
            return { x: x[0], y: x[1], z: x[2] };
        },
        zero: () => vec3.create(),
        one: () => vec3.create(1, 1, 1),
        up: () => vec3.create(0, 1, 0),
        down: () => vec3.create(0, -1, 0),
        right: () => vec3.create(1, 0, 0),
        left: () => vec3.create(-1, 0, 0),
        forward: () => vec3.create(0, 0, -1),
        back: () => vec3.create(0, 0, 1),
    };
    const quatApi = {
        create: () => quat.create(),
        identity: () => quat.create(),
        from: (value: unknown) => q(value, 'quat.from'),
        clone: (a: unknown) => quat.copy(quat.create(), q(a, 'quat.clone')),
        set: (out: unknown, x: unknown, y: unknown, z: unknown, w: unknown) => quat.set(q(out, 'quat.set'), n(x, 'quat.set'), n(y, 'quat.set'), n(z, 'quat.set'), n(w, 'quat.set')),
        fromEuler: (eulerDegrees: unknown) => quat.fromEulerDegrees(quat.create(), v(eulerDegrees, 'quat.fromEuler')),
        toEuler: (a: unknown) => quat.toEulerDegrees(vec3.create(), q(a, 'quat.toEuler')),
        fromAxisAngle: (axis: unknown, degrees: unknown) => quat.fromAxisAngle(quat.create(), vec3.normalize(vec3.create(), v(axis, 'quat.fromAxisAngle')), degToRad(n(degrees, 'quat.fromAxisAngle', 'o ângulo em graus'))),
        fromMat4: (m: unknown) => quat.fromMat4Rotation(quat.create(), m4(m, 'quat.fromMat4')),
        multiply: (a: unknown, b: unknown) => quat.multiply(quat.create(), q(a, 'quat.multiply'), q(b, 'quat.multiply')),
        normalize: (a: unknown) => quat.normalize(quat.create(), q(a, 'quat.normalize')),
        conjugate: (a: unknown) => quat.conjugate(quat.create(), q(a, 'quat.conjugate')),
        inverse: (a: unknown) => quat.conjugate(quat.create(), quat.normalize(quat.create(), q(a, 'quat.inverse'))),
        dot: (a: unknown, b: unknown) => quat.dot(q(a, 'quat.dot'), q(b, 'quat.dot')),
        slerp: (a: unknown, b: unknown, t: unknown) => slerp(quat.create(), q(a, 'quat.slerp'), q(b, 'quat.slerp'), n(t, 'quat.slerp', 'o fator t')),
        nlerp: (a: unknown, b: unknown, t: unknown) => quat.nlerp(quat.create(), q(a, 'quat.nlerp'), q(b, 'quat.nlerp'), n(t, 'quat.nlerp', 'o fator t')),
        rotateVec3: (a: unknown, vector: unknown) => quat.rotateVec3(vec3.create(), q(a, 'quat.rotateVec3'), v(vector, 'quat.rotateVec3')),
        lookRotation: (forward: unknown, up: unknown = vec3.create(0, 1, 0)) => lookRotation(quat.create(), v(forward, 'quat.lookRotation'), v(up, 'quat.lookRotation')),
        angle: (a: unknown, b: unknown) => radToDeg(2 * Math.acos(clamp(Math.abs(quat.dot(quat.normalize(quat.create(), q(a, 'quat.angle')), quat.normalize(quat.create(), q(b, 'quat.angle')))), -1, 1))),
        toArray: (a: unknown) => Array.from(q(a, 'quat.toArray')),
    };
    const mat4Api = {
        create: () => mat4.create(),
        identity: () => mat4.identity(mat4.create()),
        clone: (a: unknown) => mat4.copy(mat4.create(), m4(a, 'mat4.clone')),
        copy: (out: unknown, a: unknown) => mat4.copy(m4(out, 'mat4.copy'), m4(a, 'mat4.copy')),
        multiply: (a: unknown, b: unknown) => mat4.multiply(mat4.create(), m4(a, 'mat4.multiply'), m4(b, 'mat4.multiply')),
        invert: (a: unknown) => mat4.invert(mat4.create(), m4(a, 'mat4.invert')),
        compose: (translation: unknown, rotation: unknown, scale: unknown) => {
            const r = rotation;
            const euler = r instanceof Float32Array && r.length === 4 ? quat.toEulerDegrees(vec3.create(), r) : Array.isArray(r) && r.length === 4 ? quat.toEulerDegrees(vec3.create(), q(r, 'mat4.compose')) : v(r, 'mat4.compose');
            return mat4.fromTranslationRotationScale(mat4.create(), v(translation, 'mat4.compose'), euler, v(scale, 'mat4.compose'));
        },
        fromTRS: (translation: unknown, rotationDegrees: unknown, scale: unknown) => mat4.fromTranslationRotationScale(mat4.create(), v(translation, 'mat4.fromTRS'), v(rotationDegrees, 'mat4.fromTRS'), v(scale, 'mat4.fromTRS')),
        decompose: (a: unknown) => {
            const translation = vec3.create();
            const rotation = vec3.create();
            const scale = vec3.create();
            mat4.decomposeTranslationRotationScale(translation, rotation, scale, m4(a, 'mat4.decompose'));
            return { translation, rotation, scale };
        },
        fromAxisAngle: (axis: unknown, degrees: unknown) => mat4.fromAxisAngle(mat4.create(), vec3.normalize(vec3.create(), v(axis, 'mat4.fromAxisAngle')), degToRad(n(degrees, 'mat4.fromAxisAngle', 'o ângulo'))),
        fromRotationDegrees: (euler: unknown) => mat4.fromRotationDegrees(mat4.create(), v(euler, 'mat4.fromRotationDegrees')),
        fromQuat: (rotation: unknown) => mat4.fromTranslationRotationScale(mat4.create(), vec3.create(), quat.toEulerDegrees(vec3.create(), q(rotation, 'mat4.fromQuat')), vec3.create(1, 1, 1)),
        getTranslation: (a: unknown) => mat4.getTranslation(vec3.create(), m4(a, 'mat4.getTranslation')),
        getRotation: (a: unknown) => quat.fromMat4Rotation(quat.create(), m4(a, 'mat4.getRotation')),
        getScale: (a: unknown) => {
            const m = m4(a, 'mat4.getScale');
            return vec3.create(Math.hypot(m[0], m[1], m[2]), Math.hypot(m[4], m[5], m[6]), Math.hypot(m[8], m[9], m[10]));
        },
        transformPoint: (a: unknown, point: unknown) => mat4.transformPoint(vec3.create(), m4(a, 'mat4.transformPoint'), v(point, 'mat4.transformPoint')),
        transformDirection: (a: unknown, direction: unknown) => mat4.transformDirection(vec3.create(), m4(a, 'mat4.transformDirection'), v(direction, 'mat4.transformDirection')),
        perspective: (fovDegrees: unknown, aspect: unknown, near: unknown, far: unknown) => mat4.perspective(mat4.create(), degToRad(n(fovDegrees, 'mat4.perspective', 'o campo de visão')), n(aspect, 'mat4.perspective', 'a proporção'), n(near, 'mat4.perspective', 'o plano próximo'), n(far, 'mat4.perspective', 'o plano distante')),
        ortho: (left: unknown, right: unknown, bottom: unknown, top: unknown, near: unknown, far: unknown) => mat4.ortho(mat4.create(), n(left, 'mat4.ortho'), n(right, 'mat4.ortho'), n(bottom, 'mat4.ortho'), n(top, 'mat4.ortho'), n(near, 'mat4.ortho'), n(far, 'mat4.ortho')),
        lookAt: (eye: unknown, target: unknown, up: unknown = vec3.create(0, 1, 0)) => mat4.lookAt(mat4.create(), v(eye, 'mat4.lookAt'), v(target, 'mat4.lookAt'), v(up, 'mat4.lookAt')),
        normalMatrix: (a: unknown) => mat4.normalMatrix(mat3.create(), m4(a, 'mat4.normalMatrix')),
        toArray: (a: unknown) => Array.from(m4(a, 'mat4.toArray')),
    };
    const mat3Api = {
        create: () => mat3.create(),
        identity: () => mat3.identity(mat3.create()),
        clone: (a: unknown) => mat3.copy(mat3.create(), m3(a, 'mat3.clone')),
        multiply: (a: unknown, b: unknown) => mat3.multiply(mat3.create(), m3(a, 'mat3.multiply'), m3(b, 'mat3.multiply')),
        fromQuat: (rotation: unknown) => mat3.fromQuat(mat3.create(), q(rotation, 'mat3.fromQuat')),
        fromAxisAngle: (axis: unknown, degrees: unknown) => mat3.fromAxisAngle(mat3.create(), vec3.normalize(vec3.create(), v(axis, 'mat3.fromAxisAngle')), degToRad(n(degrees, 'mat3.fromAxisAngle', 'o ângulo'))),
        transformVec3: (a: unknown, vector: unknown) => mat3.transformVec3(vec3.create(), m3(a, 'mat3.transformVec3'), v(vector, 'mat3.transformVec3')),
        invert: (a: unknown) => {
            const m = m3(a, 'mat3.invert');
            const big = mat4.identity(mat4.create());
            big[0] = m[0];
            big[1] = m[1];
            big[2] = m[2];
            big[4] = m[3];
            big[5] = m[4];
            big[6] = m[5];
            big[8] = m[6];
            big[9] = m[7];
            big[10] = m[8];
            const inverse = mat4.invert(mat4.create(), big);
            if (!inverse)
                return null;
            const out = mat3.create();
            out[0] = inverse[0];
            out[1] = inverse[1];
            out[2] = inverse[2];
            out[3] = inverse[4];
            out[4] = inverse[5];
            out[5] = inverse[6];
            out[6] = inverse[8];
            out[7] = inverse[9];
            out[8] = inverse[10];
            return out;
        },
        toArray: (a: unknown) => Array.from(m3(a, 'mat3.toArray')),
    };
    const aabbApi = {
        create: (min?: unknown, max?: unknown) => {
            const out = aabb.create();
            if (min !== undefined)
                vec3.copy(out.min, v(min, 'aabb.create'));
            if (max !== undefined)
                vec3.copy(out.max, v(max, 'aabb.create'));
            return out;
        },
        fromPoints: (points: unknown) => {
            if (!Array.isArray(points))
                throw new HelixArgumentError(`${M}.aabb.fromPoints`, 'esperava uma lista de pontos.');
            const out = aabb.create();
            for (const point of points) {
                const p = v(point, 'aabb.fromPoints');
                for (let axis = 0; axis < 3; axis++) {
                    out.min[axis] = Math.min(out.min[axis], p[axis]);
                    out.max[axis] = Math.max(out.max[axis], p[axis]);
                }
            }
            return out;
        },
        fromCenterSize: (center: unknown, size: unknown) => {
            const c = v(center, 'aabb.fromCenterSize');
            const s = v(size, 'aabb.fromCenterSize');
            return { min: vec3.create(c[0] - s[0] / 2, c[1] - s[1] / 2, c[2] - s[2] / 2), max: vec3.create(c[0] + s[0] / 2, c[1] + s[1] / 2, c[2] + s[2] / 2) };
        },
        isEmpty: (a: unknown) => aabb.isEmpty(box(a, 'aabb.isEmpty')),
        contains: (a: unknown, point: unknown) => {
            const b = box(a, 'aabb.contains');
            const p = v(point, 'aabb.contains');
            return p[0] >= b.min[0] && p[0] <= b.max[0] && p[1] >= b.min[1] && p[1] <= b.max[1] && p[2] >= b.min[2] && p[2] <= b.max[2];
        },
        intersects: (a: unknown, b: unknown) => aabb.intersects(box(a, 'aabb.intersects'), box(b, 'aabb.intersects')),
        union: (a: unknown, b: unknown) => aabb.union(aabb.create(), box(a, 'aabb.union'), box(b, 'aabb.union')),
        expand: (a: unknown, amount: unknown) => {
            const b = box(a, 'aabb.expand');
            const delta = typeof amount === 'number' ? vec3.create(amount, amount, amount) : v(amount, 'aabb.expand');
            return { min: vec3.subtract(vec3.create(), b.min, delta), max: vec3.add(vec3.create(), b.max, delta) };
        },
        expandByPoint: (a: unknown, point: unknown) => {
            const b = box(a, 'aabb.expandByPoint');
            const p = v(point, 'aabb.expandByPoint');
            const out = { min: vec3.copy(vec3.create(), b.min), max: vec3.copy(vec3.create(), b.max) };
            for (let axis = 0; axis < 3; axis++) {
                out.min[axis] = Math.min(out.min[axis], p[axis]);
                out.max[axis] = Math.max(out.max[axis], p[axis]);
            }
            return out;
        },
        center: (a: unknown) => aabb.center(vec3.create(), box(a, 'aabb.center')),
        size: (a: unknown) => {
            const b = box(a, 'aabb.size');
            return vec3.subtract(vec3.create(), b.max, b.min);
        },
        halfDiagonal: (a: unknown) => aabb.halfDiagonal(box(a, 'aabb.halfDiagonal')),
        distanceToPoint: (a: unknown, point: unknown) => aabb.distanceToPoint(box(a, 'aabb.distanceToPoint'), v(point, 'aabb.distanceToPoint')),
        transform: (a: unknown, matrix: unknown) => aabb.transform(aabb.create(), box(a, 'aabb.transform'), m4(matrix, 'aabb.transform')),
    };
    const rayApi = {
        create: (origin?: unknown, direction?: unknown) => {
            const out = createRay();
            if (origin !== undefined)
                vec3.copy(out.origin, v(origin, 'ray.create'));
            if (direction !== undefined)
                vec3.normalize(out.direction, v(direction, 'ray.create'));
            return out;
        },
        at: (r: unknown, t: unknown) => {
            const parsed = ray(r, 'ray.at');
            return vec3.scaleAndAdd(vec3.create(), parsed.origin, parsed.direction, n(t, 'ray.at', 'a distância t'));
        },
        transform: (r: unknown, matrix: unknown) => transformRay(createRay(), ray(r, 'ray.transform'), m4(matrix, 'ray.transform')),
        intersectAabb: (r: unknown, a: unknown) => intersectRayAabb(ray(r, 'ray.intersectAabb'), box(a, 'ray.intersectAabb')),
        intersectPlane: (r: unknown, planePoint: unknown, planeNormal: unknown) => {
            const parsed = ray(r, 'ray.intersectPlane');
            const point = v(planePoint, 'ray.intersectPlane');
            const normal = vec3.normalize(vec3.create(), v(planeNormal, 'ray.intersectPlane'));
            const denominator = vec3.dot(parsed.direction, normal);
            if (Math.abs(denominator) < 1e-8)
                return null;
            const t = vec3.dot(vec3.subtract(vec3.create(), point, parsed.origin), normal) / denominator;
            return t >= 0 ? t : null;
        },
        intersectSphere: (r: unknown, center: unknown, radius: unknown) => {
            const parsed = ray(r, 'ray.intersectSphere');
            const c = v(center, 'ray.intersectSphere');
            const rad = n(radius, 'ray.intersectSphere', 'o raio');
            const oc = vec3.subtract(vec3.create(), parsed.origin, c);
            const b = vec3.dot(oc, parsed.direction);
            const cc = vec3.dot(oc, oc) - rad * rad;
            const discriminant = b * b - cc;
            if (discriminant < 0)
                return null;
            const t = -b - Math.sqrt(discriminant);
            return t >= 0 ? t : -b + Math.sqrt(discriminant) >= 0 ? -b + Math.sqrt(discriminant) : null;
        },
    };
    const scalarApi = {
        clamp: (value: unknown, min: unknown, max: unknown) => clamp(n(value, 'scalar.clamp'), n(min, 'scalar.clamp'), n(max, 'scalar.clamp')),
        clamp01: (value: unknown) => clamp(n(value, 'scalar.clamp01'), 0, 1),
        lerp: (a: unknown, b: unknown, t: unknown) => lerp(n(a, 'scalar.lerp'), n(b, 'scalar.lerp'), n(t, 'scalar.lerp')),
        inverseLerp: (a: unknown, b: unknown, value: unknown) => {
            const start = n(a, 'scalar.inverseLerp');
            const end = n(b, 'scalar.inverseLerp');
            return end === start ? 0 : (n(value, 'scalar.inverseLerp') - start) / (end - start);
        },
        remap: (value: unknown, inMin: unknown, inMax: unknown, outMin: unknown, outMax: unknown) => {
            const a = n(inMin, 'scalar.remap');
            const b = n(inMax, 'scalar.remap');
            const t = b === a ? 0 : (n(value, 'scalar.remap') - a) / (b - a);
            return lerp(n(outMin, 'scalar.remap'), n(outMax, 'scalar.remap'), t);
        },
        smoothstep: (edge0: unknown, edge1: unknown, value: unknown) => {
            const a = n(edge0, 'scalar.smoothstep');
            const b = n(edge1, 'scalar.smoothstep');
            const t = clamp(b === a ? 0 : (n(value, 'scalar.smoothstep') - a) / (b - a), 0, 1);
            return t * t * (3 - 2 * t);
        },
        damp: (current: unknown, target: unknown, lambda: unknown, dt: unknown) => {
            const a = n(current, 'scalar.damp');
            const b = n(target, 'scalar.damp');
            return lerp(a, b, 1 - Math.exp(-n(lambda, 'scalar.damp', 'a constante') * n(dt, 'scalar.damp', 'o delta')));
        },
        wrap: (value: unknown, min: unknown, max: unknown) => {
            const a = n(min, 'scalar.wrap');
            const b = n(max, 'scalar.wrap');
            const range = b - a;
            if (range <= 0)
                return a;
            const x = n(value, 'scalar.wrap');
            return a + ((((x - a) % range) + range) % range);
        },
        wrapAngle: (degrees: unknown) => {
            const x = n(degrees, 'scalar.wrapAngle');
            return ((((x + 180) % 360) + 360) % 360) - 180;
        },
        deltaAngle: (from: unknown, to: unknown) => {
            let delta = (n(to, 'scalar.deltaAngle') - n(from, 'scalar.deltaAngle')) % 360;
            if (delta > 180)
                delta -= 360;
            if (delta < -180)
                delta += 360;
            return delta;
        },
        degToRad: (degrees: unknown) => degToRad(n(degrees, 'scalar.degToRad')),
        radToDeg: (radians: unknown) => radToDeg(n(radians, 'scalar.radToDeg')),
        sign: (value: unknown) => Math.sign(n(value, 'scalar.sign')),
        approximately: (a: unknown, b: unknown, epsilon = 1e-6) => Math.abs(n(a, 'scalar.approximately') - n(b, 'scalar.approximately')) <= epsilon,
        pingPong: (value: unknown, length: unknown) => {
            const l = n(length, 'scalar.pingPong');
            const t = ((n(value, 'scalar.pingPong') % (l * 2)) + l * 2) % (l * 2);
            return l - Math.abs(t - l);
        },
        DEG_TO_RAD,
        RAD_TO_DEG,
        EPSILON: 1e-6,
        TAU: Math.PI * 2,
    };
    const noiseApi = {
        perlin2: (x: unknown, y: unknown, period = 256, seed = 0) => perlin2(n(x, 'noise.perlin2'), n(y, 'noise.perlin2'), n(period, 'noise.perlin2'), n(seed, 'noise.perlin2')),
        perlin3: (x: unknown, y: unknown, z: unknown, seed = 0) => valueNoise3(n(x, 'noise.perlin3'), n(y, 'noise.perlin3'), n(z, 'noise.perlin3'), n(seed, 'noise.perlin3')),
        value2: (x: unknown, y: unknown, seed = 0) => valueNoise3(n(x, 'noise.value2'), n(y, 'noise.value2'), 0, n(seed, 'noise.value2')),
        value3: (x: unknown, y: unknown, z: unknown, seed = 0) => valueNoise3(n(x, 'noise.value3'), n(y, 'noise.value3'), n(z, 'noise.value3'), n(seed, 'noise.value3')),
        worley2: (x: unknown, y: unknown, cells = 8, seed = 0) => worley2(n(x, 'noise.worley2'), n(y, 'noise.worley2'), n(cells, 'noise.worley2'), n(seed, 'noise.worley2')),
        worley3: (x: unknown, y: unknown, z: unknown, cells = 8, seed = 0) => worley3(n(x, 'noise.worley3'), n(y, 'noise.worley3'), n(z, 'noise.worley3'), n(cells, 'noise.worley3'), n(seed, 'noise.worley3')),
        fbm: (x: unknown, y: unknown, z = 0, octaves = 4, seed = 0, gain = 0.5) => fbm3(n(x, 'noise.fbm'), n(y, 'noise.fbm'), n(z, 'noise.fbm'), Math.max(1, Math.floor(n(octaves, 'noise.fbm'))), n(seed, 'noise.fbm'), n(gain, 'noise.fbm')),
        fbm2: (x: unknown, y: unknown, period = 256, octaves = 4, seed = 0) => perlinFbm2(n(x, 'noise.fbm2'), n(y, 'noise.fbm2'), n(period, 'noise.fbm2'), Math.max(1, Math.floor(n(octaves, 'noise.fbm2'))), n(seed, 'noise.fbm2')),
        ridged: (x: unknown, y: unknown, z = 0, octaves = 4, seed = 0) => ridgedFbm3(n(x, 'noise.ridged'), n(y, 'noise.ridged'), n(z, 'noise.ridged'), Math.max(1, Math.floor(n(octaves, 'noise.ridged'))), n(seed, 'noise.ridged')),
    };
    const colorApi = {
        srgbToLinear: (channel: unknown) => srgbToLinear(n(channel, 'color.srgbToLinear')),
        linearToSrgb: (channel: unknown) => linearToSrgb(n(channel, 'color.linearToSrgb')),
        hexToVec3: (hex: unknown) => hexToLinearRgb(vec3.create(), String(hex)),
        vec3ToHex: (rgb: unknown) => linearRgbToHex(v(rgb, 'color.vec3ToHex')),
        vec3ToCss: (rgb: unknown) => linearRgbToCss(v(rgb, 'color.vec3ToCss')),
        parse: (value: unknown) => toLinearColor(value, `${M}.color.parse`),
        temperatureToColor: (kelvin: unknown) => temperatureToLinearRgb(vec3.create(), n(kelvin, 'color.temperatureToColor', 'a temperatura em Kelvin')),
        lerp: (a: unknown, b: unknown, t: unknown) => vec3Api.lerp(toLinearColor(a, `${M}.color.lerp`), toLinearColor(b, `${M}.color.lerp`), t),
        luminance: (rgb: unknown) => {
            const c = v(rgb, 'color.luminance');
            return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
        },
        rgb: (r: unknown, g: unknown, b: unknown) => vec3.create(srgbToLinear(n(r, 'color.rgb') / 255), srgbToLinear(n(g, 'color.rgb') / 255), srgbToLinear(n(b, 'color.rgb') / 255)),
        hsl: (h: unknown, s: unknown, l: unknown) => {
            const hue = ((n(h, 'color.hsl') % 360) + 360) % 360;
            const sat = clamp(n(s, 'color.hsl'), 0, 1);
            const light = clamp(n(l, 'color.hsl'), 0, 1);
            const c = (1 - Math.abs(2 * light - 1)) * sat;
            const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
            const m = light - c / 2;
            const [r, g, b] = hue < 60 ? [c, x, 0] : hue < 120 ? [x, c, 0] : hue < 180 ? [0, c, x] : hue < 240 ? [0, x, c] : hue < 300 ? [x, 0, c] : [c, 0, x];
            return vec3.create(srgbToLinear(r + m), srgbToLinear(g + m), srgbToLinear(b + m));
        },
    };
    const randomApi = {
        seed: (value: unknown) => random.seed(seedOf(value, 'random.seed')),
        value: () => random.value(),
        range: (min: unknown, max: unknown) => random.range(n(min, 'random.range'), n(max, 'random.range')),
        int: (min: unknown, max: unknown) => random.int(n(min, 'random.int'), n(max, 'random.int')),
        bool: (probability = 0.5) => random.value() < n(probability, 'random.bool'),
        pick: <T>(list: unknown): T | undefined => {
            if (!Array.isArray(list))
                throw new HelixArgumentError(`${M}.random.pick`, 'esperava uma lista.');
            return list.length === 0 ? undefined : (list[Math.floor(random.value() * list.length)] as T);
        },
        shuffle: <T>(list: unknown): T[] => {
            if (!Array.isArray(list))
                throw new HelixArgumentError(`${M}.random.shuffle`, 'esperava uma lista.');
            const copy = list.slice() as T[];
            for (let index = copy.length - 1; index > 0; index--) {
                const swap = Math.floor(random.value() * (index + 1));
                [copy[index], copy[swap]] = [copy[swap], copy[index]];
            }
            return copy;
        },
        gaussian: (mean = 0, deviation = 1) => random.gaussian(n(mean, 'random.gaussian'), n(deviation, 'random.gaussian')),
        unitVector: () => random.unitVector(),
        insideSphere: (radius = 1) => vec3.scale(vec3.create(), random.unitVector(), Math.cbrt(random.value()) * n(radius, 'random.insideSphere')),
        onCircle: (radius = 1) => {
            const angle = random.range(0, Math.PI * 2);
            const r = n(radius, 'random.onCircle');
            return vec3.create(Math.cos(angle) * r, 0, Math.sin(angle) * r);
        },
        color: () => vec3.create(random.value(), random.value(), random.value()),
        create: (seed: unknown) => {
            const generator = new SeededRandom(seedOf(seed, 'random.create'));
            return {
                seed: (value: unknown) => generator.seed(seedOf(value, 'random.seed')),
                value: () => generator.value(),
                range: (min: unknown, max: unknown) => generator.range(n(min, 'random.range'), n(max, 'random.range')),
                int: (min: unknown, max: unknown) => generator.int(n(min, 'random.int'), n(max, 'random.int')),
                gaussian: (mean = 0, deviation = 1) => generator.gaussian(n(mean, 'random.gaussian'), n(deviation, 'random.gaussian')),
                unitVector: () => generator.unitVector(),
                pick: <T>(list: T[]): T | undefined => (list.length === 0 ? undefined : list[Math.floor(generator.value() * list.length)]),
            };
        },
    };
    return {
        vec3: vec3Api,
        quat: quatApi,
        mat4: mat4Api,
        mat3: mat3Api,
        aabb: aabbApi,
        ray: rayApi,
        scalar: scalarApi,
        noise: noiseApi,
        color: colorApi,
        random: randomApi,
        clamp: scalarApi.clamp,
        lerp: scalarApi.lerp,
        degToRad: scalarApi.degToRad,
        radToDeg: scalarApi.radToDeg,
        PI: Math.PI,
        TAU: Math.PI * 2,
    };
}
