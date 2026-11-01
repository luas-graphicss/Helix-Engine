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
}
