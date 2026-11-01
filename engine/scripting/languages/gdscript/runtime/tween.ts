import type { GameContext } from './bridge';
import { get as dynamicGet, invoke, set as dynamicSet, setChain } from './methods';
import { GodotObject, setGodotBase } from './object';
import { Basis, Color, Quaternion, Signal, Transform3D, Vector2, Vector2i, Vector3, Vector3i, Vector4, fail, isVecLike, markScriptClass } from './values';
import { add } from './variant';
type Fn = (...args: unknown[]) => unknown;
export const TRANS = { LINEAR: 0, SINE: 1, QUINT: 2, QUART: 3, QUAD: 4, EXPO: 5, ELASTIC: 6, CUBIC: 7, CIRC: 8, BOUNCE: 9, BACK: 10, SPRING: 11 } as const;
export const EASE = { IN: 0, OUT: 1, IN_OUT: 2, OUT_IN: 3 } as const;
function easeIn(trans: number, t: number): number {
    switch (trans) {
        case TRANS.SINE:
            return 1 - Math.cos((t * Math.PI) / 2);
        case TRANS.QUINT:
            return t ** 5;
        case TRANS.QUART:
            return t ** 4;
        case TRANS.QUAD:
            return t * t;
        case TRANS.EXPO:
            return t === 0 ? 0 : 2 ** (10 * (t - 1));
        case TRANS.ELASTIC: {
            if (t === 0 || t === 1)
                return t;
            const p = 0.3;
            const s = p / 4;
            return -(2 ** (10 * (t - 1))) * Math.sin(((t - 1 - s) * (2 * Math.PI)) / p);
        }
        case TRANS.CUBIC:
            return t ** 3;
        case TRANS.CIRC:
            return 1 - Math.sqrt(1 - t * t);
        case TRANS.BOUNCE:
            return 1 - bounceOut(1 - t);
        case TRANS.BACK: {
            const s = 1.70158;
            return t * t * ((s + 1) * t - s);
        }
        case TRANS.SPRING: {
            const inverted = 1 - t;
            return 1 - (Math.sin(inverted * Math.PI * (0.2 + 2.5 * inverted * inverted * inverted)) * (1 - inverted) ** 2.2 + inverted) * (1 + 1.2 * (1 - inverted));
        }
        default:
            return t;
    }
}
function bounceOut(t: number): number {
    if (t < 1 / 2.75)
        return 7.5625 * t * t;
    if (t < 2 / 2.75) {
        const u = t - 1.5 / 2.75;
        return 7.5625 * u * u + 0.75;
    }
    if (t < 2.5 / 2.75) {
        const u = t - 2.25 / 2.75;
        return 7.5625 * u * u + 0.9375;
    }
    const u = t - 2.625 / 2.75;
    return 7.5625 * u * u + 0.984375;
}
export function ease(trans: number, easing: number, t: number): number {
    const clamped = t <= 0 ? 0 : t >= 1 ? 1 : t;
    if (trans === TRANS.LINEAR)
        return clamped;
    switch (easing) {
        case EASE.OUT:
            return 1 - easeIn(trans, 1 - clamped);
        case EASE.IN_OUT:
            return clamped < 0.5 ? easeIn(trans, clamped * 2) / 2 : 1 - easeIn(trans, (1 - clamped) * 2) / 2;
        case EASE.OUT_IN:
            return clamped < 0.5 ? (1 - easeIn(trans, 1 - clamped * 2)) / 2 : 0.5 + easeIn(trans, (clamped - 0.5) * 2) / 2;
        default:
            return easeIn(trans, clamped);
    }
}
export function interpolateValue(from: unknown, to: unknown, weight: number): unknown {
    if (typeof from === 'number' && typeof to === 'number')
        return from + (to - from) * weight;
    if (from instanceof Vector2i && to instanceof Vector2)
        return new Vector2i(Math.round(from.x + (to.x - from.x) * weight), Math.round(from.y + (to.y - from.y) * weight));
    if (from instanceof Vector3i && to instanceof Vector3)
        return new Vector3i(Math.round(from.x + (to.x - from.x) * weight), Math.round(from.y + (to.y - from.y) * weight), Math.round(from.z + (to.z - from.z) * weight));
    if (from instanceof Vector2 && isVecLike(to))
        return from.lerp(to, weight);
    if (from instanceof Vector3 && isVecLike(to))
        return from.lerp(to, weight);
    if (from instanceof Vector4 && isVecLike(to))
        return from.lerp(to, weight);
    if (from instanceof Color && to instanceof Color)
        return from.lerp(to, weight);
    if (from instanceof Quaternion && to instanceof Quaternion)
        return from.slerp(to, weight);
    if (from instanceof Basis && to instanceof Basis)
        return from.slerp(to, weight);
    if (from instanceof Transform3D && to instanceof Transform3D)
        return from.interpolate_with(to, weight);
    if (isVecLike(from) && isVecLike(to))
        return new Vector3(from.x, from.y, from.z ?? 0).lerp(to, weight);
    return weight >= 1 ? to : from;
}
function relativeTarget(base: unknown, delta: unknown): unknown {
    return add(base, delta);
}
abstract class Tweener extends GodotObject {
    delay = 0;
    elapsed = 0;
    done = false;
    private readonly finishedSignal = new Signal(this, 'finished');
    constructor(protected readonly tween: Tween) {
        super({ entity: null, helix: tween.$helix, script: null });
    }
    get finished(): Signal {
        return this.finishedSignal;
    }
    abstract get duration(): number;
    advance(delta: number): number {
        if (this.done)
            return delta;
        this.elapsed += delta;
        const total = this.delay + this.duration;
        if (this.elapsed < this.delay)
            return 0;
        if (this.elapsed >= total) {
            this.apply(1);
            this.done = true;
            this.finishedSignal.emit();
            return this.elapsed - total;
        }
        this.apply(this.duration <= 0 ? 1 : (this.elapsed - this.delay) / this.duration);
        return 0;
    }
    reset(): void {
        this.elapsed = 0;
        this.done = false;
    }
    protected abstract apply(progress: number): void;
    set_delay(seconds: unknown): this {
        this.delay = Math.max(0, Number(seconds));
        return this;
    }
}
class PropertyTweener extends Tweener {
    private trans: number | null = null;
    private easing: number | null = null;
    private fromValue: unknown = undefined;
    private relative = false;
    private resolvedFrom: unknown = undefined;
    private resolvedTo: unknown = undefined;
    private started = false;
    constructor(tween: Tween, private readonly target: object, private readonly property: string, private readonly finalValue: unknown, private readonly seconds: number) {
        super(tween);
    }
    get duration(): number {
        return this.seconds;
    }
    from(value: unknown): this {
        this.fromValue = value;
        return this;
    }
    from_current(): this {
        this.fromValue = this.read();
        return this;
    }
    as_relative(): this {
        this.relative = true;
        return this;
    }
    set_trans(trans: unknown): this {
        this.trans = Number(trans);
        return this;
    }
    set_ease(easing: unknown): this {
        this.easing = Number(easing);
        return this;
    }
    private get path(): string[] {
        return this.property.split(/[:/]/).filter(Boolean);
    }
    private read(): unknown {
        let value: unknown = this.target;
        for (const part of this.path)
            value = dynamicGet(value, part);
        return value;
    }
    private write(value: unknown): void {
        const path = this.path;
        if (path.length === 1) {
            dynamicSet(this.target, path[0], value);
            return;
        }
        if (path.length === 2) {
            setChain(this.target, path[0], path[1], value);
            return;
        }
        let holder: unknown = this.target;
        for (let index = 0; index < path.length - 1; index++)
            holder = dynamicGet(holder, path[index]);
        dynamicSet(holder, path[path.length - 1], value);
    }
    reset(): void {
        super.reset();
        this.started = false;
    }
    protected apply(progress: number): void {
        if (!this.started) {
            this.started = true;
            this.resolvedFrom = this.fromValue === undefined ? this.read() : this.fromValue;
            this.resolvedTo = this.relative ? relativeTarget(this.resolvedFrom, this.finalValue) : this.finalValue;
        }
        const weight = ease(this.trans ?? this.tween.trans, this.easing ?? this.tween.easing, progress);
        this.write(interpolateValue(this.resolvedFrom, this.resolvedTo, weight));
    }
}
class IntervalTweener extends Tweener {
    constructor(tween: Tween, private readonly seconds: number) {
        super(tween);
    }
    get duration(): number {
        return this.seconds;
    }
    protected apply(): void { }
}
class CallbackTweener extends Tweener {
    constructor(tween: Tween, private readonly callable: Fn) {
        super(tween);
    }
    get duration(): number {
        return 0;
    }
    protected apply(progress: number): void {
        if (progress >= 1)
            invoke(this.callable, [], 'tween_callback');
    }
}
class MethodTweener extends Tweener {
    private trans: number | null = null;
    private easing: number | null = null;
    constructor(tween: Tween, private readonly callable: Fn, private readonly fromValue: unknown, private readonly toValue: unknown, private readonly seconds: number) {
        super(tween);
    }
    get duration(): number {
        return this.seconds;
    }
    set_trans(trans: unknown): this {
        this.trans = Number(trans);
        return this;
    }
    set_ease(easing: unknown): this {
        this.easing = Number(easing);
        return this;
    }
    protected apply(progress: number): void {
        const weight = ease(this.trans ?? this.tween.trans, this.easing ?? this.tween.easing, progress);
        invoke(this.callable, [interpolateValue(this.fromValue, this.toValue, weight)], 'tween_method');
    }
}
for (const [ctor, name] of [
    [PropertyTweener, 'PropertyTweener'],
    [IntervalTweener, 'IntervalTweener'],
    [CallbackTweener, 'CallbackTweener'],
    [MethodTweener, 'MethodTweener'],
] as const) {
    markScriptClass(ctor, name);
    setGodotBase(ctor, 'Tweener');
}
