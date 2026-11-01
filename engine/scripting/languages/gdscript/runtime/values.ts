export class GDScriptError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'GDScriptError';
    }
}
export function fail(message: string): never {
    throw new GDScriptError(message);
}
export interface VecLike {
    x: number;
    y: number;
    z?: number;
    w?: number;
}
const EPSILON = 0.00001;
export function isEqualApprox(a: number, b: number): boolean {
    if (a === b)
        return true;
    let tolerance = EPSILON * Math.abs(a);
    if (tolerance < EPSILON)
        tolerance = EPSILON;
    return Math.abs(a - b) < tolerance;
}
function clampNumber(value: number, min: number, max: number): number {
    return value < min ? min : value > max ? max : value;
}
function snappedNumber(value: number, step: number): number {
    return step !== 0 ? Math.floor(value / step + 0.5) * step : value;
}
function posmodNumber(a: number, b: number): number {
    const value = a % b;
    return (value < 0 && b > 0) || (value > 0 && b < 0) ? value + b : value;
}
function moveTowardNumber(from: number, to: number, delta: number): number {
    return Math.abs(to - from) <= delta ? to : from + Math.sign(to - from) * delta;
}
export class Vector2 {
    x: number;
    y: number;
    constructor(x: unknown = 0, y: unknown = 0) {
        if (x !== null && typeof x === 'object') {
            const source = x as VecLike;
            this.x = Number(source.x ?? 0);
            this.y = Number(source.y ?? 0);
            return;
        }
        this.x = Number(x);
        this.y = Number(y);
    }
    static get ZERO() {
        return new Vector2(0, 0);
    }
    static get ONE() {
        return new Vector2(1, 1);
    }
    static get INF() {
        return new Vector2(Infinity, Infinity);
    }
    static get LEFT() {
        return new Vector2(-1, 0);
    }
    static get RIGHT() {
        return new Vector2(1, 0);
    }
    static get UP() {
        return new Vector2(0, -1);
    }
    static get DOWN() {
        return new Vector2(0, 1);
    }
    static readonly AXIS_X = 0;
    static readonly AXIS_Y = 1;
    static from_angle(angle: number): Vector2 {
        return new Vector2(Math.cos(angle), Math.sin(angle));
    }
    protected make(x: number, y: number): Vector2 {
        return new Vector2(x, y);
    }
    length(this: VecLike): number {
        return Math.hypot(this.x, this.y);
    }
    length_squared(this: VecLike): number {
        return this.x * this.x + this.y * this.y;
    }
    normalized(this: VecLike): Vector2 {
        const length = Math.hypot(this.x, this.y);
        return length === 0 ? new Vector2(0, 0) : new Vector2(this.x / length, this.y / length);
    }
    is_normalized(this: VecLike): boolean {
        return isEqualApprox(this.x * this.x + this.y * this.y, 1);
    }
    is_zero_approx(this: VecLike): boolean {
        return isEqualApprox(this.x, 0) && isEqualApprox(this.y, 0);
    }
    is_equal_approx(this: VecLike, other: VecLike): boolean {
        return isEqualApprox(this.x, other.x) && isEqualApprox(this.y, other.y);
    }
    is_finite(this: VecLike): boolean {
        return Number.isFinite(this.x) && Number.isFinite(this.y);
    }
    dot(this: VecLike, other: VecLike): number {
        return this.x * other.x + this.y * other.y;
    }
    cross(this: VecLike, other: VecLike): number {
        return this.x * other.y - this.y * other.x;
    }
    distance_to(this: VecLike, other: VecLike): number {
        return Math.hypot(other.x - this.x, other.y - this.y);
    }
    distance_squared_to(this: VecLike, other: VecLike): number {
        const dx = other.x - this.x;
        const dy = other.y - this.y;
        return dx * dx + dy * dy;
    }
    direction_to(this: VecLike, other: VecLike): Vector2 {
        return new Vector2(other.x - this.x, other.y - this.y).normalized();
    }
    angle(this: VecLike): number {
        return Math.atan2(this.y, this.x);
    }
    angle_to(this: VecLike, other: VecLike): number {
        return Math.atan2(this.x * other.y - this.y * other.x, this.x * other.x + this.y * other.y);
    }
    angle_to_point(this: VecLike, other: VecLike): number {
        return Math.atan2(other.y - this.y, other.x - this.x);
    }
    aspect(this: VecLike): number {
        return this.x / this.y;
    }
    lerp(this: VecLike, to: VecLike, weight: number): Vector2 {
        return new Vector2(this.x + (to.x - this.x) * weight, this.y + (to.y - this.y) * weight);
    }
    slerp(this: VecLike, to: VecLike, weight: number): Vector2 {
        const start = Math.hypot(this.x, this.y);
        const end = Math.hypot(to.x, to.y);
        if (start === 0 || end === 0)
            return Vector2.prototype.lerp.call(this, to, weight);
        const angle = Vector2.prototype.angle_to.call(this, to);
        const length = start + (end - start) * weight;
        const rotated = Vector2.prototype.rotated.call(this, angle * weight);
        const current = Math.hypot(rotated.x, rotated.y);
        return new Vector2((rotated.x / current) * length, (rotated.y / current) * length);
    }
    cubic_interpolate(this: VecLike, b: VecLike, preA: VecLike, postB: VecLike, weight: number): Vector2 {
        return new Vector2(cubic(this.x, b.x, preA.x, postB.x, weight), cubic(this.y, b.y, preA.y, postB.y, weight));
    }
    move_toward(this: VecLike, to: VecLike, delta: number): Vector2 {
        const dx = to.x - this.x;
        const dy = to.y - this.y;
        const length = Math.hypot(dx, dy);
        if (length <= delta || length < EPSILON)
            return new Vector2(to.x, to.y);
        return new Vector2(this.x + (dx / length) * delta, this.y + (dy / length) * delta);
    }
    limit_length(this: VecLike, max = 1): Vector2 {
        const length = Math.hypot(this.x, this.y);
        if (length > 0 && max < length)
            return new Vector2((this.x / length) * max, (this.y / length) * max);
        return new Vector2(this.x, this.y);
    }
    rotated(this: VecLike, angle: number): Vector2 {
        const sin = Math.sin(angle);
        const cos = Math.cos(angle);
        return new Vector2(this.x * cos - this.y * sin, this.x * sin + this.y * cos);
    }
    orthogonal(this: VecLike): Vector2 {
        return new Vector2(this.y, -this.x);
    }
    project(this: VecLike, onto: VecLike): Vector2 {
        const scale = Vector2.prototype.dot.call(this, onto) / (onto.x * onto.x + onto.y * onto.y);
        return new Vector2(onto.x * scale, onto.y * scale);
    }
    reflect(this: VecLike, line: VecLike): Vector2 {
        const scale = 2 * Vector2.prototype.dot.call(this, line);
        return new Vector2(scale * line.x - this.x, scale * line.y - this.y);
    }
    bounce(this: VecLike, normal: VecLike): Vector2 {
        const reflected = Vector2.prototype.reflect.call(this, normal);
        return new Vector2(-reflected.x, -reflected.y);
    }
    slide(this: VecLike, normal: VecLike): Vector2 {
        const scale = Vector2.prototype.dot.call(this, normal);
        return new Vector2(this.x - normal.x * scale, this.y - normal.y * scale);
    }
    abs(this: VecLike): Vector2 {
        return new Vector2(Math.abs(this.x), Math.abs(this.y));
    }
    sign(this: VecLike): Vector2 {
        return new Vector2(Math.sign(this.x), Math.sign(this.y));
    }
    floor(this: VecLike): Vector2 {
        return new Vector2(Math.floor(this.x), Math.floor(this.y));
    }
    ceil(this: VecLike): Vector2 {
        return new Vector2(Math.ceil(this.x), Math.ceil(this.y));
    }
    round(this: VecLike): Vector2 {
        return new Vector2(Math.round(this.x), Math.round(this.y));
    }
    clamp(this: VecLike, min: VecLike, max: VecLike): Vector2 {
        return new Vector2(clampNumber(this.x, min.x, max.x), clampNumber(this.y, min.y, max.y));
    }
    snapped(this: VecLike, step: VecLike): Vector2 {
        return new Vector2(snappedNumber(this.x, step.x), snappedNumber(this.y, step.y));
    }
    posmod(this: VecLike, mod: number): Vector2 {
        return new Vector2(posmodNumber(this.x, mod), posmodNumber(this.y, mod));
    }
    posmodv(this: VecLike, mod: VecLike): Vector2 {
        return new Vector2(posmodNumber(this.x, mod.x), posmodNumber(this.y, mod.y));
    }
    min(this: VecLike, other: VecLike): Vector2 {
        return new Vector2(Math.min(this.x, other.x), Math.min(this.y, other.y));
    }
    max(this: VecLike, other: VecLike): Vector2 {
        return new Vector2(Math.max(this.x, other.x), Math.max(this.y, other.y));
    }
    max_axis_index(this: VecLike): number {
        return this.x < this.y ? 1 : 0;
    }
    min_axis_index(this: VecLike): number {
        return this.x < this.y ? 0 : 1;
    }
}
export class Vector2i extends Vector2 {
    constructor(x: unknown = 0, y: unknown = 0) {
        super(x, y);
        this.x = Math.trunc(this.x);
        this.y = Math.trunc(this.y);
    }
}
export class Vector3 {
    x: number;
    y: number;
    z: number;
    constructor(x: unknown = 0, y: unknown = 0, z: unknown = 0) {
        if (x !== null && typeof x === 'object') {
            const source = x as VecLike & ArrayLike<number>;
            if (typeof source.x === 'number') {
                this.x = source.x;
                this.y = source.y;
                this.z = Number(source.z ?? 0);
            }
            else {
                this.x = Number(source[0] ?? 0);
                this.y = Number(source[1] ?? 0);
                this.z = Number(source[2] ?? 0);
            }
            return;
        }
        this.x = Number(x);
        this.y = Number(y);
        this.z = Number(z);
    }
    static get ZERO() {
        return new Vector3(0, 0, 0);
    }
    static get ONE() {
        return new Vector3(1, 1, 1);
    }
    static get INF() {
        return new Vector3(Infinity, Infinity, Infinity);
    }
    static get LEFT() {
        return new Vector3(-1, 0, 0);
    }
    static get RIGHT() {
        return new Vector3(1, 0, 0);
    }
    static get UP() {
        return new Vector3(0, 1, 0);
    }
    static get DOWN() {
        return new Vector3(0, -1, 0);
    }
    static get FORWARD() {
        return new Vector3(0, 0, -1);
    }
    static get BACK() {
        return new Vector3(0, 0, 1);
    }
    static readonly AXIS_X = 0;
    static readonly AXIS_Y = 1;
    static readonly AXIS_Z = 2;
    length(this: VecLike): number {
        return Math.hypot(this.x, this.y, this.z ?? 0);
    }
    length_squared(this: VecLike): number {
        const z = this.z ?? 0;
        return this.x * this.x + this.y * this.y + z * z;
    }
    normalized(this: VecLike): Vector3 {
        const z = this.z ?? 0;
        const length = Math.hypot(this.x, this.y, z);
        return length === 0 ? new Vector3(0, 0, 0) : new Vector3(this.x / length, this.y / length, z / length);
    }
    is_normalized(this: VecLike): boolean {
        return isEqualApprox(Vector3.prototype.length_squared.call(this), 1);
    }
    is_zero_approx(this: VecLike): boolean {
        return isEqualApprox(this.x, 0) && isEqualApprox(this.y, 0) && isEqualApprox(this.z ?? 0, 0);
    }
    is_equal_approx(this: VecLike, other: VecLike): boolean {
        return isEqualApprox(this.x, other.x) && isEqualApprox(this.y, other.y) && isEqualApprox(this.z ?? 0, other.z ?? 0);
    }
    is_finite(this: VecLike): boolean {
        return Number.isFinite(this.x) && Number.isFinite(this.y) && Number.isFinite(this.z ?? 0);
    }
    dot(this: VecLike, other: VecLike): number {
        return this.x * other.x + this.y * other.y + (this.z ?? 0) * (other.z ?? 0);
    }
    cross(this: VecLike, other: VecLike): Vector3 {
        const az = this.z ?? 0;
        const bz = other.z ?? 0;
        return new Vector3(this.y * bz - az * other.y, az * other.x - this.x * bz, this.x * other.y - this.y * other.x);
    }
    distance_to(this: VecLike, other: VecLike): number {
        return Math.hypot(other.x - this.x, other.y - this.y, (other.z ?? 0) - (this.z ?? 0));
    }
    distance_squared_to(this: VecLike, other: VecLike): number {
        const dx = other.x - this.x;
        const dy = other.y - this.y;
        const dz = (other.z ?? 0) - (this.z ?? 0);
        return dx * dx + dy * dy + dz * dz;
    }
    direction_to(this: VecLike, other: VecLike): Vector3 {
        return new Vector3(other.x - this.x, other.y - this.y, (other.z ?? 0) - (this.z ?? 0)).normalized();
    }
    angle_to(this: VecLike, other: VecLike): number {
        const cross = Vector3.prototype.cross.call(this, other);
        return Math.atan2(cross.length(), Vector3.prototype.dot.call(this, other));
    }
    signed_angle_to(this: VecLike, other: VecLike, axis: VecLike): number {
        const cross = Vector3.prototype.cross.call(this, other);
        const unsigned = Math.atan2(cross.length(), Vector3.prototype.dot.call(this, other));
        return cross.dot(axis) < 0 ? -unsigned : unsigned;
    }
    lerp(this: VecLike, to: VecLike, weight: number): Vector3 {
        const z = this.z ?? 0;
        return new Vector3(this.x + (to.x - this.x) * weight, this.y + (to.y - this.y) * weight, z + ((to.z ?? 0) - z) * weight);
    }
    slerp(this: VecLike, to: VecLike, weight: number): Vector3 {
        const startSq = Vector3.prototype.length_squared.call(this);
        const endSq = Vector3.prototype.length_squared.call(to);
        if (startSq === 0 || endSq === 0)
            return Vector3.prototype.lerp.call(this, to, weight);
        const axis = Vector3.prototype.cross.call(this, to);
        const axisSq = axis.length_squared();
        if (axisSq === 0)
            return Vector3.prototype.lerp.call(this, to, weight);
        const start = Math.sqrt(startSq);
        const length = start + (Math.sqrt(endSq) - start) * weight;
        const angle = Vector3.prototype.angle_to.call(this, to);
        const rotated = Vector3.prototype.rotated.call(this, axis.normalized(), angle * weight);
        const current = rotated.length();
        return new Vector3((rotated.x / current) * length, (rotated.y / current) * length, (rotated.z / current) * length);
    }
    cubic_interpolate(this: VecLike, b: VecLike, preA: VecLike, postB: VecLike, weight: number): Vector3 {
        return new Vector3(cubic(this.x, b.x, preA.x, postB.x, weight), cubic(this.y, b.y, preA.y, postB.y, weight), cubic(this.z ?? 0, b.z ?? 0, preA.z ?? 0, postB.z ?? 0, weight));
    }
    move_toward(this: VecLike, to: VecLike, delta: number): Vector3 {
        const dx = to.x - this.x;
        const dy = to.y - this.y;
        const dz = (to.z ?? 0) - (this.z ?? 0);
        const length = Math.hypot(dx, dy, dz);
        if (length <= delta || length < EPSILON)
            return new Vector3(to.x, to.y, to.z ?? 0);
        return new Vector3(this.x + (dx / length) * delta, this.y + (dy / length) * delta, (this.z ?? 0) + (dz / length) * delta);
    }
    limit_length(this: VecLike, max = 1): Vector3 {
        const length = Vector3.prototype.length.call(this);
        if (length > 0 && max < length)
            return new Vector3((this.x / length) * max, (this.y / length) * max, ((this.z ?? 0) / length) * max);
        return new Vector3(this.x, this.y, this.z ?? 0);
    }
    rotated(this: VecLike, axis: VecLike, angle: number): Vector3 {
        const quaternion = Quaternion.fromAxisAngle(axis, angle);
        return quaternion.xform(this);
    }
    project(this: VecLike, onto: VecLike): Vector3 {
        const scale = Vector3.prototype.dot.call(this, onto) / Vector3.prototype.length_squared.call(onto);
        return new Vector3(onto.x * scale, onto.y * scale, (onto.z ?? 0) * scale);
    }
    reflect(this: VecLike, normal: VecLike): Vector3 {
        const scale = 2 * Vector3.prototype.dot.call(this, normal);
        return new Vector3(scale * normal.x - this.x, scale * normal.y - this.y, scale * (normal.z ?? 0) - (this.z ?? 0));
    }
    bounce(this: VecLike, normal: VecLike): Vector3 {
        const reflected = Vector3.prototype.reflect.call(this, normal);
        return new Vector3(-reflected.x, -reflected.y, -reflected.z);
    }
    slide(this: VecLike, normal: VecLike): Vector3 {
        const scale = Vector3.prototype.dot.call(this, normal);
        return new Vector3(this.x - normal.x * scale, this.y - normal.y * scale, (this.z ?? 0) - (normal.z ?? 0) * scale);
    }
    abs(this: VecLike): Vector3 {
        return new Vector3(Math.abs(this.x), Math.abs(this.y), Math.abs(this.z ?? 0));
    }
    sign(this: VecLike): Vector3 {
        return new Vector3(Math.sign(this.x), Math.sign(this.y), Math.sign(this.z ?? 0));
    }
    floor(this: VecLike): Vector3 {
        return new Vector3(Math.floor(this.x), Math.floor(this.y), Math.floor(this.z ?? 0));
    }
    ceil(this: VecLike): Vector3 {
        return new Vector3(Math.ceil(this.x), Math.ceil(this.y), Math.ceil(this.z ?? 0));
    }
    round(this: VecLike): Vector3 {
        return new Vector3(Math.round(this.x), Math.round(this.y), Math.round(this.z ?? 0));
    }
    inverse(this: VecLike): Vector3 {
        return new Vector3(1 / this.x, 1 / this.y, 1 / (this.z ?? 0));
    }
    clamp(this: VecLike, min: VecLike, max: VecLike): Vector3 {
        return new Vector3(clampNumber(this.x, min.x, max.x), clampNumber(this.y, min.y, max.y), clampNumber(this.z ?? 0, min.z ?? 0, max.z ?? 0));
    }
    snapped(this: VecLike, step: VecLike): Vector3 {
        return new Vector3(snappedNumber(this.x, step.x), snappedNumber(this.y, step.y), snappedNumber(this.z ?? 0, step.z ?? 0));
    }
    posmod(this: VecLike, mod: number): Vector3 {
        return new Vector3(posmodNumber(this.x, mod), posmodNumber(this.y, mod), posmodNumber(this.z ?? 0, mod));
    }
    posmodv(this: VecLike, mod: VecLike): Vector3 {
        return new Vector3(posmodNumber(this.x, mod.x), posmodNumber(this.y, mod.y), posmodNumber(this.z ?? 0, mod.z ?? 0));
    }
    min(this: VecLike, other: VecLike): Vector3 {
        return new Vector3(Math.min(this.x, other.x), Math.min(this.y, other.y), Math.min(this.z ?? 0, other.z ?? 0));
    }
    max(this: VecLike, other: VecLike): Vector3 {
        return new Vector3(Math.max(this.x, other.x), Math.max(this.y, other.y), Math.max(this.z ?? 0, other.z ?? 0));
    }
    max_axis_index(this: VecLike): number {
        const z = this.z ?? 0;
        return this.x < this.y ? (this.y < z ? 2 : 1) : this.x < z ? 2 : 0;
    }
    min_axis_index(this: VecLike): number {
        const z = this.z ?? 0;
        return this.x < this.y ? (this.x < z ? 0 : 2) : this.y < z ? 1 : 2;
    }
    outer(this: VecLike, other: VecLike): Basis {
        const z = this.z ?? 0;
        return new Basis(new Vector3(this.x * other.x, this.x * other.y, this.x * (other.z ?? 0)), new Vector3(this.y * other.x, this.y * other.y, this.y * (other.z ?? 0)), new Vector3(z * other.x, z * other.y, z * (other.z ?? 0)));
    }
}
export class Vector3i extends Vector3 {
    constructor(x: unknown = 0, y: unknown = 0, z: unknown = 0) {
        super(x, y, z);
        this.x = Math.trunc(this.x);
        this.y = Math.trunc(this.y);
        this.z = Math.trunc(this.z);
    }
}
export class Vector4 {
    x: number;
    y: number;
    z: number;
    w: number;
    constructor(x: unknown = 0, y: unknown = 0, z: unknown = 0, w: unknown = 0) {
        if (x !== null && typeof x === 'object') {
            const source = x as VecLike;
            this.x = Number(source.x ?? 0);
            this.y = Number(source.y ?? 0);
            this.z = Number(source.z ?? 0);
            this.w = Number(source.w ?? 0);
            return;
        }
        this.x = Number(x);
        this.y = Number(y);
        this.z = Number(z);
        this.w = Number(w);
    }
    static get ZERO() {
        return new Vector4(0, 0, 0, 0);
    }
    static get ONE() {
        return new Vector4(1, 1, 1, 1);
    }
    length(this: VecLike): number {
        return Math.hypot(this.x, this.y, this.z ?? 0, this.w ?? 0);
    }
    length_squared(this: VecLike): number {
        const z = this.z ?? 0;
        const w = this.w ?? 0;
        return this.x * this.x + this.y * this.y + z * z + w * w;
    }
    normalized(this: VecLike): Vector4 {
        const length = Vector4.prototype.length.call(this);
        return length === 0 ? new Vector4() : new Vector4(this.x / length, this.y / length, (this.z ?? 0) / length, (this.w ?? 0) / length);
    }
    dot(this: VecLike, other: VecLike): number {
        return this.x * other.x + this.y * other.y + (this.z ?? 0) * (other.z ?? 0) + (this.w ?? 0) * (other.w ?? 0);
    }
    lerp(this: VecLike, to: VecLike, weight: number): Vector4 {
        const z = this.z ?? 0;
        const w = this.w ?? 0;
        return new Vector4(this.x + (to.x - this.x) * weight, this.y + (to.y - this.y) * weight, z + ((to.z ?? 0) - z) * weight, w + ((to.w ?? 0) - w) * weight);
    }
    abs(this: VecLike): Vector4 {
        return new Vector4(Math.abs(this.x), Math.abs(this.y), Math.abs(this.z ?? 0), Math.abs(this.w ?? 0));
    }
    is_equal_approx(this: VecLike, other: VecLike): boolean {
        return isEqualApprox(this.x, other.x) && isEqualApprox(this.y, other.y) && isEqualApprox(this.z ?? 0, other.z ?? 0) && isEqualApprox(this.w ?? 0, other.w ?? 0);
    }
    is_zero_approx(this: VecLike): boolean {
        return isEqualApprox(this.x, 0) && isEqualApprox(this.y, 0) && isEqualApprox(this.z ?? 0, 0) && isEqualApprox(this.w ?? 0, 0);
    }
}
function cubic(from: number, to: number, pre: number, post: number, weight: number): number {
    return 0.5 * (from * 2 + (-pre + to) * weight + (2 * pre - 5 * from + 4 * to - post) * weight * weight + (-pre + 3 * from - 3 * to + post) * weight * weight * weight);
}
export class Quaternion {
    x: number;
    y: number;
    z: number;
    w: number;
    constructor(x: unknown = 0, y: unknown = 0, z: unknown = 0, w: unknown = 1) {
        if (x !== null && typeof x === 'object' && typeof y === 'number') {
            const built = Quaternion.fromAxisAngle(x as VecLike, y);
            this.x = built.x;
            this.y = built.y;
            this.z = built.z;
            this.w = built.w;
            return;
        }
        if (x !== null && typeof x === 'object') {
            const source = x as VecLike;
            this.x = Number(source.x ?? 0);
            this.y = Number(source.y ?? 0);
            this.z = Number(source.z ?? 0);
            this.w = Number(source.w ?? 1);
            return;
        }
        this.x = Number(x);
        this.y = Number(y);
        this.z = Number(z);
        this.w = Number(w);
    }
    static get IDENTITY() {
        return new Quaternion(0, 0, 0, 1);
    }
    static fromAxisAngle(axis: VecLike, angle: number): Quaternion {
        const half = angle * 0.5;
        const sin = Math.sin(half);
        const length = Math.hypot(axis.x, axis.y, axis.z ?? 0) || 1;
        return new Quaternion((axis.x / length) * sin, (axis.y / length) * sin, ((axis.z ?? 0) / length) * sin, Math.cos(half));
    }
    static from_euler(euler: VecLike): Quaternion {
        const halfX = euler.x * 0.5;
        const halfY = euler.y * 0.5;
        const halfZ = (euler.z ?? 0) * 0.5;
        const cosX = Math.cos(halfX);
        const sinX = Math.sin(halfX);
        const cosY = Math.cos(halfY);
        const sinY = Math.sin(halfY);
        const cosZ = Math.cos(halfZ);
        const sinZ = Math.sin(halfZ);
        return new Quaternion(sinX * cosY * cosZ + cosX * sinY * sinZ, cosX * sinY * cosZ - sinX * cosY * sinZ, cosX * cosY * sinZ - sinX * sinY * cosZ, cosX * cosY * cosZ + sinX * sinY * sinZ);
    }
    length(): number {
        return Math.hypot(this.x, this.y, this.z, this.w);
    }
    length_squared(): number {
        return this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w;
    }
    normalized(): Quaternion {
        const length = this.length() || 1;
        return new Quaternion(this.x / length, this.y / length, this.z / length, this.w / length);
    }
    is_normalized(): boolean {
        return isEqualApprox(this.length_squared(), 1);
    }
    inverse(): Quaternion {
        return new Quaternion(-this.x, -this.y, -this.z, this.w);
    }
    dot(other: Quaternion): number {
        return this.x * other.x + this.y * other.y + this.z * other.z + this.w * other.w;
    }
    angle_to(other: Quaternion): number {
        const dot = this.dot(other);
        return Math.acos(clampNumber(dot * dot * 2 - 1, -1, 1));
    }
    multiply(other: Quaternion): Quaternion {
        return new Quaternion(this.w * other.x + this.x * other.w + this.y * other.z - this.z * other.y, this.w * other.y + this.y * other.w + this.z * other.x - this.x * other.z, this.w * other.z + this.z * other.w + this.x * other.y - this.y * other.x, this.w * other.w - this.x * other.x - this.y * other.y - this.z * other.z);
    }
    xform(vector: VecLike): Vector3 {
        const u = new Vector3(this.x, this.y, this.z);
        const v = new Vector3(vector.x, vector.y, vector.z ?? 0);
        const uv = u.cross(v);
        const uuv = u.cross(uv);
        return new Vector3(v.x + (uv.x * this.w + uuv.x) * 2, v.y + (uv.y * this.w + uuv.y) * 2, v.z + (uv.z * this.w + uuv.z) * 2);
    }
    slerp(to: Quaternion, weight: number): Quaternion {
        let cos = this.dot(to);
        let target = to;
        if (cos < 0) {
            cos = -cos;
            target = new Quaternion(-to.x, -to.y, -to.z, -to.w);
        }
        let scale0: number;
        let scale1: number;
        if (1 - cos > EPSILON) {
            const omega = Math.acos(cos);
            const sin = Math.sin(omega);
            scale0 = Math.sin((1 - weight) * omega) / sin;
            scale1 = Math.sin(weight * omega) / sin;
        }
        else {
            scale0 = 1 - weight;
            scale1 = weight;
        }
        return new Quaternion(scale0 * this.x + scale1 * target.x, scale0 * this.y + scale1 * target.y, scale0 * this.z + scale1 * target.z, scale0 * this.w + scale1 * target.w);
    }
    get_axis(): Vector3 {
        if (Math.abs(this.w) > 1 - EPSILON)
            return new Vector3(this.x, this.y, this.z);
        const r = 1 / Math.sqrt(1 - this.w * this.w);
        return new Vector3(this.x * r, this.y * r, this.z * r);
    }
    get_angle(): number {
        return 2 * Math.acos(clampNumber(this.w, -1, 1));
    }
    get_euler(): Vector3 {
        return Basis.from_quaternion(this).get_euler();
    }
    is_equal_approx(other: Quaternion): boolean {
        return isEqualApprox(this.x, other.x) && isEqualApprox(this.y, other.y) && isEqualApprox(this.z, other.z) && isEqualApprox(this.w, other.w);
    }
}
export class Basis {
    x: Vector3;
    y: Vector3;
    z: Vector3;
    constructor(x?: unknown, y?: unknown, z?: unknown) {
        if (x instanceof Quaternion) {
            const built = Basis.from_quaternion(x);
            this.x = built.x;
            this.y = built.y;
            this.z = built.z;
            return;
        }
        if (x !== null && typeof x === 'object' && typeof y === 'number') {
            const built = Basis.from_quaternion(Quaternion.fromAxisAngle(x as VecLike, y));
            this.x = built.x;
            this.y = built.y;
            this.z = built.z;
            return;
        }
        this.x = x === undefined ? new Vector3(1, 0, 0) : new Vector3(x);
        this.y = y === undefined ? new Vector3(0, 1, 0) : new Vector3(y);
        this.z = z === undefined ? new Vector3(0, 0, 1) : new Vector3(z);
    }
    static get IDENTITY() {
        return new Basis();
    }
    static from_quaternion(q: Quaternion): Basis {
        const xx = q.x * q.x;
        const yy = q.y * q.y;
        const zz = q.z * q.z;
        const xy = q.x * q.y;
        const xz = q.x * q.z;
        const yz = q.y * q.z;
        const wx = q.w * q.x;
        const wy = q.w * q.y;
        const wz = q.w * q.z;
        return new Basis(new Vector3(1 - 2 * (yy + zz), 2 * (xy + wz), 2 * (xz - wy)), new Vector3(2 * (xy - wz), 1 - 2 * (xx + zz), 2 * (yz + wx)), new Vector3(2 * (xz + wy), 2 * (yz - wx), 1 - 2 * (xx + yy)));
    }
    static from_euler(euler: VecLike): Basis {
        return Basis.from_quaternion(Quaternion.from_euler(euler));
    }
    static from_scale(scale: VecLike): Basis {
        return new Basis(new Vector3(scale.x, 0, 0), new Vector3(0, scale.y, 0), new Vector3(0, 0, scale.z ?? 0));
    }
    static looking_at(target: VecLike, up: VecLike = new Vector3(0, 1, 0)): Basis {
        const forward = new Vector3(target).normalized();
        const right = new Vector3(up).cross(forward).normalized();
        const realUp = forward.cross(right);
        return new Basis(right, realUp, new Vector3(-forward.x, -forward.y, -forward.z));
    }
    private element(row: number, column: number): number {
        const columnVector = column === 0 ? this.x : column === 1 ? this.y : this.z;
        return row === 0 ? columnVector.x : row === 1 ? columnVector.y : columnVector.z;
    }
    xform(vector: VecLike): Vector3 {
        const z = vector.z ?? 0;
        return new Vector3(this.x.x * vector.x + this.y.x * vector.y + this.z.x * z, this.x.y * vector.x + this.y.y * vector.y + this.z.y * z, this.x.z * vector.x + this.y.z * vector.y + this.z.z * z);
    }
    multiply(other: Basis): Basis {
        return new Basis(this.xform(other.x), this.xform(other.y), this.xform(other.z));
    }
    transposed(): Basis {
        return new Basis(new Vector3(this.x.x, this.y.x, this.z.x), new Vector3(this.x.y, this.y.y, this.z.y), new Vector3(this.x.z, this.y.z, this.z.z));
    }
    determinant(): number {
        return this.x.x * (this.y.y * this.z.z - this.z.y * this.y.z) - this.y.x * (this.x.y * this.z.z - this.z.y * this.x.z) + this.z.x * (this.x.y * this.y.z - this.y.y * this.x.z);
    }
    inverse(): Basis {
        const det = this.determinant();
        if (det === 0)
            fail('Basis.inverse(): a base não é invertível (determinante zero).');
        const inv = 1 / det;
        const m = (r: number, c: number) => this.element(r, c);
        const cofactor = (r: number, c: number) => {
            const r1 = (r + 1) % 3;
            const r2 = (r + 2) % 3;
            const c1 = (c + 1) % 3;
            const c2 = (c + 2) % 3;
            return m(r1, c1) * m(r2, c2) - m(r1, c2) * m(r2, c1);
        };
        return new Basis(new Vector3(cofactor(0, 0) * inv, cofactor(0, 1) * inv, cofactor(0, 2) * inv), new Vector3(cofactor(1, 0) * inv, cofactor(1, 1) * inv, cofactor(1, 2) * inv), new Vector3(cofactor(2, 0) * inv, cofactor(2, 1) * inv, cofactor(2, 2) * inv));
    }
    orthonormalized(): Basis {
        const x = this.x.normalized();
        let y = this.y.slide(x).normalized();
        const z = x.cross(y);
        y = z.cross(x);
        return new Basis(x, y, z);
    }
    rotated(axis: VecLike, angle: number): Basis {
        return Basis.from_quaternion(Quaternion.fromAxisAngle(axis, angle)).multiply(this);
    }
    scaled(scale: VecLike): Basis {
        return new Basis(new Vector3(this.x.x * scale.x, this.x.y * scale.y, this.x.z * (scale.z ?? 0)), new Vector3(this.y.x * scale.x, this.y.y * scale.y, this.y.z * (scale.z ?? 0)), new Vector3(this.z.x * scale.x, this.z.y * scale.y, this.z.z * (scale.z ?? 0)));
    }
    get_scale(): Vector3 {
        const sign = Math.sign(this.determinant()) || 1;
        return new Vector3(this.x.length() * sign, this.y.length() * sign, this.z.length() * sign);
    }
    get_rotation_quaternion(): Quaternion {
        const b = this.orthonormalized();
        const trace = b.x.x + b.y.y + b.z.z;
        if (trace > 0) {
            const s = Math.sqrt(trace + 1) * 2;
            return new Quaternion((b.y.z - b.z.y) / s, (b.z.x - b.x.z) / s, (b.x.y - b.y.x) / s, 0.25 * s).normalized();
        }
        if (b.x.x > b.y.y && b.x.x > b.z.z) {
            const s = Math.sqrt(1 + b.x.x - b.y.y - b.z.z) * 2;
            return new Quaternion(0.25 * s, (b.y.x + b.x.y) / s, (b.z.x + b.x.z) / s, (b.y.z - b.z.y) / s).normalized();
        }
        if (b.y.y > b.z.z) {
            const s = Math.sqrt(1 + b.y.y - b.x.x - b.z.z) * 2;
            return new Quaternion((b.y.x + b.x.y) / s, 0.25 * s, (b.z.y + b.y.z) / s, (b.z.x - b.x.z) / s).normalized();
        }
        const s = Math.sqrt(1 + b.z.z - b.x.x - b.y.y) * 2;
        return new Quaternion((b.z.x + b.x.z) / s, (b.z.y + b.y.z) / s, 0.25 * s, (b.x.y - b.y.x) / s).normalized();
    }
    get_euler(): Vector3 {
        const m = (r: number, c: number) => this.element(r, c);
        const sinX = clampNumber(-m(1, 2), -1, 1);
        const x = Math.asin(sinX);
        if (Math.abs(sinX) < 1 - EPSILON)
            return new Vector3(x, Math.atan2(m(0, 2), m(2, 2)), Math.atan2(m(1, 0), m(1, 1)));
        return new Vector3(x, Math.atan2(-m(2, 0), m(0, 0)), 0);
    }
    tdotx(vector: VecLike): number {
        return this.x.x * vector.x + this.x.y * vector.y + this.x.z * (vector.z ?? 0);
    }
    tdoty(vector: VecLike): number {
        return this.y.x * vector.x + this.y.y * vector.y + this.y.z * (vector.z ?? 0);
    }
    tdotz(vector: VecLike): number {
        return this.z.x * vector.x + this.z.y * vector.y + this.z.z * (vector.z ?? 0);
    }
    is_equal_approx(other: Basis): boolean {
        return this.x.is_equal_approx(other.x) && this.y.is_equal_approx(other.y) && this.z.is_equal_approx(other.z);
    }
    slerp(to: Basis, weight: number): Basis {
        const from = this.get_rotation_quaternion();
        const result = Basis.from_quaternion(from.slerp(to.get_rotation_quaternion(), weight));
        const scale = this.get_scale().lerp(to.get_scale(), weight);
        return result.scaled(scale);
    }
}
export class Transform3D {
    basis: Basis;
    origin: Vector3;
    constructor(basis?: unknown, origin?: unknown) {
        if (basis instanceof Transform3D) {
            this.basis = new Basis(basis.basis.x, basis.basis.y, basis.basis.z);
            this.origin = new Vector3(basis.origin);
            return;
        }
        this.basis = basis instanceof Basis ? basis : basis === undefined || basis === null ? new Basis() : new Basis(basis);
        this.origin = origin === undefined || origin === null ? new Vector3() : new Vector3(origin);
    }
    static get IDENTITY() {
        return new Transform3D();
    }
    xform(vector: VecLike): Vector3 {
        const rotated = this.basis.xform(vector);
        return new Vector3(rotated.x + this.origin.x, rotated.y + this.origin.y, rotated.z + this.origin.z);
    }
    multiply(other: Transform3D): Transform3D {
        return new Transform3D(this.basis.multiply(other.basis), this.xform(other.origin));
    }
    inverse(): Transform3D {
        const basis = this.basis.transposed();
        const origin = basis.xform(this.origin);
        return new Transform3D(basis, new Vector3(-origin.x, -origin.y, -origin.z));
    }
    affine_inverse(): Transform3D {
        const basis = this.basis.inverse();
        const origin = basis.xform(this.origin);
        return new Transform3D(basis, new Vector3(-origin.x, -origin.y, -origin.z));
    }
    translated(offset: VecLike): Transform3D {
        return new Transform3D(this.basis, new Vector3(this.origin.x + offset.x, this.origin.y + offset.y, this.origin.z + (offset.z ?? 0)));
    }
    translated_local(offset: VecLike): Transform3D {
        return new Transform3D(this.basis, this.xform(offset));
    }
    rotated(axis: VecLike, angle: number): Transform3D {
        const rotation = Basis.from_quaternion(Quaternion.fromAxisAngle(axis, angle));
        return new Transform3D(rotation.multiply(this.basis), rotation.xform(this.origin));
    }
    rotated_local(axis: VecLike, angle: number): Transform3D {
        return new Transform3D(this.basis.rotated(axis, angle), this.origin);
    }
    scaled(scale: VecLike): Transform3D {
        return new Transform3D(this.basis.scaled(scale), new Vector3(this.origin.x * scale.x, this.origin.y * scale.y, this.origin.z * (scale.z ?? 0)));
    }
    looking_at(target: VecLike, up: VecLike = new Vector3(0, 1, 0)): Transform3D {
        const direction = new Vector3(target.x - this.origin.x, target.y - this.origin.y, (target.z ?? 0) - this.origin.z);
        return new Transform3D(Basis.looking_at(direction, up).scaled(this.basis.get_scale()), this.origin);
    }
    orthonormalized(): Transform3D {
        return new Transform3D(this.basis.orthonormalized(), this.origin);
    }
    interpolate_with(to: Transform3D, weight: number): Transform3D {
        return new Transform3D(this.basis.slerp(to.basis, weight), this.origin.lerp(to.origin, weight));
    }
    is_equal_approx(other: Transform3D): boolean {
        return this.basis.is_equal_approx(other.basis) && this.origin.is_equal_approx(other.origin);
    }
}
const NAMED_COLORS: Record<string, [
    number,
    number,
    number,
    number
]> = {
    BLACK: [0, 0, 0, 1],
    WHITE: [1, 1, 1, 1],
    RED: [1, 0, 0, 1],
    GREEN: [0, 1, 0, 1],
    BLUE: [0, 0, 1, 1],
    YELLOW: [1, 1, 0, 1],
    CYAN: [0, 1, 1, 1],
    MAGENTA: [1, 0, 1, 1],
    ORANGE: [1, 0.647059, 0, 1],
    PURPLE: [0.627451, 0.12549, 0.941176, 1],
    PINK: [1, 0.752941, 0.796078, 1],
    BROWN: [0.647059, 0.164706, 0.164706, 1],
    GRAY: [0.745098, 0.745098, 0.745098, 1],
    DARK_GRAY: [0.662745, 0.662745, 0.662745, 1],
    DIM_GRAY: [0.411765, 0.411765, 0.411765, 1],
    LIGHT_GRAY: [0.827451, 0.827451, 0.827451, 1],
    SILVER: [0.752941, 0.752941, 0.752941, 1],
    GOLD: [1, 0.843137, 0, 1],
    LIME: [0, 1, 0, 1],
    NAVY_BLUE: [0, 0, 0.501961, 1],
    SKY_BLUE: [0.529412, 0.807843, 0.921569, 1],
    DARK_RED: [0.545098, 0, 0, 1],
    DARK_GREEN: [0, 0.392157, 0, 1],
    DARK_BLUE: [0, 0, 0.545098, 1],
    TRANSPARENT: [1, 1, 1, 0],
};
export class Color {
    r: number;
    g: number;
    b: number;
    a: number;
    constructor(r: unknown = 0, g: unknown = 0, b: unknown = 0, a: unknown = 1) {
        if (typeof r === 'string') {
            const parsed = Color.html(r);
            this.r = parsed.r;
            this.g = parsed.g;
            this.b = parsed.b;
            this.a = typeof g === 'number' ? g : parsed.a;
            return;
        }
        if (r !== null && typeof r === 'object') {
            const source = r as Partial<Color> & ArrayLike<number>;
            if (typeof source.r === 'number') {
                this.r = source.r;
                this.g = source.g ?? 0;
                this.b = source.b ?? 0;
                this.a = typeof g === 'number' ? g : (source.a ?? 1);
            }
            else {
                this.r = Number(source[0] ?? 0);
                this.g = Number(source[1] ?? 0);
                this.b = Number(source[2] ?? 0);
                this.a = typeof g === 'number' ? g : Number(source[3] ?? 1);
            }
            return;
        }
        this.r = Number(r);
        this.g = Number(g);
        this.b = Number(b);
        this.a = Number(a);
    }
    static html(code: string): Color {
        let hex = code.trim().replace(/^#/, '');
        if (hex.length === 3 || hex.length === 4)
            hex = hex.split('').map((char) => char + char).join('');
        if (!/^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(hex))
            fail(`Color.html(): "${code}" não é uma cor em hexadecimal (use "#rrggbb" ou "#rrggbbaa").`);
        const value = (offset: number) => parseInt(hex.slice(offset, offset + 2), 16) / 255;
        return new Color(value(0), value(2), value(4), hex.length === 8 ? value(6) : 1);
    }
    static html_is_valid(code: string): boolean {
        const hex = code.trim().replace(/^#/, '');
        return /^[0-9a-fA-F]{3,4}$/.test(hex) || /^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(hex);
    }
    static hex(value: number): Color {
        return new Color(((value >>> 24) & 255) / 255, ((value >>> 16) & 255) / 255, ((value >>> 8) & 255) / 255, (value & 255) / 255);
    }
    static from_rgba8(r: number, g: number, b: number, a = 255): Color {
        return new Color(r / 255, g / 255, b / 255, a / 255);
    }
    static from_hsv(h: number, s: number, v: number, a = 1): Color {
        const i = Math.floor(h * 6);
        const f = h * 6 - i;
        const p = v * (1 - s);
        const q = v * (1 - f * s);
        const t = v * (1 - (1 - f) * s);
        switch (((i % 6) + 6) % 6) {
            case 0:
                return new Color(v, t, p, a);
            case 1:
                return new Color(q, v, p, a);
            case 2:
                return new Color(p, v, t, a);
            case 3:
                return new Color(p, q, v, a);
            case 4:
                return new Color(t, p, v, a);
            default:
                return new Color(v, p, q, a);
        }
    }
    static from_string(text: string, fallback: Color): Color {
        const named = NAMED_COLORS[text.trim().toUpperCase().replace(/\s+/g, '_')];
        if (named)
            return new Color(...named);
        return Color.html_is_valid(text) ? Color.html(text) : fallback;
    }
    static named(name: string): Color | null {
        const named = NAMED_COLORS[name];
        return named ? new Color(...named) : null;
    }
    static get names(): string[] {
        return Object.keys(NAMED_COLORS);
    }
    get h(): number {
        const max = Math.max(this.r, this.g, this.b);
        const min = Math.min(this.r, this.g, this.b);
        const delta = max - min;
        if (delta === 0)
            return 0;
        let h = max === this.r ? (this.g - this.b) / delta : max === this.g ? 2 + (this.b - this.r) / delta : 4 + (this.r - this.g) / delta;
        h /= 6;
        return h < 0 ? h + 1 : h;
    }
    get s(): number {
        const max = Math.max(this.r, this.g, this.b);
        const min = Math.min(this.r, this.g, this.b);
        return max === 0 ? 0 : (max - min) / max;
    }
    get v(): number {
        return Math.max(this.r, this.g, this.b);
    }
    get r8(): number {
        return Math.round(this.r * 255);
    }
    get g8(): number {
        return Math.round(this.g * 255);
    }
    get b8(): number {
        return Math.round(this.b * 255);
    }
    get a8(): number {
        return Math.round(this.a * 255);
    }
    lerp(to: Color, weight: number): Color {
        return new Color(this.r + (to.r - this.r) * weight, this.g + (to.g - this.g) * weight, this.b + (to.b - this.b) * weight, this.a + (to.a - this.a) * weight);
    }
    lightened(amount: number): Color {
        return new Color(this.r + (1 - this.r) * amount, this.g + (1 - this.g) * amount, this.b + (1 - this.b) * amount, this.a);
    }
    darkened(amount: number): Color {
        return new Color(this.r * (1 - amount), this.g * (1 - amount), this.b * (1 - amount), this.a);
    }
    inverted(): Color {
        return new Color(1 - this.r, 1 - this.g, 1 - this.b, this.a);
    }
    clamp(min = new Color(0, 0, 0, 0), max = new Color(1, 1, 1, 1)): Color {
        return new Color(clampNumber(this.r, min.r, max.r), clampNumber(this.g, min.g, max.g), clampNumber(this.b, min.b, max.b), clampNumber(this.a, min.a, max.a));
    }
    blend(over: Color): Color {
        const alpha = 1 - over.a;
        const a = this.a * alpha + over.a;
        if (a === 0)
            return new Color(0, 0, 0, 0);
        return new Color((this.r * this.a * alpha + over.r * over.a) / a, (this.g * this.a * alpha + over.g * over.a) / a, (this.b * this.a * alpha + over.b * over.a) / a, a);
    }
    to_html(withAlpha = true): string {
        const hex = (value: number) => Math.round(clampNumber(value, 0, 1) * 255).toString(16).padStart(2, '0');
        return `${hex(this.r)}${hex(this.g)}${hex(this.b)}${withAlpha ? hex(this.a) : ''}`;
    }
    to_rgba32(): number {
        return ((this.r8 << 24) | (this.g8 << 16) | (this.b8 << 8) | this.a8) >>> 0;
    }
    to_abgr32(): number {
        return ((this.a8 << 24) | (this.b8 << 16) | (this.g8 << 8) | this.r8) >>> 0;
    }
    is_equal_approx(other: Color): boolean {
        return isEqualApprox(this.r, other.r) && isEqualApprox(this.g, other.g) && isEqualApprox(this.b, other.b) && isEqualApprox(this.a, other.a);
    }
    luminance(): number {
        return 0.2126 * this.r + 0.7152 * this.g + 0.0722 * this.b;
    }
    srgb_to_linear(): Color {
        const convert = (value: number) => (value < 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4));
        return new Color(convert(this.r), convert(this.g), convert(this.b), this.a);
    }
    linear_to_srgb(): Color {
        const convert = (value: number) => (value < 0.0031308 ? 12.92 * value : 1.055 * Math.pow(value, 1 / 2.4) - 0.055);
        return new Color(convert(this.r), convert(this.g), convert(this.b), this.a);
    }
}
for (const name of Object.keys(NAMED_COLORS)) {
    Object.defineProperty(Color, name, { get: () => new Color(...NAMED_COLORS[name]), enumerable: true });
}
