import { lengthOf } from './methods';
import { Color, Dictionary, Vector2, Vector3, Vector4, describeTypeOf, fail, isEqualApprox, isScriptClass, isScriptInstance, isVecLike, makeVector, vectorArity, type VecLike } from './values';
import { TYPE_CONSTANTS, compare, str, toFloat, toInt, truthy, typeOf, typeString, varToStr } from './variant';
type Fn = (...args: unknown[]) => unknown;
function num(value: unknown, fn: string, what = 'o argumento'): number {
    if (typeof value !== 'number')
        fail(`${fn}(): ${what} precisa ser um número, recebeu ${describeTypeOf(value)}.`);
    return value;
}
function int(value: unknown, fn: string, what = 'o argumento'): number {
    if (typeof value !== 'number' || !Number.isInteger(value))
        fail(`${fn}(): ${what} precisa ser um int, recebeu ${describeTypeOf(value)}.`);
    return value;
}
let stateA = 0x9e3779b9;
let stateB = 0x243f6a88;
let stateC = 0xb7e15162;
let stateD = 0x6a09e667;
function reseed(seed: number): void {
    let value = (Math.trunc(seed) >>> 0) || 0x9e3779b9;
    const next = () => {
        value = (Math.imul(value ^ (value >>> 16), 0x45d9f3b) ^ 0xdeadbeef) >>> 0;
        value = (Math.imul(value ^ (value >>> 13), 0x27d4eb2d) + 0x165667b1) >>> 0;
        return value;
    };
    stateA = next();
    stateB = next();
    stateC = next();
    stateD = next();
}
function nextUint32(): number {
    const result = Math.imul(rotl(Math.imul(stateB, 5), 7), 9) >>> 0;
    const t = stateB << 9;
    stateC ^= stateA;
    stateD ^= stateB;
    stateB ^= stateC;
    stateA ^= stateD;
    stateC ^= t;
    stateD = rotl(stateD, 11);
    return result;
}
function rotl(value: number, shift: number): number {
    return ((value << shift) | (value >>> (32 - shift))) >>> 0;
}
function randomFloat(): number {
    return nextUint32() / 4294967296;
}
reseed((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0);
function lerpValue(from: unknown, to: unknown, weight: unknown): unknown {
    const t = num(weight, 'lerp', 'o peso');
    if (typeof from === 'number' && typeof to === 'number')
        return from + (to - from) * t;
    if (isVecLike(from) && isVecLike(to))
        return makeVector(vectorArity(from), from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t, (from.z ?? 0) + ((to.z ?? 0) - (from.z ?? 0)) * t, (from.w ?? 0) + ((to.w ?? 0) - (from.w ?? 0)) * t);
    if (from instanceof Color && to instanceof Color)
        return from.lerp(to, t);
    return fail(`lerp(): operandos incompatíveis ${describeTypeOf(from)} e ${describeTypeOf(to)}.`);
}
function wrapFloat(value: number, min: number, max: number): number {
    const range = max - min;
    if (range === 0)
        return min;
    const result = value - range * Math.floor((value - min) / range);
    return isEqualApprox(result, max) ? min : result;
}
function wrapInt(value: number, min: number, max: number): number {
    const range = max - min;
    if (range === 0)
        return min;
    return min + ((((value - min) % range) + range) % range);
}
function easeValue(x: number, curve: number): number {
    if (x < 0)
        x = 0;
    else if (x > 1)
        x = 1;
    if (curve > 0)
        return curve < 1 ? 1 - Math.pow(1 - x, 1 / curve) : Math.pow(x, curve);
    if (curve < 0)
        return x < 0.5 ? Math.pow(x * 2, -curve) * 0.5 : (1 - Math.pow(1 - (x - 0.5) * 2, -curve)) * 0.5 + 0.5;
    return 0;
}
function bezier(start: number, c1: number, c2: number, end: number, t: number): number {
    const omt = 1 - t;
    const omt2 = omt * omt;
    const omt3 = omt2 * omt;
    const t2 = t * t;
    const t3 = t2 * t;
    return start * omt3 + c1 * omt2 * t * 3 + c2 * omt * t2 * 3 + end * t3;
}
export const MATH: Record<string, Fn> = {
    abs: (x) => (typeof x === 'number' ? Math.abs(x) : isVecLike(x) ? makeVector(vectorArity(x), Math.abs(x.x), Math.abs(x.y), Math.abs(x.z ?? 0), Math.abs(x.w ?? 0)) : fail(`abs(): ${describeTypeOf(x)} não é um número.`)),
    absf: (x) => Math.abs(num(x, 'absf')),
    absi: (x) => Math.abs(int(x, 'absi')),
    sign: (x) => (typeof x === 'number' ? Math.sign(x) : isVecLike(x) ? makeVector(vectorArity(x), Math.sign(x.x), Math.sign(x.y), Math.sign(x.z ?? 0), Math.sign(x.w ?? 0)) : fail(`sign(): ${describeTypeOf(x)} não é um número.`)),
    signf: (x) => Math.sign(num(x, 'signf')),
    signi: (x) => Math.sign(int(x, 'signi')),
    floor: (x) => (typeof x === 'number' ? Math.floor(x) : isVecLike(x) ? makeVector(vectorArity(x), Math.floor(x.x), Math.floor(x.y), Math.floor(x.z ?? 0), Math.floor(x.w ?? 0)) : fail(`floor(): ${describeTypeOf(x)} não é um número.`)),
    floorf: (x) => Math.floor(num(x, 'floorf')),
    floori: (x) => Math.floor(num(x, 'floori')),
    ceil: (x) => (typeof x === 'number' ? Math.ceil(x) : isVecLike(x) ? makeVector(vectorArity(x), Math.ceil(x.x), Math.ceil(x.y), Math.ceil(x.z ?? 0), Math.ceil(x.w ?? 0)) : fail(`ceil(): ${describeTypeOf(x)} não é um número.`)),
    ceilf: (x) => Math.ceil(num(x, 'ceilf')),
    ceili: (x) => Math.ceil(num(x, 'ceili')),
    round: (x) => (typeof x === 'number' ? roundHalfAway(x) : isVecLike(x) ? makeVector(vectorArity(x), roundHalfAway(x.x), roundHalfAway(x.y), roundHalfAway(x.z ?? 0), roundHalfAway(x.w ?? 0)) : fail(`round(): ${describeTypeOf(x)} não é um número.`)),
    roundf: (x) => roundHalfAway(num(x, 'roundf')),
    roundi: (x) => roundHalfAway(num(x, 'roundi')),
    sqrt: (x) => Math.sqrt(num(x, 'sqrt')),
    pow: (base, exponent) => Math.pow(num(base, 'pow', 'a base'), num(exponent, 'pow', 'o expoente')),
    exp: (x) => Math.exp(num(x, 'exp')),
    log: (x) => Math.log(num(x, 'log')),
    sin: (x) => Math.sin(num(x, 'sin')),
    cos: (x) => Math.cos(num(x, 'cos')),
    tan: (x) => Math.tan(num(x, 'tan')),
    asin: (x) => Math.asin(num(x, 'asin')),
    acos: (x) => Math.acos(num(x, 'acos')),
    atan: (x) => Math.atan(num(x, 'atan')),
    atan2: (y, x) => Math.atan2(num(y, 'atan2', 'y'), num(x, 'atan2', 'x')),
    sinh: (x) => Math.sinh(num(x, 'sinh')),
    cosh: (x) => Math.cosh(num(x, 'cosh')),
    tanh: (x) => Math.tanh(num(x, 'tanh')),
    asinh: (x) => Math.asinh(num(x, 'asinh')),
    acosh: (x) => Math.acosh(num(x, 'acosh')),
    atanh: (x) => Math.atanh(num(x, 'atanh')),
    fmod: (a, b) => num(a, 'fmod') % num(b, 'fmod'),
    fposmod: (a, b) => {
        const x = num(a, 'fposmod');
        const y = num(b, 'fposmod');
        const value = x % y;
        return (value < 0 && y > 0) || (value > 0 && y < 0) ? value + y : value;
    },
    posmod: (a, b) => {
        const x = int(a, 'posmod');
        const y = int(b, 'posmod');
        if (y === 0)
            fail('posmod(): divisão por zero.');
        const value = x % y;
        return (value < 0 && y > 0) || (value > 0 && y < 0) ? value + y : value;
    },
    min: (...values) => {
        if (values.length === 0)
            fail('min(): precisa de pelo menos um argumento.');
        let best = values[0];
        for (const value of values)
            if (compare(value, best, 'min') < 0)
                best = value;
        return best;
    },
    max: (...values) => {
        if (values.length === 0)
            fail('max(): precisa de pelo menos um argumento.');
        let best = values[0];
        for (const value of values)
            if (compare(value, best, 'max') > 0)
                best = value;
        return best;
    },
    mini: (a, b) => Math.min(int(a, 'mini'), int(b, 'mini')),
    maxi: (a, b) => Math.max(int(a, 'maxi'), int(b, 'maxi')),
    minf: (a, b) => Math.min(num(a, 'minf'), num(b, 'minf')),
    maxf: (a, b) => Math.max(num(a, 'maxf'), num(b, 'maxf')),
    clamp: (value, min, max) => {
        if (typeof value === 'number')
            return Math.min(Math.max(value, num(min, 'clamp', 'o mínimo')), num(max, 'clamp', 'o máximo'));
        if (isVecLike(value) && isVecLike(min) && isVecLike(max))
            return makeVector(vectorArity(value), clampNumber(value.x, min.x, max.x), clampNumber(value.y, min.y, max.y), clampNumber(value.z ?? 0, min.z ?? 0, max.z ?? 0), clampNumber(value.w ?? 0, min.w ?? 0, max.w ?? 0));
        return fail(`clamp(): operandos incompatíveis ${describeTypeOf(value)}, ${describeTypeOf(min)} e ${describeTypeOf(max)}.`);
    },
    clampi: (value, min, max) => Math.min(Math.max(int(value, 'clampi'), int(min, 'clampi')), int(max, 'clampi')),
    clampf: (value, min, max) => Math.min(Math.max(num(value, 'clampf'), num(min, 'clampf')), num(max, 'clampf')),
    lerp: lerpValue,
    lerpf: (from, to, weight) => num(from, 'lerpf') + (num(to, 'lerpf') - num(from, 'lerpf')) * num(weight, 'lerpf'),
    lerp_angle: (from, to, weight) => {
        const a = num(from, 'lerp_angle');
        const b = num(to, 'lerp_angle');
        const difference = (b - a) % (Math.PI * 2);
        const distance = ((2 * difference) % (Math.PI * 2)) - difference;
        return a + distance * num(weight, 'lerp_angle');
    },
    inverse_lerp: (from, to, value) => (num(value, 'inverse_lerp') - num(from, 'inverse_lerp')) / (num(to, 'inverse_lerp') - num(from, 'inverse_lerp')),
    remap: (value, inFrom, inTo, outFrom, outTo) => {
        const t = (num(value, 'remap') - num(inFrom, 'remap')) / (num(inTo, 'remap') - num(inFrom, 'remap'));
        return num(outFrom, 'remap') + (num(outTo, 'remap') - num(outFrom, 'remap')) * t;
    },
    smoothstep: (from, to, value) => {
        const a = num(from, 'smoothstep');
        const b = num(to, 'smoothstep');
        const x = num(value, 'smoothstep');
        if (isEqualApprox(a, b))
            return x < a ? 0 : 1;
        const t = clampNumber((x - a) / (b - a), 0, 1);
        return t * t * (3 - 2 * t);
    },
    move_toward: (from, to, delta) => {
        const a = num(from, 'move_toward');
        const b = num(to, 'move_toward');
        const d = num(delta, 'move_toward');
        return Math.abs(b - a) <= d ? b : a + Math.sign(b - a) * d;
    },
    deg_to_rad: (x) => (num(x, 'deg_to_rad') * Math.PI) / 180,
    rad_to_deg: (x) => (num(x, 'rad_to_deg') * 180) / Math.PI,
    is_equal_approx: (a, b) => isEqualApprox(num(a, 'is_equal_approx'), num(b, 'is_equal_approx')),
    is_zero_approx: (x) => Math.abs(num(x, 'is_zero_approx')) < 0.00001,
    is_nan: (x) => Number.isNaN(x),
    is_inf: (x) => x === Infinity || x === -Infinity,
    is_finite: (x) => Number.isFinite(x),
    snapped: (value, step) => {
        if (typeof value === 'number') {
            const s = num(step, 'snapped', 'o passo');
            return s !== 0 ? Math.floor(value / s + 0.5) * s : value;
        }
        if (isVecLike(value) && isVecLike(step))
            return makeVector(vectorArity(value), snapNumber(value.x, step.x), snapNumber(value.y, step.y), snapNumber(value.z ?? 0, step.z ?? 0), snapNumber(value.w ?? 0, step.w ?? 0));
        return fail(`snapped(): operandos incompatíveis ${describeTypeOf(value)} e ${describeTypeOf(step)}.`);
    },
    snappedf: (value, step) => snapNumber(num(value, 'snappedf'), num(step, 'snappedf')),
    snappedi: (value, step) => snapNumber(num(value, 'snappedi'), int(step, 'snappedi')),
    wrap: (value, min, max) => (Number.isInteger(value) && Number.isInteger(min) && Number.isInteger(max) ? wrapInt(value as number, min as number, max as number) : wrapFloat(num(value, 'wrap'), num(min, 'wrap'), num(max, 'wrap'))),
    wrapf: (value, min, max) => wrapFloat(num(value, 'wrapf'), num(min, 'wrapf'), num(max, 'wrapf')),
    wrapi: (value, min, max) => wrapInt(int(value, 'wrapi'), int(min, 'wrapi'), int(max, 'wrapi')),
    pingpong: (value, length) => {
        const x = num(value, 'pingpong');
        const l = num(length, 'pingpong');
        if (l === 0)
            return 0;
        return l - Math.abs(wrapFloat(x, 0, l * 2) - l);
    },
    ease: (x, curve) => easeValue(num(x, 'ease'), num(curve, 'ease', 'a curva')),
    step_decimals: (x) => {
        const text = str(num(x, 'step_decimals'));
        const dot = text.indexOf('.');
        return dot === -1 ? 0 : Math.min(text.length - dot - 1, 9);
    },
    nearest_po2: (x) => {
        const value = int(x, 'nearest_po2');
        if (value <= 0)
            return 0;
        return 2 ** Math.ceil(Math.log2(value));
    },
    cubic_interpolate: (from, to, pre, post, weight) => {
        const t = num(weight, 'cubic_interpolate');
        const a = num(from, 'cubic_interpolate');
        const b = num(to, 'cubic_interpolate');
        const p = num(pre, 'cubic_interpolate');
        const q = num(post, 'cubic_interpolate');
        return 0.5 * (a * 2 + (-p + b) * t + (2 * p - 5 * a + 4 * b - q) * t * t + (-p + 3 * a - 3 * b + q) * t * t * t);
    },
    bezier_interpolate: (start, c1, c2, end, t) => bezier(num(start, 'bezier_interpolate'), num(c1, 'bezier_interpolate'), num(c2, 'bezier_interpolate'), num(end, 'bezier_interpolate'), num(t, 'bezier_interpolate')),
    bezier_derivative: (start, c1, c2, end, t) => {
        const x = num(t, 'bezier_derivative');
        const omt = 1 - x;
        return (num(c1, 'bezier_derivative') - num(start, 'bezier_derivative')) * 3 * omt * omt + (num(c2, 'bezier_derivative') - num(c1, 'bezier_derivative')) * 6 * omt * x + (num(end, 'bezier_derivative') - num(c2, 'bezier_derivative')) * 3 * x * x;
    },
    db_to_linear: (db) => Math.exp(num(db, 'db_to_linear') * 0.11512925464970228),
    linear_to_db: (linear) => Math.log(num(linear, 'linear_to_db')) * 8.685889638065037,
    angle_difference: (from, to) => {
        const difference = (num(to, 'angle_difference') - num(from, 'angle_difference')) % (Math.PI * 2);
        return ((2 * difference) % (Math.PI * 2)) - difference;
    },
    rotate_toward: (from, to, delta) => {
        const a = num(from, 'rotate_toward');
        const difference = MATH.angle_difference(a, to) as number;
        const d = num(delta, 'rotate_toward');
        return Math.abs(difference) <= d ? num(to, 'rotate_toward') : a + Math.sign(difference) * d;
    },
};
function roundHalfAway(value: number): number {
    return value < 0 ? -Math.round(-value) : Math.round(value);
}
function clampNumber(value: number, min: number, max: number): number {
    return value < min ? min : value > max ? max : value;
}
function snapNumber(value: number, step: number): number {
    return step !== 0 ? Math.floor(value / step + 0.5) * step : value;
}
export const RANDOM: Record<string, Fn> = {
    randi: () => nextUint32(),
    randf: () => randomFloat(),
    randf_range: (from, to) => num(from, 'randf_range') + randomFloat() * (num(to, 'randf_range') - num(from, 'randf_range')),
    randi_range: (from, to) => {
        const low = int(from, 'randi_range');
        const high = int(to, 'randi_range');
        const min = Math.min(low, high);
        const max = Math.max(low, high);
        return min + (nextUint32() % (max - min + 1));
    },
    randfn: (mean = 0, deviation = 1) => {
        const u = randomFloat() || 1e-12;
        const v = randomFloat();
        return num(mean, 'randfn') + num(deviation, 'randfn') * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
    randomize: () => {
        reseed((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0);
        return null;
    },
    seed: (value) => {
        reseed(int(value, 'seed'));
        return null;
    },
    rand_from_seed: (value) => {
        const saved = [stateA, stateB, stateC, stateD];
        reseed(int(value, 'rand_from_seed'));
        const result = nextUint32();
        const nextSeed = nextUint32();
        [stateA, stateB, stateC, stateD] = saved;
        return [result, nextSeed];
    },
};
export const UTIL: Record<string, Fn> = {
    str: (...values) => values.map((value) => str(value)).join(''),
    len: (value) => lengthOf(value),
    typeof: (value) => typeOf(value),
    type_string: (code) => typeString(code),
    type_convert: (value, type) => {
        switch (type) {
            case TYPE_CONSTANTS.TYPE_INT:
                return toInt(value);
            case TYPE_CONSTANTS.TYPE_FLOAT:
                return toFloat(value);
            case TYPE_CONSTANTS.TYPE_STRING:
                return str(value);
            case TYPE_CONSTANTS.TYPE_BOOL:
                return truthy(value);
            default:
                return value;
        }
    },
    var_to_str: (value) => varToStr(value),
    str_to_var: (text) => {
        if (typeof text !== 'string')
            fail(`str_to_var(): esperava uma String, recebeu ${describeTypeOf(text)}.`);
        return parseVariant(text);
    },
    var_to_bytes: (value) => Array.from(new TextEncoder().encode(varToStr(value))),
    bytes_to_var: (bytes) => parseVariant(new TextDecoder().decode(Uint8Array.from(bytes as number[]))),
    hash: (value) => {
        const text = str(value);
        let hash = 5381;
        for (let index = 0; index < text.length; index++)
            hash = ((hash << 5) + hash + text.charCodeAt(index)) >>> 0;
        return hash;
    },
    is_instance_valid: (value) => value !== null && value !== undefined && !(isScriptInstance(value) && (value as {
        __gdFreed?: boolean;
    }).__gdFreed === true),
    is_instance_of: (value, type) => (typeof type === 'function' ? value instanceof type : typeOf(value) === type),
    is_same: (a, b) => a === b || (typeof a === 'number' && typeof b === 'number' && Number.isNaN(a) && Number.isNaN(b)),
    weakref: (value) => ({ get_ref: () => value }),
    instance_from_id: () => fail('instance_from_id() não existe aqui: guarde a referência ao objeto (ou use helix.scene.byId para atores).'),
    range: (...args) => {
        let start = 0;
        let stop: number;
        let step = 1;
        if (args.length === 1)
            stop = int(args[0], 'range');
        else if (args.length === 2) {
            start = int(args[0], 'range');
            stop = int(args[1], 'range');
        }
        else if (args.length === 3) {
            start = int(args[0], 'range');
            stop = int(args[1], 'range');
            step = int(args[2], 'range');
            if (step === 0)
                fail('range(): o passo não pode ser 0.');
        }
        else
            fail(`range(): esperava 1 a 3 argumentos, recebeu ${args.length}.`);
        const result: number[] = [];
        if (step > 0)
            for (let value = start; value < stop; value += step)
                result.push(value);
        else
            for (let value = start; value > stop; value += step)
                result.push(value);
        return result;
    },
    int: (value) => toInt(value),
    float: (value) => toFloat(value),
    bool: (value) => truthy(value),
    String: (value = '') => str(value),
    StringName: (value = '') => str(value),
    NodePath: (value = '') => str(value),
    Array: (value = null) => (value === null ? [] : Array.isArray(value) ? value.slice() : Array.from(iterable(value))),
    Dictionary: (value = null) => new Dictionary(value ?? undefined),
    PackedByteArray: (value = null) => (value === null ? [] : Array.from(value as Iterable<number>, (item) => toInt(item) & 255)),
    PackedInt32Array: (value = null) => (value === null ? [] : Array.from(value as Iterable<number>, (item) => toInt(item) | 0)),
    PackedInt64Array: (value = null) => (value === null ? [] : Array.from(value as Iterable<number>, (item) => toInt(item))),
    PackedFloat32Array: (value = null) => (value === null ? [] : Array.from(value as Iterable<number>, (item) => Math.fround(toFloat(item)))),
    PackedFloat64Array: (value = null) => (value === null ? [] : Array.from(value as Iterable<number>, (item) => toFloat(item))),
    PackedStringArray: (value = null) => (value === null ? [] : Array.from(value as Iterable<unknown>, (item) => str(item))),
    PackedVector2Array: (value = null) => (value === null ? [] : Array.from(value as Iterable<unknown>, (item) => new Vector2(item))),
    PackedVector3Array: (value = null) => (value === null ? [] : Array.from(value as Iterable<unknown>, (item) => new Vector3(item))),
    PackedVector4Array: (value = null) => (value === null ? [] : Array.from(value as Iterable<unknown>, (item) => new Vector4(item))),
    PackedColorArray: (value = null) => (value === null ? [] : Array.from(value as Iterable<unknown>, (item) => new Color(item))),
    Callable: (object = null, method = null) => {
        if (object === null)
            return () => null;
        if (typeof method !== 'string')
            fail('Callable(objeto, "metodo"): o segundo argumento é o nome do método.');
        const target = object as Record<string, unknown>;
        const fn = target[method];
        if (typeof fn !== 'function')
            fail(`Callable(): o método "${method}" não existe em ${describeTypeOf(object)}.`);
        return (...args: unknown[]) => (fn as Fn).apply(object, args);
    },
    get_stack: () => [],
    print_stack: () => null,
    print_debug: () => null,
    error_string: (code) => `Erro ${str(code)}`,
    load: () => fail('load() precisa do contexto do script; o compilador o substitui por require/helix.assets.'),
    preload: () => fail('preload() precisa do contexto do script; o compilador o substitui por require/helix.assets.'),
};
function iterable(value: unknown): Iterable<unknown> {
    if (typeof value === 'string')
        return Array.from(value);
    if (value instanceof Dictionary)
        return value.keys();
    if (value !== null && typeof value === 'object' && Symbol.iterator in (value as object))
        return value as Iterable<unknown>;
    return fail(`Array(): não é possível converter ${describeTypeOf(value)} em lista.`);
}
function parseVariant(text: string): unknown {
    const trimmed = text.trim();
    const vector = /^(Vector2|Vector3|Vector4|Color|Quaternion)\s*\(([^)]*)\)$/.exec(trimmed);
    if (vector) {
        const parts = vector[2].split(',').map((part) => parseFloat(part.trim()));
        switch (vector[1]) {
            case 'Vector2':
                return new Vector2(parts[0], parts[1]);
            case 'Vector3':
                return new Vector3(parts[0], parts[1], parts[2]);
            case 'Vector4':
                return new Vector4(parts[0], parts[1], parts[2], parts[3]);
            case 'Color':
                return new Color(parts[0], parts[1], parts[2], parts[3] ?? 1);
            default:
                return parts;
        }
    }
    try {
        return fromJson(JSON.parse(trimmed));
    }
    catch {
        return null;
    }
}
export function fromJson(value: unknown): unknown {
    if (Array.isArray(value))
        return value.map((item) => fromJson(item));
    if (value !== null && typeof value === 'object') {
        const dictionary = new Dictionary();
        for (const [key, entry] of Object.entries(value as Record<string, unknown>))
            dictionary.set(key, fromJson(entry));
        return dictionary;
    }
    return value;
}
export function toJson(value: unknown): unknown {
    if (value === undefined)
        return null;
    if (Array.isArray(value))
        return value.map((item) => toJson(item));
    if (value instanceof Dictionary) {
        const object: Record<string, unknown> = {};
        for (const [key, entry] of value)
            object[str(key)] = toJson(entry);
        return object;
    }
    if (isVecLike(value) || value instanceof Color)
        return str(value);
    if (ArrayBuffer.isView(value))
        return Array.from(value as unknown as ArrayLike<number>);
    if (value !== null && typeof value === 'object' && !isScriptInstance(value)) {
        const proto = Object.getPrototypeOf(value);
        if (proto === Object.prototype || proto === null) {
            const object: Record<string, unknown> = {};
            for (const [key, entry] of Object.entries(value as Record<string, unknown>))
                object[key] = toJson(entry);
            return object;
        }
    }
    if (typeof value === 'function' || isScriptInstance(value))
        return str(value);
    return value;
}
export const JSON_CLASS = {
    stringify: (value: unknown, indent: unknown = '', sortKeys: unknown = true, fullPrecision: unknown = false): string => {
        void fullPrecision;
        const plain = toJson(value);
        const sorted = truthy(sortKeys) ? sortKeysDeep(plain) : plain;
        return JSON.stringify(sorted, null, typeof indent === 'string' ? indent : '') ?? 'null';
    },
    parse_string: (text: unknown): unknown => {
        if (typeof text !== 'string')
            fail(`JSON.parse_string(): esperava uma String, recebeu ${describeTypeOf(text)}.`);
        try {
            return fromJson(JSON.parse(text));
        }
        catch {
            return null;
        }
    },
    from_native: (value: unknown) => toJson(value),
    to_native: (value: unknown) => fromJson(value),
};
function sortKeysDeep(value: unknown): unknown {
    if (Array.isArray(value))
        return value.map((item) => sortKeysDeep(item));
    if (value !== null && typeof value === 'object') {
        const object = value as Record<string, unknown>;
        const sorted: Record<string, unknown> = {};
        for (const key of Object.keys(object).sort())
            sorted[key] = sortKeysDeep(object[key]);
        return sorted;
    }
    return value;
}
export const CONSTANTS: Record<string, unknown> = {
    PI: Math.PI,
    TAU: Math.PI * 2,
    INF: Infinity,
    NAN: NaN,
    ...TYPE_CONSTANTS,
    OK: 0,
    FAILED: 1,
    ERR_UNAVAILABLE: 2,
    ERR_UNCONFIGURED: 3,
    ERR_INVALID_PARAMETER: 31,
    ERR_DOES_NOT_EXIST: 25,
    CONNECT_DEFERRED: 1,
    CONNECT_PERSIST: 2,
    CONNECT_ONE_SHOT: 4,
    CONNECT_REFERENCE_COUNTED: 8,
    MOUSE_BUTTON_NONE: 0,
    MOUSE_BUTTON_LEFT: 1,
    MOUSE_BUTTON_RIGHT: 2,
    MOUSE_BUTTON_MIDDLE: 3,
    MOUSE_BUTTON_WHEEL_UP: 4,
    MOUSE_BUTTON_WHEEL_DOWN: 5,
    PROPERTY_HINT_NONE: 0,
    PROPERTY_HINT_RANGE: 1,
    PROPERTY_HINT_ENUM: 2,
    SIDE_LEFT: 0,
    SIDE_TOP: 1,
    SIDE_RIGHT: 2,
    SIDE_BOTTOM: 3,
    HORIZONTAL: 0,
    VERTICAL: 1,
    CLOCKWISE: 0,
    COUNTERCLOCKWISE: 1,
};
export const KEY_CODES: Record<string, string> = {
    KEY_SPACE: 'Space',
    KEY_ENTER: 'Enter',
    KEY_KP_ENTER: 'NumpadEnter',
    KEY_ESCAPE: 'Escape',
    KEY_TAB: 'Tab',
    KEY_BACKSPACE: 'Backspace',
    KEY_DELETE: 'Delete',
    KEY_INSERT: 'Insert',
    KEY_HOME: 'Home',
    KEY_END: 'End',
    KEY_PAGEUP: 'PageUp',
    KEY_PAGEDOWN: 'PageDown',
    KEY_LEFT: 'ArrowLeft',
    KEY_RIGHT: 'ArrowRight',
    KEY_UP: 'ArrowUp',
    KEY_DOWN: 'ArrowDown',
    KEY_SHIFT: 'ShiftLeft',
    KEY_CTRL: 'ControlLeft',
    KEY_ALT: 'AltLeft',
    KEY_META: 'MetaLeft',
    KEY_CAPSLOCK: 'CapsLock',
    KEY_MINUS: 'Minus',
    KEY_EQUAL: 'Equal',
    KEY_COMMA: 'Comma',
    KEY_PERIOD: 'Period',
    KEY_SLASH: 'Slash',
    KEY_BACKSLASH: 'Backslash',
    KEY_SEMICOLON: 'Semicolon',
    KEY_APOSTROPHE: 'Quote',
    KEY_BRACKETLEFT: 'BracketLeft',
    KEY_BRACKETRIGHT: 'BracketRight',
    KEY_QUOTELEFT: 'Backquote',
};
for (let code = 65; code <= 90; code++)
    KEY_CODES[`KEY_${String.fromCharCode(code)}`] = `Key${String.fromCharCode(code)}`;
for (let digit = 0; digit <= 9; digit++) {
    KEY_CODES[`KEY_${digit}`] = `Digit${digit}`;
    KEY_CODES[`KEY_KP_${digit}`] = `Numpad${digit}`;
}
for (let fn = 1; fn <= 12; fn++)
    KEY_CODES[`KEY_F${fn}`] = `F${fn}`;
export interface ConsoleLike {
    log(...args: unknown[]): void;
    info(...args: unknown[]): void;
    warn(...args: unknown[]): void;
    error(...args: unknown[]): void;
}
const BBCODE = /\[\/?(?:b|i|u|s|code|color|bgcolor|fgcolor|url|center|right|left|fill|indent|font|font_size|img|p|table|cell|ul|ol|wave|tornado|shake|fade|rainbow|pulse|outline_size|outline_color|lb|rb)(?:=[^\]]*)?\]/g;
export function io(console: ConsoleLike) {
    return {
        print: (...parts: string[]) => console.log(parts.join('')),
        prints: (...parts: string[]) => console.log(parts.join(' ')),
        printt: (...parts: string[]) => console.log(parts.join('\t')),
        printraw: (...parts: string[]) => console.log(parts.join('')),
        print_rich: (...parts: string[]) => console.log(parts.join('').replace(BBCODE, '')),
        printerr: (...parts: string[]) => console.error(parts.join('')),
        push_error: (...parts: string[]) => console.error(parts.join('')),
        push_warning: (...parts: string[]) => console.warn(parts.join('')),
        print_verbose: (...parts: string[]) => console.info(parts.join('')),
    };
}
export const IO_NAMES: readonly string[] = ['print', 'prints', 'printt', 'printraw', 'print_rich', 'printerr', 'push_error', 'push_warning', 'print_verbose'];
export const GLOBAL_FUNCTIONS: Record<string, Fn> = { ...MATH, ...RANDOM, ...UTIL };
export function isGlobalClass(value: unknown): boolean {
    return isScriptClass(value);
}
export { TYPE_CONSTANTS };
export type { VecLike };
