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
export class Tween extends GodotObject {
    static readonly TRANS_LINEAR = TRANS.LINEAR;
    static readonly TRANS_SINE = TRANS.SINE;
    static readonly TRANS_QUINT = TRANS.QUINT;
    static readonly TRANS_QUART = TRANS.QUART;
    static readonly TRANS_QUAD = TRANS.QUAD;
    static readonly TRANS_EXPO = TRANS.EXPO;
    static readonly TRANS_ELASTIC = TRANS.ELASTIC;
    static readonly TRANS_CUBIC = TRANS.CUBIC;
    static readonly TRANS_CIRC = TRANS.CIRC;
    static readonly TRANS_BOUNCE = TRANS.BOUNCE;
    static readonly TRANS_BACK = TRANS.BACK;
    static readonly TRANS_SPRING = TRANS.SPRING;
    static readonly EASE_IN = EASE.IN;
    static readonly EASE_OUT = EASE.OUT;
    static readonly EASE_IN_OUT = EASE.IN_OUT;
    static readonly EASE_OUT_IN = EASE.OUT_IN;
    static readonly TWEEN_PROCESS_PHYSICS = 0;
    static readonly TWEEN_PROCESS_IDLE = 1;
    static readonly TWEEN_PAUSE_BOUND = 0;
    static readonly TWEEN_PAUSE_STOP = 1;
    static readonly TWEEN_PAUSE_PROCESS = 2;
    trans: number = TRANS.LINEAR;
    easing: number = EASE.IN_OUT;
    private steps: Tweener[][] = [];
    private stepIndex = 0;
    private parallelDefault = false;
    private nextParallel = false;
    private loops = 1;
    private loopsDone = 0;
    private speed = 1;
    private running = true;
    private valid = true;
    private startedOnce = false;
    private boundNode: {
        $freed: boolean;
    } | null;
    private readonly signals = { finished: new Signal(this, 'finished'), step_finished: new Signal(this, 'step_finished'), loop_finished: new Signal(this, 'loop_finished') };
    constructor(readonly $game: GameContext, bound: {
        $freed: boolean;
    } | null = null) {
        super({ entity: null, helix: $game.helix, script: null });
        this.boundNode = bound;
        $game.tweens.add(this);
    }
    get finished(): Signal {
        return this.signals.finished;
    }
    get step_finished(): Signal {
        return this.signals.step_finished;
    }
    get loop_finished(): Signal {
        return this.signals.loop_finished;
    }
    private requireValid(where: string): void {
        if (!this.valid)
            fail(`Tween.${where}(): este Tween já foi encerrado (kill) ou terminou; crie outro com create_tween().`);
    }
    private push(tweener: Tweener): void {
        const parallel = this.parallelDefault || this.nextParallel;
        this.nextParallel = false;
        if (parallel && this.steps.length > 0)
            this.steps[this.steps.length - 1].push(tweener);
        else
            this.steps.push([tweener]);
    }
    tween_property(object: unknown, property: unknown, finalValue: unknown, duration: unknown): PropertyTweener {
        this.requireValid('tween_property');
        if (object === null || typeof object !== 'object')
            fail(`Tween.tween_property(): o alvo precisa ser um objeto, recebeu ${object === null ? 'null' : typeof object}.`);
        if (typeof property !== 'string' || property.length === 0)
            fail('Tween.tween_property(): a propriedade precisa ser um NodePath/String como "position" ou "position:x".');
        const tweener = new PropertyTweener(this, object, property.startsWith(':') ? property.slice(1) : property, finalValue, Math.max(0, Number(duration)));
        this.push(tweener);
        return tweener;
    }
    tween_interval(seconds: unknown): IntervalTweener {
        this.requireValid('tween_interval');
        const tweener = new IntervalTweener(this, Math.max(0, Number(seconds)));
        this.push(tweener);
        return tweener;
    }
    tween_callback(callable: unknown): CallbackTweener {
        this.requireValid('tween_callback');
        if (typeof callable !== 'function')
            fail('Tween.tween_callback(): esperava um Callable (obj.metodo ou func).');
        const tweener = new CallbackTweener(this, callable as Fn);
        this.push(tweener);
        return tweener;
    }
    tween_method(callable: unknown, from: unknown, to: unknown, duration: unknown): MethodTweener {
        this.requireValid('tween_method');
        if (typeof callable !== 'function')
            fail('Tween.tween_method(): esperava um Callable (obj.metodo ou func).');
        const tweener = new MethodTweener(this, callable as Fn, from, to, Math.max(0, Number(duration)));
        this.push(tweener);
        return tweener;
    }
    set_parallel(parallel: unknown = true): this {
        this.parallelDefault = Boolean(parallel);
        return this;
    }
    parallel(): this {
        this.nextParallel = true;
        return this;
    }
    chain(): this {
        this.nextParallel = false;
        this.parallelDefault = false;
        return this;
    }
    set_loops(loops: unknown = 0): this {
        const count = Number(loops);
        this.loops = count <= 0 ? Infinity : Math.floor(count);
        return this;
    }
    get_loops_left(): number {
        return this.loops === Infinity ? -1 : Math.max(0, this.loops - this.loopsDone);
    }
    set_trans(trans: unknown): this {
        this.trans = Number(trans);
        return this;
    }
    set_ease(easing: unknown): this {
        this.easing = Number(easing);
        return this;
    }
    set_speed_scale(speed: unknown): this {
        this.speed = Math.max(0, Number(speed));
        return this;
    }
    set_process_mode(_mode: unknown): this {
        return this;
    }
    set_pause_mode(_mode: unknown): this {
        return this;
    }
    set_ignore_time_scale(_ignore: unknown = true): this {
        return this;
    }
    bind_node(node: unknown): this {
        if (node !== null && typeof node === 'object' && '$freed' in node)
            this.boundNode = node as {
                $freed: boolean;
            };
        return this;
    }
    get_total_elapsed_time(): number {
        return this.totalElapsed;
    }
    private totalElapsed = 0;
    pause(): void {
        this.running = false;
    }
    play(): void {
        this.requireValid('play');
        this.running = true;
    }
    stop(): void {
        this.running = false;
        this.stepIndex = 0;
        this.loopsDone = 0;
        this.totalElapsed = 0;
        for (const step of this.steps)
            for (const tweener of step)
                tweener.reset();
    }
    kill(): void {
        this.valid = false;
        this.running = false;
        this.$game.tweens.delete(this);
    }
    is_running(): boolean {
        return this.valid && this.running;
    }
    is_valid(): boolean {
        return this.valid;
    }
    custom_step(delta: unknown): boolean {
        return this.step(Number(delta));
    }
    step(delta: number): boolean {
        if (!this.valid)
            return false;
        if (this.boundNode?.$freed) {
            this.kill();
            return false;
        }
        if (!this.running)
            return true;
        if (this.steps.length === 0) {
            if (this.startedOnce)
                return true;
            this.startedOnce = true;
            this.finish();
            return false;
        }
        this.startedOnce = true;
        let remaining = delta * this.speed;
        this.totalElapsed += remaining;
        while (remaining > 0 || this.currentStepDone()) {
            const step = this.steps[this.stepIndex];
            let leftover = Infinity;
            for (const tweener of step)
                leftover = Math.min(leftover, tweener.advance(remaining));
            if (!this.currentStepDone())
                return true;
            this.signals.step_finished.emit(this.stepIndex);
            this.stepIndex++;
            remaining = leftover === Infinity ? 0 : leftover;
            if (this.stepIndex >= this.steps.length) {
                this.loopsDone++;
                this.signals.loop_finished.emit(this.loopsDone - 1);
                if (this.loopsDone >= this.loops) {
                    this.finish();
                    return false;
                }
                this.stepIndex = 0;
                for (const inner of this.steps)
                    for (const tweener of inner)
                        tweener.reset();
                if (remaining <= 0)
                    return true;
            }
            if (!this.valid)
                return false;
        }
        return true;
    }
    private currentStepDone(): boolean {
        const step = this.steps[this.stepIndex];
        return step !== undefined && step.every((tweener) => tweener.done);
    }
    private finish(): void {
        this.valid = false;
        this.running = false;
        this.$game.tweens.delete(this);
        this.signals.finished.emit();
    }
}
markScriptClass(Tween, 'Tween');
setGodotBase(Tween, 'Tween');
