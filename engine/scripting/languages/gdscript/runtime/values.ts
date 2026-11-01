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
