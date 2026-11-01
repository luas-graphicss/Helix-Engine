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
function requireInts(op: string, a: unknown, b: unknown): asserts a is number {
    if (typeof a !== 'number' || typeof b !== 'number' || !Number.isInteger(a) || !Number.isInteger(b))
        invalidOperands(op, a, b);
}
function fits32(a: number, b: number): boolean {
    return a >= INT32_MIN && a <= INT32_MAX && b >= INT32_MIN && b <= INT32_MAX;
}
export function band(a: unknown, b: unknown): number {
    requireInts('&', a, b);
    const right = b as number;
    return fits32(a, right) ? a & right : Number(BigInt.asIntN(64, BigInt(a) & BigInt(right)));
}
export function bor(a: unknown, b: unknown): number {
    requireInts('|', a, b);
    const right = b as number;
    return fits32(a, right) ? a | right : Number(BigInt.asIntN(64, BigInt(a) | BigInt(right)));
}
export function bxor(a: unknown, b: unknown): number {
    requireInts('^', a, b);
    const right = b as number;
    return fits32(a, right) ? a ^ right : Number(BigInt.asIntN(64, BigInt(a) ^ BigInt(right)));
}
export function bnot(a: unknown): number {
    if (typeof a !== 'number' || !Number.isInteger(a))
        fail(`Operando inválido "${describeTypeOf(a)}" no operador "~".`);
    return -a - 1;
}
export function shl(a: unknown, b: unknown): number {
    requireInts('<<', a, b);
    const right = b as number;
    if (right < 0 || right > 63)
        fail(`Deslocamento inválido (${right}) no operador "<<".`);
    if (right < 31 && a >= INT32_MIN && a <= INT32_MAX && Math.abs(a * 2 ** right) <= INT32_MAX)
        return a << right;
    return Number(BigInt.asIntN(64, BigInt(a) << BigInt(right)));
}
export function shr(a: unknown, b: unknown): number {
    requireInts('>>', a, b);
    const right = b as number;
    if (right < 0 || right > 63)
        fail(`Deslocamento inválido (${right}) no operador ">>".`);
    if (fits32(a, right) && right < 32)
        return a >> right;
    return Number(BigInt.asIntN(64, BigInt(a) >> BigInt(right)));
}
export function has(container: unknown, value: unknown): boolean {
    if (container === null || container === undefined)
        fail(`Operador "in" sobre null (procurando ${str(value)}).`);
    if (typeof container === 'string') {
        if (typeof value !== 'string')
            fail(`Operador "in": uma String só contém Strings, não ${describeTypeOf(value)}.`);
        return container.includes(value);
    }
    if (Array.isArray(container)) {
        for (const item of container)
            if (eq(item, value))
                return true;
        return false;
    }
    if (container instanceof Dictionary)
        return container.has(value);
    if (ArrayBuffer.isView(container))
        return Array.prototype.includes.call(container, value);
    if (container instanceof Map)
        return container.has(value);
    if (typeof container === 'object' || typeof container === 'function')
        return typeof value === 'string' && value in (container as object);
    return fail(`Operador "in" não se aplica a ${describeTypeOf(container)}.`);
}
const BUILTIN_TYPE_CHECKS: Record<string, (value: unknown) => boolean> = {
    Variant: () => true,
    null: (value) => value === null || value === undefined,
    Nil: (value) => value === null || value === undefined,
    bool: (value) => typeof value === 'boolean',
    int: (value) => typeof value === 'number' && Number.isInteger(value),
    float: (value) => typeof value === 'number',
    String: (value) => typeof value === 'string',
    StringName: (value) => typeof value === 'string',
    NodePath: (value) => typeof value === 'string',
    Array: (value) => Array.isArray(value),
    Dictionary: (value) => value instanceof Dictionary || value instanceof Map || (value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype),
    Callable: (value) => typeof value === 'function' && !isScriptClass(value),
    Signal: (value) => value instanceof Signal,
    Vector2: (value) => value instanceof Vector2 || (isVecLike(value) && vectorArity(value) === 2),
    Vector2i: (value) => value instanceof Vector2i,
    Vector3: (value) => value instanceof Vector3 || (isVecLike(value) && vectorArity(value) === 3),
    Vector3i: (value) => value instanceof Vector3i,
    Vector4: (value) => value instanceof Vector4 || (isVecLike(value) && vectorArity(value) === 4),
    Quaternion: (value) => value instanceof Quaternion || (value instanceof Float32Array && value.length === 4),
    Basis: (value) => value instanceof Basis,
    Transform3D: (value) => value instanceof Transform3D,
    Color: (value) => value instanceof Color,
    Rect2: (value) => value instanceof Rect2,
    AABB: (value) => value instanceof AABB,
    Object: (value) => value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Dictionary) && !isVecLike(value),
    Node: (value) => isScriptInstance(value),
    PackedFloat32Array: (value) => Array.isArray(value) || value instanceof Float32Array,
    PackedFloat64Array: (value) => Array.isArray(value) || value instanceof Float64Array,
    PackedInt32Array: (value) => Array.isArray(value) || value instanceof Int32Array,
    PackedInt64Array: (value) => Array.isArray(value),
    PackedByteArray: (value) => Array.isArray(value) || value instanceof Uint8Array,
    PackedStringArray: (value) => Array.isArray(value),
    PackedVector2Array: (value) => Array.isArray(value),
    PackedVector3Array: (value) => Array.isArray(value),
    PackedColorArray: (value) => Array.isArray(value),
};
export const BUILTIN_TYPE_NAMES: readonly string[] = Object.keys(BUILTIN_TYPE_CHECKS);
export function is(value: unknown, type: unknown): boolean {
    if (typeof type === 'string') {
        const check = BUILTIN_TYPE_CHECKS[type];
        if (!check)
            fail(`"${type}" não é um tipo conhecido para o operador "is".`);
        return check(value);
    }
    if (typeof type === 'function')
        return value instanceof type;
    return fail(`O operador "is" espera um tipo, não ${describeTypeOf(type)}.`);
}
export function as(value: unknown, type: unknown): unknown {
    if (typeof type === 'function')
        return value instanceof type ? value : null;
    if (typeof type !== 'string')
        fail(`O operador "as" espera um tipo, não ${describeTypeOf(type)}.`);
    if (value === null || value === undefined)
        return null;
    switch (type) {
        case 'int':
            return toInt(value);
        case 'float':
            return toFloat(value);
        case 'String':
        case 'StringName':
        case 'NodePath':
            return str(value);
        case 'bool':
            return truthy(value);
        case 'Array':
            return Array.isArray(value) ? value : fail(`Não é possível converter ${describeTypeOf(value)} em Array com "as".`);
        case 'Dictionary':
            return value instanceof Dictionary ? value : new Dictionary(value);
        default: {
            const check = BUILTIN_TYPE_CHECKS[type];
            if (!check)
                fail(`"${type}" não é um tipo conhecido para o operador "as".`);
            return check(value) ? value : null;
        }
    }
}
export function checkType(value: unknown, type: unknown, what: string): unknown {
    if (value === null || value === undefined) {
        if (typeof type === 'string' && (type === 'int' || type === 'float' || type === 'bool' || type === 'String' || type === 'StringName' || type === 'Array' || type === 'Dictionary' || type.startsWith('Vector') || type === 'Color')) {
            fail(`${what} é do tipo ${type} e não aceita null.`);
        }
        return null;
    }
    if (typeof type === 'string') {
        const generic = type.indexOf('[');
        const base = generic === -1 ? type : type.slice(0, generic);
        if (base === 'int' && typeof value === 'number' && !Number.isInteger(value))
            fail(`${what} é do tipo int e recebeu o float ${str(value)}.`);
        if (base === 'float' && typeof value === 'number')
            return value;
        const check = BUILTIN_TYPE_CHECKS[base];
        if (check) {
            if (!check(value))
                fail(`${what} é do tipo ${type} e recebeu ${describeTypeOf(value)} (${str(value)}).`);
            if (base === 'Array' && generic !== -1 && Array.isArray(value)) {
                const element = type.slice(generic + 1, -1);
                for (let index = 0; index < value.length; index++)
                    checkType(value[index], element, `${what}[${index}]`);
            }
            return value;
        }
        return value;
    }
    if (typeof type === 'function') {
        if (!(value instanceof type))
            fail(`${what} é do tipo ${(type as {
                __gdName?: string;
            }).__gdName ?? type.name} e recebeu ${describeTypeOf(value)}.`);
        return value;
    }
    return value;
}
export function toInt(value: unknown): number {
    if (typeof value === 'number')
        return Math.trunc(value);
    if (typeof value === 'boolean')
        return value ? 1 : 0;
    if (typeof value === 'string') {
        const parsed = parseInt(value.trim(), 10);
        return Number.isNaN(parsed) ? 0 : parsed;
    }
    if (value === null || value === undefined)
        return 0;
    return fail(`Não é possível converter ${describeTypeOf(value)} em int.`);
}
export function toFloat(value: unknown): number {
    if (typeof value === 'number')
        return value;
    if (typeof value === 'boolean')
        return value ? 1 : 0;
    if (typeof value === 'string') {
        const parsed = parseFloat(value.trim());
        return Number.isNaN(parsed) ? 0 : parsed;
    }
    if (value === null || value === undefined)
        return 0;
    return fail(`Não é possível converter ${describeTypeOf(value)} em float.`);
}
export function numberToString(value: number): string {
    if (Number.isNaN(value))
        return 'nan';
    if (value === Infinity)
        return 'inf';
    if (value === -Infinity)
        return '-inf';
    if (Number.isInteger(value) && Math.abs(value) < 1e21)
        return String(value);
    return String(parseFloat(value.toPrecision(15)));
}
export function strF(value: unknown): string {
    if (typeof value === 'number' && Number.isInteger(value) && Math.abs(value) < 1e21)
        return `${value}.0`;
    return str(value);
}
function componentToString(value: number): string {
    return Number.isInteger(value) ? `${value}.0` : numberToString(value);
}
export function str(value: unknown, seen: Set<object> = new Set()): string {
    if (value === null || value === undefined)
        return '<null>';
    switch (typeof value) {
        case 'string':
            return value;
        case 'number':
            return numberToString(value);
        case 'boolean':
            return value ? 'true' : 'false';
        case 'function': {
            if (isScriptClass(value))
                return `<GDScript ${(value as {
                    __gdName?: string;
                }).__gdName ?? value.name}>`;
            const meta = callableMeta(value);
            if (meta?.method)
                return `${meta.object !== null && typeof meta.object === 'object' ? (scriptClassName(meta.object) ?? 'Object') : 'Object'}::${meta.method}`;
            return value.name ? `<Callable ${value.name}>` : '<Callable>';
        }
        case 'bigint':
            return value.toString();
        case 'symbol':
            return value.toString();
        case 'object':
            break;
        default:
            return String(value);
    }
    const object = value as object;
    if (seen.has(object))
        return '...';
    if (Array.isArray(object)) {
        seen.add(object);
        const text = `[${object.map((item) => repr(item, seen)).join(', ')}]`;
        seen.delete(object);
        return text;
    }
    if (object instanceof Dictionary) {
        if (object.size === 0)
            return '{  }';
        seen.add(object);
        const text = `{ ${Array.from(object, ([key, entry]) => `${repr(key, seen)}: ${repr(entry, seen)}`).join(', ')} }`;
        seen.delete(object);
        return text;
    }
    if (object instanceof Vector2i || object instanceof Vector3i)
        return object instanceof Vector3i ? `(${object.x}, ${object.y}, ${object.z})` : `(${object.x}, ${object.y})`;
    if (object instanceof Vector4)
        return `(${componentToString(object.x)}, ${componentToString(object.y)}, ${componentToString(object.z)}, ${componentToString(object.w)})`;
    if (object instanceof Quaternion)
        return `(${componentToString(object.x)}, ${componentToString(object.y)}, ${componentToString(object.z)}, ${componentToString(object.w)})`;
    if (object instanceof Color)
        return `(${componentToString(object.r)}, ${componentToString(object.g)}, ${componentToString(object.b)}, ${componentToString(object.a)})`;
    if (object instanceof Rect2 || object instanceof AABB)
        return `[P: ${str(object.position)}, S: ${str(object.size)}]`;
    if (object instanceof Basis)
        return `[X: ${str(object.x)}, Y: ${str(object.y)}, Z: ${str(object.z)}]`;
    if (object instanceof Transform3D)
        return `[X: ${str(object.basis.x)}, Y: ${str(object.basis.y)}, Z: ${str(object.basis.z)}, O: ${str(object.origin)}]`;
    if (isVecLike(object)) {
        const arity = vectorArity(object);
        const vec = object as VecLike;
        return arity === 2 ? `(${componentToString(vec.x)}, ${componentToString(vec.y)})` : arity === 3 ? `(${componentToString(vec.x)}, ${componentToString(vec.y)}, ${componentToString(vec.z ?? 0)})` : `(${componentToString(vec.x)}, ${componentToString(vec.y)}, ${componentToString(vec.z ?? 0)}, ${componentToString(vec.w ?? 0)})`;
    }
    if (object instanceof Signal)
        return `Signal(${object.name})`;
    if (ArrayBuffer.isView(object))
        return `[${Array.from(object as unknown as ArrayLike<number>, (item) => numberToString(item)).join(', ')}]`;
    if (object instanceof Map) {
        seen.add(object);
        const text = `{ ${Array.from(object, ([key, entry]) => `${repr(key, seen)}: ${repr(entry, seen)}`).join(', ')} }`;
        seen.delete(object);
        return text;
    }
    if (object instanceof Promise)
        return '<Coroutine>';
    if (object instanceof Error)
        return object.message;
    const scriptName = scriptClassName(object);
    if (scriptName) {
        const custom = (object as {
            _to_string?: unknown;
        })._to_string;
        if (typeof custom === 'function')
            return String(custom.call(object));
        const name = (object as {
            name?: unknown;
        }).name;
        return typeof name === 'string' && name.length > 0 ? `<${scriptName}:${name}>` : `<${scriptName}>`;
    }
    const tag = Object.prototype.toString.call(object);
    if (tag === '[object Object]') {
        const proto = Object.getPrototypeOf(object);
        if (proto === Object.prototype || proto === null) {
            seen.add(object);
            const text = `{ ${Object.entries(object as Record<string, unknown>).map(([key, entry]) => `"${key}": ${repr(entry, seen)}`).join(', ')} }`;
            seen.delete(object);
            return text;
        }
        const ctorName = (object.constructor as {
            name?: string;
        } | undefined)?.name;
        const name = (object as {
            name?: unknown;
        }).name;
        return typeof name === 'string' && name.length > 0 ? `<${ctorName || 'Object'}:${name}>` : `<${ctorName || 'Object'}>`;
    }
    return String(object);
}
function repr(value: unknown, seen: Set<object>): string {
    if (typeof value === 'string')
        return `"${value}"`;
    return str(value, seen);
}
export function varToStr(value: unknown): string {
    if (typeof value === 'string')
        return JSON.stringify(value);
    if (typeof value === 'number' && !Number.isInteger(value))
        return numberToString(value);
    if (value === null || value === undefined)
        return 'null';
    if (Array.isArray(value))
        return `[${value.map((item) => varToStr(item)).join(', ')}]`;
    if (value instanceof Dictionary)
        return `{\n${Array.from(value, ([key, entry]) => `${varToStr(key)}: ${varToStr(entry)}`).join(',\n')}\n}`;
    if (value instanceof Vector2)
        return `Vector2(${value.x}, ${value.y})`;
    if (value instanceof Vector3)
        return `Vector3(${value.x}, ${value.y}, ${value.z})`;
    if (value instanceof Vector4)
        return `Vector4(${value.x}, ${value.y}, ${value.z}, ${value.w})`;
    if (value instanceof Color)
        return `Color(${value.r}, ${value.g}, ${value.b}, ${value.a})`;
    if (value instanceof Quaternion)
        return `Quaternion(${value.x}, ${value.y}, ${value.z}, ${value.w})`;
    return str(value);
}
const FORMAT_SPEC = /%([-+ 0]*)(\*|\d+)?(?:\.(\*|\d+))?([sdiofxXcv%])/g;
export function format(template: string, values: unknown): string {
    const list = Array.isArray(values) ? values : [values];
    let index = 0;
    const next = (): unknown => {
        if (index >= list.length)
            fail(`Formato "%" sem valores suficientes: "${template}" espera mais que ${list.length}.`);
        return list[index++];
    };
    const result = template.replace(FORMAT_SPEC, (_match, flags: string, widthSpec: string | undefined, precisionSpec: string | undefined, kind: string) => {
        if (kind === '%')
            return '%';
        const width = widthSpec === '*' ? toInt(next()) : widthSpec ? Number(widthSpec) : 0;
        const precision = precisionSpec === '*' ? toInt(next()) : precisionSpec !== undefined ? Number(precisionSpec) : null;
        const value = next();
        const leftAlign = flags.includes('-');
        const padZero = flags.includes('0') && !leftAlign;
        const plus = flags.includes('+');
        const pad = (text: string, numeric: boolean) => {
            if (text.length >= width)
                return text;
            if (leftAlign)
                return text.padEnd(width);
            if (padZero && numeric) {
                const sign = text.startsWith('-') || text.startsWith('+') ? text[0] : '';
                return sign + text.slice(sign.length).padStart(width - sign.length, '0');
            }
            return text.padStart(width);
        };
        switch (kind) {
            case 's':
                return pad(str(value), false);
            case 'c':
                return pad(typeof value === 'number' ? String.fromCodePoint(value) : str(value).slice(0, 1), false);
            case 'd':
            case 'i': {
                if (typeof value !== 'number')
                    fail(`Formato "%${kind}" espera um número, recebeu ${describeTypeOf(value)}.`);
                const integer = Math.trunc(value);
                let text = String(Math.abs(integer));
                if (precision !== null)
                    text = text.padStart(precision, '0');
                return pad((integer < 0 ? '-' : plus ? '+' : '') + text, true);
            }
            case 'o':
            case 'x':
            case 'X': {
                if (typeof value !== 'number')
                    fail(`Formato "%${kind}" espera um inteiro, recebeu ${describeTypeOf(value)}.`);
                const integer = Math.trunc(value);
                let text = Math.abs(integer).toString(kind === 'o' ? 8 : 16);
                if (kind === 'X')
                    text = text.toUpperCase();
                if (precision !== null)
                    text = text.padStart(precision, '0');
                return pad((integer < 0 ? '-' : plus ? '+' : '') + text, true);
            }
            case 'f': {
                if (typeof value !== 'number')
                    fail(`Formato "%f" espera um número, recebeu ${describeTypeOf(value)}.`);
                const text = value.toFixed(precision ?? 6);
                return pad(value >= 0 && plus ? `+${text}` : text, true);
            }
            case 'v': {
                if (!isVecLike(value))
                    fail(`Formato "%v" espera um vetor, recebeu ${describeTypeOf(value)}.`);
                const arity = vectorArity(value);
                const parts = [value.x, value.y, value.z ?? 0, value.w ?? 0].slice(0, arity).map((component) => {
                    const text = component.toFixed(precision ?? 6);
                    return pad(component >= 0 && plus ? `+${text}` : text, true);
                });
                return `(${parts.join(', ')})`;
            }
            default:
                return _match;
        }
    });
    if (index < list.length)
        fail(`Formato "%" com valores demais: "${template}" usa ${index}, recebeu ${list.length}.`);
    return result;
}
export const TYPE_CONSTANTS: Record<string, number> = {
    TYPE_NIL: 0,
    TYPE_BOOL: 1,
    TYPE_INT: 2,
    TYPE_FLOAT: 3,
    TYPE_STRING: 4,
    TYPE_VECTOR2: 5,
    TYPE_VECTOR2I: 6,
    TYPE_RECT2: 7,
    TYPE_RECT2I: 8,
    TYPE_VECTOR3: 9,
    TYPE_VECTOR3I: 10,
    TYPE_TRANSFORM2D: 11,
    TYPE_VECTOR4: 12,
    TYPE_VECTOR4I: 13,
    TYPE_PLANE: 14,
    TYPE_QUATERNION: 15,
    TYPE_AABB: 16,
    TYPE_BASIS: 17,
    TYPE_TRANSFORM3D: 18,
    TYPE_PROJECTION: 19,
    TYPE_COLOR: 20,
    TYPE_STRING_NAME: 21,
    TYPE_NODE_PATH: 22,
    TYPE_RID: 23,
    TYPE_OBJECT: 24,
    TYPE_CALLABLE: 25,
    TYPE_SIGNAL: 26,
    TYPE_DICTIONARY: 27,
    TYPE_ARRAY: 28,
    TYPE_PACKED_BYTE_ARRAY: 29,
    TYPE_PACKED_INT32_ARRAY: 30,
    TYPE_PACKED_INT64_ARRAY: 31,
    TYPE_PACKED_FLOAT32_ARRAY: 32,
    TYPE_PACKED_FLOAT64_ARRAY: 33,
    TYPE_PACKED_STRING_ARRAY: 34,
    TYPE_PACKED_VECTOR2_ARRAY: 35,
    TYPE_PACKED_VECTOR3_ARRAY: 36,
    TYPE_PACKED_COLOR_ARRAY: 37,
    TYPE_PACKED_VECTOR4_ARRAY: 38,
    TYPE_MAX: 39,
};
