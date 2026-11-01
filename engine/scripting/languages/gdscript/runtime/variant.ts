import { AABB, Basis, Color, Dictionary, GDScriptError, Quaternion, Rect2, Signal, Transform3D, Vector2, Vector2i, Vector3, Vector3i, Vector4, callableMeta, describeTypeOf, fail, isScriptClass, isScriptInstance, isVecLike, makeVector, scriptClassName, vectorArity, type VecLike } from './values';
export type Operand = unknown;
function invalidOperands(op: string, a: unknown, b: unknown): never {
    return fail(`Operandos inválidos "${describeTypeOf(a)}" e "${describeTypeOf(b)}" no operador "${op}".`);
}
export function truthy(value: unknown): boolean {
    if (value === null || value === undefined || value === false)
        return false;
    if (value === true)
        return true;
    switch (typeof value) {
        case 'number':
            return value !== 0;
        case 'string':
            return value.length > 0;
        case 'object':
            if (Array.isArray(value))
                return value.length > 0;
            if (value instanceof Dictionary)
                return value.size > 0;
            if (isVecLike(value))
                return value.x !== 0 || value.y !== 0 || (value.z ?? 0) !== 0 || (value.w ?? 0) !== 0;
            return true;
        default:
            return true;
    }
}
export function eq(a: unknown, b: unknown): boolean {
    if (a === b)
        return true;
    if (a === null || a === undefined)
        return b === null || b === undefined;
    if (b === null || b === undefined)
        return false;
    const typeA = typeof a;
    if (typeA !== 'object' || typeof b !== 'object') {
        if (typeA === 'function' && typeof b === 'function') {
            const metaA = callableMeta(a);
            const metaB = callableMeta(b);
            return metaA !== null && metaB !== null && metaA.object === metaB.object && metaA.method === metaB.method;
        }
        return false;
    }
    if (Array.isArray(a)) {
        if (!Array.isArray(b) || a.length !== b.length)
            return false;
        for (let index = 0; index < a.length; index++)
            if (!eq(a[index], b[index]))
                return false;
        return true;
    }
    if (a instanceof Dictionary) {
        if (!(b instanceof Dictionary) || a.size !== b.size)
            return false;
        for (const [key, value] of a)
            if (!b.has(key) || !eq(value, b.get(key)))
                return false;
        return true;
    }
    if (isVecLike(a) && isVecLike(b))
        return a.x === b.x && a.y === b.y && (a.z ?? 0) === (b.z ?? 0) && (a.w ?? 0) === (b.w ?? 0);
    if (a instanceof Color && b instanceof Color)
        return a.r === b.r && a.g === b.g && a.b === b.b && a.a === b.a;
    if (a instanceof Quaternion && b instanceof Quaternion)
        return a.x === b.x && a.y === b.y && a.z === b.z && a.w === b.w;
    if (a instanceof Rect2 && b instanceof Rect2)
        return eq(a.position, b.position) && eq(a.size, b.size);
    if (a instanceof AABB && b instanceof AABB)
        return eq(a.position, b.position) && eq(a.size, b.size);
    if (a instanceof Basis && b instanceof Basis)
        return eq(a.x, b.x) && eq(a.y, b.y) && eq(a.z, b.z);
    if (a instanceof Transform3D && b instanceof Transform3D)
        return eq(a.basis, b.basis) && eq(a.origin, b.origin);
    if (ArrayBuffer.isView(a) && ArrayBuffer.isView(b)) {
        const left = a as unknown as ArrayLike<number>;
        const right = b as unknown as ArrayLike<number>;
        if (left.length !== right.length)
            return false;
        for (let index = 0; index < left.length; index++)
            if (left[index] !== right[index])
                return false;
        return true;
    }
    return false;
}
export function ne(a: unknown, b: unknown): boolean {
    return !eq(a, b);
}
export function compare(a: unknown, b: unknown, op: string): number {
    if (typeof a === 'number' && typeof b === 'number')
        return a < b ? -1 : a > b ? 1 : 0;
    if (typeof a === 'string' && typeof b === 'string')
        return a < b ? -1 : a > b ? 1 : 0;
    if (typeof a === 'boolean' && typeof b === 'boolean')
        return Number(a) - Number(b);
    if (isVecLike(a) && isVecLike(b)) {
        if (a.x !== b.x)
            return a.x < b.x ? -1 : 1;
        if (a.y !== b.y)
            return a.y < b.y ? -1 : 1;
        const az = a.z ?? 0;
        const bz = b.z ?? 0;
        if (az !== bz)
            return az < bz ? -1 : 1;
        const aw = a.w ?? 0;
        const bw = b.w ?? 0;
        return aw === bw ? 0 : aw < bw ? -1 : 1;
    }
    if (Array.isArray(a) && Array.isArray(b)) {
        const length = Math.min(a.length, b.length);
        for (let index = 0; index < length; index++) {
            const result = compare(a[index], b[index], op);
            if (result !== 0)
                return result;
        }
        return a.length - b.length;
    }
    if ((a === null || a === undefined) && (b === null || b === undefined))
        return 0;
    if (a === null || a === undefined)
        return -1;
    if (b === null || b === undefined)
        return 1;
    return invalidOperands(op, a, b);
}
export function lt(a: unknown, b: unknown): boolean {
    return compare(a, b, '<') < 0;
}
export function gt(a: unknown, b: unknown): boolean {
    return compare(a, b, '>') > 0;
}
export function le(a: unknown, b: unknown): boolean {
    return compare(a, b, '<=') <= 0;
}
export function ge(a: unknown, b: unknown): boolean {
    return compare(a, b, '>=') >= 0;
}
export function add(a: unknown, b: unknown): unknown {
    if (typeof a === 'number' && typeof b === 'number')
        return a + b;
    if (typeof a === 'string' && typeof b === 'string')
        return a + b;
    if (isVecLike(a) && isVecLike(b)) {
        const arity = vectorArity(a);
        return makeVector(arity, a.x + b.x, a.y + b.y, (a.z ?? 0) + (b.z ?? 0), (a.w ?? 0) + (b.w ?? 0));
    }
    if (Array.isArray(a) && Array.isArray(b))
        return [...a, ...b];
    if (a instanceof Color && b instanceof Color)
        return new Color(a.r + b.r, a.g + b.g, a.b + b.b, a.a + b.a);
    if (a instanceof Quaternion && b instanceof Quaternion)
        return new Quaternion(a.x + b.x, a.y + b.y, a.z + b.z, a.w + b.w);
    return invalidOperands('+', a, b);
}
export function sub(a: unknown, b: unknown): unknown {
    if (typeof a === 'number' && typeof b === 'number')
        return a - b;
    if (isVecLike(a) && isVecLike(b))
        return makeVector(vectorArity(a), a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0), (a.w ?? 0) - (b.w ?? 0));
    if (a instanceof Color && b instanceof Color)
        return new Color(a.r - b.r, a.g - b.g, a.b - b.b, a.a - b.a);
    if (a instanceof Quaternion && b instanceof Quaternion)
        return new Quaternion(a.x - b.x, a.y - b.y, a.z - b.z, a.w - b.w);
    return invalidOperands('-', a, b);
}
export function mul(a: unknown, b: unknown): unknown {
    if (typeof a === 'number') {
        if (typeof b === 'number')
            return a * b;
        if (isVecLike(b))
            return makeVector(vectorArity(b), b.x * a, b.y * a, (b.z ?? 0) * a, (b.w ?? 0) * a);
        if (b instanceof Color)
            return new Color(b.r * a, b.g * a, b.b * a, b.a * a);
        if (b instanceof Quaternion)
            return new Quaternion(b.x * a, b.y * a, b.z * a, b.w * a);
    }
    if (isVecLike(a)) {
        if (typeof b === 'number')
            return makeVector(vectorArity(a), a.x * b, a.y * b, (a.z ?? 0) * b, (a.w ?? 0) * b);
        if (isVecLike(b))
            return makeVector(vectorArity(a), a.x * b.x, a.y * b.y, (a.z ?? 0) * (b.z ?? 0), (a.w ?? 0) * (b.w ?? 0));
    }
    if (a instanceof Color) {
        if (typeof b === 'number')
            return new Color(a.r * b, a.g * b, a.b * b, a.a * b);
        if (b instanceof Color)
            return new Color(a.r * b.r, a.g * b.g, a.b * b.b, a.a * b.a);
    }
    if (a instanceof Quaternion) {
        if (b instanceof Quaternion)
            return a.multiply(b);
        if (isVecLike(b))
            return a.xform(b);
        if (typeof b === 'number')
            return new Quaternion(a.x * b, a.y * b, a.z * b, a.w * b);
    }
    if (a instanceof Basis) {
        if (b instanceof Basis)
            return a.multiply(b);
        if (isVecLike(b))
            return a.xform(b);
    }
    if (a instanceof Transform3D) {
        if (b instanceof Transform3D)
            return a.multiply(b);
        if (isVecLike(b))
            return a.xform(b);
    }
    return invalidOperands('*', a, b);
}
export function idiv(a: number, b: number): number {
    if (b === 0)
        fail('Divisão por zero no operador "/".');
    return Math.trunc(a / b);
}
export function div(a: unknown, b: unknown): unknown {
    if (typeof a === 'number' && typeof b === 'number')
        return a / b;
    if (isVecLike(a)) {
        if (typeof b === 'number')
            return makeVector(vectorArity(a), a.x / b, a.y / b, (a.z ?? 0) / b, (a.w ?? 0) / b);
        if (isVecLike(b))
            return makeVector(vectorArity(a), a.x / b.x, a.y / b.y, (a.z ?? 0) / (b.z ?? 1), (a.w ?? 0) / (b.w ?? 1));
    }
    if (a instanceof Color) {
        if (typeof b === 'number')
            return new Color(a.r / b, a.g / b, a.b / b, a.a / b);
        if (b instanceof Color)
            return new Color(a.r / b.r, a.g / b.g, a.b / b.b, a.a / b.a);
    }
    if (a instanceof Quaternion && typeof b === 'number')
        return new Quaternion(a.x / b, a.y / b, a.z / b, a.w / b);
    return invalidOperands('/', a, b);
}
export function imod(a: number, b: number): number {
    if (b === 0)
        fail('Divisão por zero no operador "%".');
    return a % b;
}
export function mod(a: unknown, b: unknown): unknown {
    if (typeof a === 'string')
        return format(a, b);
    if (typeof a === 'number' && typeof b === 'number') {
        if (!Number.isInteger(a) || !Number.isInteger(b))
            fail(`O operador "%" só aceita inteiros (recebeu ${describeTypeOf(a)} e ${describeTypeOf(b)}); para float use fmod() ou fposmod().`);
        return imod(a, b);
    }
    if (isVecLike(a)) {
        if (typeof b === 'number')
            return makeVector(vectorArity(a), a.x % b, a.y % b, (a.z ?? 0) % b, (a.w ?? 0) % b);
        if (isVecLike(b))
            return makeVector(vectorArity(a), a.x % b.x, a.y % b.y, (a.z ?? 0) % (b.z ?? 1), (a.w ?? 0) % (b.w ?? 1));
    }
    return invalidOperands('%', a, b);
}
export function pow(a: unknown, b: unknown): unknown {
    if (typeof a === 'number' && typeof b === 'number')
        return Math.pow(a, b);
    return invalidOperands('**', a, b);
}
export function neg(a: unknown): unknown {
    if (typeof a === 'number')
        return -a;
    if (isVecLike(a))
        return makeVector(vectorArity(a), -a.x, -a.y, -(a.z ?? 0), -(a.w ?? 0));
    if (a instanceof Color)
        return new Color(-a.r, -a.g, -a.b, -a.a);
    if (a instanceof Quaternion)
        return new Quaternion(-a.x, -a.y, -a.z, -a.w);
    return fail(`Operando inválido "${describeTypeOf(a)}" no operador unário "-".`);
}
export function pos(a: unknown): unknown {
    if (typeof a === 'number' || isVecLike(a))
        return a;
    return fail(`Operando inválido "${describeTypeOf(a)}" no operador unário "+".`);
}
const INT32_MIN = -2147483648;
const INT32_MAX = 2147483647;
