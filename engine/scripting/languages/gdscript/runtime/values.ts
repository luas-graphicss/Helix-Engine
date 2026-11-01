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
