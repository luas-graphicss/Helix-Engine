import { ActorScript, type InjectedFields } from './actor-script';
import { ARRAY_METHODS, Dictionary, Grouping, HashSet, KeyValuePair, LINQ, List, OrderedList, Queue, Stack, Tuple, arrayAt, arraySet, iterate, newArray } from './collections';
import { ArgumentOutOfRangeException, DivideByZeroException, EXCEPTION_TYPES, Exception, IndexOutOfRangeException, InvalidCastException, InvalidOperationException, KeyNotFoundException, NullReferenceException, SwitchExpressionException, wrapThrown } from './errors';
import { ARRAY, BOOL, BOOL_METHODS, BYTE, CHAR, COLOR, CONVERT, DECIMAL, DELEGATE_METHODS, DOUBLE, DateTime, ENUMERABLE, ENUM_STATICS, ENVIRONMENT, FLOAT, GUID, INT, LONG, MATH, MATHF, MIDPOINT_ROUNDING, NUMBER_METHODS, Random, SBYTE, SHORT, STRING_COMPARISON, STRING_METHODS, STRING_SPLIT_OPTIONS, STRING_STATICS, StringBuilder, TASK_METHODS, TimeSpan, UINT, ULONG, USHORT, VECTOR2, VECTOR3, createConsoleStatics, createDebugStatics, createTaskStatics, type ConsoleLike, } from './statics';
import { ENUM_INFO, RECORD_FIELDS, TYPE_NAME, charCode, compare, describeType, enumToString, equals, format, hashKey, isNullish, str, toChar, toFloat, toInt, typeName, type AnyRecord, type EnumInfo, type Fn } from './values';
export const BUILTIN_MODULE_NAME = '@helix/csharp';
export type ModuleRecord = {
    exports: Record<string, unknown>;
};
export interface ClassInfo {
    readonly name: string;
    readonly isMain?: boolean;
    readonly isActor?: boolean;
    readonly isStatic?: boolean;
    readonly record?: readonly string[] | null;
    readonly flavor?: 'class' | 'struct' | 'record';
}
type Ref<T> = {
    v: T;
};
const MISSING = Symbol('missing');
function lowerFirst(name: string): string {
    return name.length > 0 ? name.charAt(0).toLowerCase() + name.slice(1) : name;
}
function upperFirst(name: string): string {
    return name.length > 0 ? name.charAt(0).toUpperCase() + name.slice(1) : name;
}
function isIterable(value: unknown): value is Iterable<unknown> {
    return value !== null && (typeof value === 'object' || typeof value === 'function') && typeof (value as {
        [Symbol.iterator]?: unknown;
    })[Symbol.iterator] === 'function';
}
function isClassConstructor(value: unknown): boolean {
    return typeof value === 'function' && /^class[\s{]/.test(Function.prototype.toString.call(value));
}
export class TypeDescriptor {
    constructor(readonly Name: string, readonly $ctor: unknown) { }
    get FullName(): string {
        return this.Name;
    }
    get IsClass(): boolean {
        return typeof this.$ctor === 'function';
    }
    get IsEnum(): boolean {
        return this.$ctor !== null && typeof this.$ctor === 'object' && ENUM_INFO in (this.$ctor as object);
    }
    get IsValueType(): boolean {
        return typeof this.$ctor === 'string' && this.$ctor !== 'string' && this.$ctor !== 'object';
    }
    get BaseType(): TypeDescriptor | null {
        if (typeof this.$ctor !== 'function')
            return null;
        const parent = Object.getPrototypeOf(this.$ctor) as Function | null;
        return parent && parent !== Function.prototype ? descriptorOf(parent) : null;
    }
    IsAssignableFrom(other: unknown): boolean {
        if (!(other instanceof TypeDescriptor))
            return false;
        if (typeof this.$ctor === 'function' && typeof other.$ctor === 'function')
            return other.$ctor === this.$ctor || other.$ctor.prototype instanceof (this.$ctor as new () => object);
        return this.Name === other.Name;
    }
    IsInstanceOfType(value: unknown): boolean {
        return isOfType(value, this.$ctor);
    }
    Equals(other: unknown): boolean {
        return other instanceof TypeDescriptor && other.$ctor === this.$ctor && other.Name === this.Name;
    }
    GetHashKey(): string {
        return `type:${this.Name}`;
    }
    ToString(): string {
        return this.FullName;
    }
}
const descriptors = new Map<unknown, TypeDescriptor>();
const PRIMITIVE_TYPE_NAMES: Record<string, string> = {
    int: 'Int32',
    long: 'Int64',
    short: 'Int16',
    byte: 'Byte',
    sbyte: 'SByte',
    uint: 'UInt32',
    ulong: 'UInt64',
    ushort: 'UInt16',
    float: 'Single',
    double: 'Double',
    decimal: 'Decimal',
    bool: 'Boolean',
    string: 'String',
    char: 'Char',
    object: 'Object',
    array: 'Array',
    void: 'Void',
    dynamic: 'Object',
};
export function descriptorOf(type: unknown): TypeDescriptor {
    const cached = descriptors.get(type);
    if (cached)
        return cached;
    let name: string;
    if (typeof type === 'string')
        name = PRIMITIVE_TYPE_NAMES[type] ?? type;
    else if (typeof type === 'function')
        name = ((type as {
            [TYPE_NAME]?: string;
        })[TYPE_NAME] ?? (type.prototype as {
            [TYPE_NAME]?: string;
        } | undefined)?.[TYPE_NAME] ?? type.name) || 'Object';
    else if (type !== null && typeof type === 'object' && ENUM_INFO in type)
        name = ((type as {
            [ENUM_INFO]: EnumInfo;
        })[ENUM_INFO] as EnumInfo).name;
    else
        name = typeName(type);
    const descriptor = new TypeDescriptor(name, type);
    descriptors.set(type, descriptor);
    return descriptor;
}
export function typeOfValue(value: unknown): TypeDescriptor {
    if (value === null || value === undefined)
        throw new NullReferenceException('GetType() num valor nulo.');
    switch (typeof value) {
        case 'number':
            return descriptorOf(Number.isInteger(value) ? 'int' : 'double');
        case 'string':
            return descriptorOf(value.length === 1 ? 'char' : 'string');
        case 'boolean':
            return descriptorOf('bool');
        case 'function':
            return new TypeDescriptor('Delegate', 'delegate');
        default:
            break;
    }
    if (Array.isArray(value))
        return descriptorOf('array');
    const ctor = (value as object).constructor;
    return typeof ctor === 'function' && ctor !== Object ? descriptorOf(ctor) : new TypeDescriptor(typeName(value), null);
}
export function isOfType(value: unknown, type: unknown): boolean {
    if (typeof type === 'string') {
        switch (type) {
            case 'int':
            case 'long':
            case 'short':
            case 'byte':
            case 'sbyte':
            case 'uint':
            case 'ulong':
            case 'ushort':
                return typeof value === 'number' && Number.isInteger(value);
            case 'float':
            case 'double':
            case 'decimal':
                return typeof value === 'number';
            case 'string':
                return typeof value === 'string';
            case 'bool':
                return typeof value === 'boolean';
            case 'char':
                return typeof value === 'string' && value.length === 1;
            case 'array':
                return Array.isArray(value);
            case 'delegate':
                return typeof value === 'function';
            case 'object':
            case 'dynamic':
                return !isNullish(value);
            case 'null':
                return isNullish(value);
            default:
                return !isNullish(value) && typeName(value) === type;
        }
    }
    if (isNullish(value))
        return false;
    if (typeof type === 'function') {
        if (type === Exception && value instanceof Error)
            return true;
        return value instanceof (type as new () => object);
    }
    if (type !== null && typeof type === 'object') {
        const info = (type as {
            [ENUM_INFO]?: EnumInfo;
        })[ENUM_INFO];
        if (info)
            return typeof value === 'number' && (info.flags || info.values.includes(value));
        if (type instanceof TypeDescriptor)
            return isOfType(value, type.$ctor);
    }
    return false;
}
export function castTo(value: unknown, type: unknown): unknown {
    if (typeof type === 'string') {
        switch (type) {
            case 'int':
            case 'long':
            case 'short':
            case 'byte':
            case 'sbyte':
            case 'uint':
            case 'ulong':
            case 'ushort':
                return toInt(value, `cast para ${type}`);
            case 'float':
            case 'double':
            case 'decimal':
                return toFloat(value, `cast para ${type}`);
            case 'char':
                return toChar(value);
            case 'bool':
                if (typeof value === 'boolean')
                    return value;
                throw new InvalidCastException(`Não dá para converter ${describeType(value)} em bool.`);
            case 'string':
                if (isNullish(value) || typeof value === 'string')
                    return value ?? null;
                throw new InvalidCastException(`Não dá para converter ${describeType(value)} em string com um cast; use ToString().`);
            case 'object':
            case 'dynamic':
                return value ?? null;
            default:
                return value ?? null;
        }
    }
    if (isNullish(value))
        return null;
    if (type !== null && typeof type === 'object' && ENUM_INFO in type) {
        if (typeof value === 'number')
            return value;
        throw new InvalidCastException(`Não dá para converter ${describeType(value)} no enum ${((type as {
            [ENUM_INFO]: EnumInfo;
        })[ENUM_INFO] as EnumInfo).name}.`);
    }
    if (isOfType(value, type))
        return value;
    throw new InvalidCastException(`Não dá para converter ${describeType(value)} em ${descriptorOf(type).Name}.`);
}
interface Resolved {
    readonly value: unknown;
    readonly thisArg: unknown;
}
function universalMember(target: unknown, name: string): Resolved | typeof MISSING {
    switch (name) {
        case 'ToString':
            return { value: (specifier?: unknown) => (specifier !== undefined ? format(target, typeof specifier === 'string' ? specifier : null, null) : str(target)), thisArg: undefined };
        case 'Equals':
            return { value: (other: unknown) => equals(target, other), thisArg: undefined };
        case 'GetHashCode':
            return { value: () => stableHash(target), thisArg: undefined };
        case 'GetType':
            return { value: () => typeOfValue(target), thisArg: undefined };
        case 'GetHashKey':
            return { value: () => hashKey(target), thisArg: undefined };
        default:
            return MISSING;
    }
}
function stableHash(value: unknown): number {
    const key = hashKey(value);
    if (typeof key === 'number')
        return Number.isInteger(key) ? key : Math.floor(key * 1000003);
    if (typeof key === 'boolean')
        return key ? 1 : 0;
    if (key === null)
        return 0;
    const text = typeof key === 'string' ? key : str(key);
    let hash = 0;
    for (let index = 0; index < text.length; index++)
        hash = (hash * 31 + text.charCodeAt(index)) | 0;
    return hash;
}
function tableMember<T>(table: Record<string, (self: T, ...args: unknown[]) => unknown>, target: T, name: string): Resolved | typeof MISSING {
    const fn = table[name];
    if (!fn)
        return MISSING;
    return { value: (...args: unknown[]) => fn(target, ...args), thisArg: undefined };
}
function linqMember(target: Iterable<unknown>, name: string): Resolved | typeof MISSING {
    const fn = LINQ[name];
    if (!fn)
        return MISSING;
    return { value: (...args: unknown[]) => fn(target, ...args), thisArg: undefined };
}
function resolveMember(target: unknown, name: string): Resolved | typeof MISSING {
    switch (typeof target) {
        case 'string': {
            if (name === 'Length')
                return { value: target.length, thisArg: undefined };
            const method = tableMember(STRING_METHODS, target, name);
            if (method !== MISSING)
                return method;
            const linq = linqMember(target, name);
            if (linq !== MISSING)
                return linq;
            return universalMember(target, name);
        }
        case 'number': {
            const method = tableMember(NUMBER_METHODS, target, name);
            return method !== MISSING ? method : universalMember(target, name);
        }
        case 'boolean': {
            const method = tableMember(BOOL_METHODS, target, name);
            return method !== MISSING ? method : universalMember(target, name);
        }
        case 'function': {
            const own = ownMember(target as unknown as AnyRecord, name);
            if (own !== MISSING)
                return own;
            const method = tableMember(DELEGATE_METHODS, target as Fn, name);
            return method !== MISSING ? method : universalMember(target, name);
        }
        case 'object':
            break;
        default:
            return universalMember(target, name);
    }
    const object = target as AnyRecord;
    if (Array.isArray(object)) {
        if (name === 'Length' || name === 'LongLength')
            return { value: object.length, thisArg: undefined };
        if (name === 'Rank')
            return { value: 1, thisArg: undefined };
        const method = tableMember(ARRAY_METHODS, object, name);
        if (method !== MISSING)
            return method;
        const linq = linqMember(object, name);
        if (linq !== MISSING)
            return linq;
        return universalMember(target, name);
    }
    const own = ownMember(object, name);
    if (own !== MISSING)
        return own;
    if (object instanceof Map) {
        const mapMember = MAP_METHODS[name];
        if (mapMember)
            return { value: mapMember(object), thisArg: undefined };
    }
    if (object instanceof Set) {
        const setMember = SET_METHODS[name];
        if (setMember)
            return { value: setMember(object), thisArg: undefined };
    }
    if (object instanceof Promise) {
        const method = tableMember(TASK_METHODS, object, name);
        if (method !== MISSING)
            return method;
    }
    if (isIterable(object)) {
        const linq = linqMember(object, name);
        if (linq !== MISSING)
            return linq;
    }
    return universalMember(target, name);
}
function ownMember(object: AnyRecord, name: string): Resolved | typeof MISSING {
    if (name in object)
        return { value: object[name], thisArg: object };
    const camel = lowerFirst(name);
    if (camel !== name && camel in object)
        return { value: object[camel], thisArg: object };
    const pascal = upperFirst(name);
    if (pascal !== name && pascal in object)
        return { value: object[pascal], thisArg: object };
    return MISSING;
}
const MAP_METHODS: Record<string, (map: Map<unknown, unknown>) => unknown> = {
    Count: (map) => map.size,
    ContainsKey: (map) => (key: unknown) => map.has(key),
    TryGetValue: (map) => (key: unknown, out: Ref<unknown>) => {
        out.v = map.has(key) ? map.get(key) : null;
        return map.has(key);
    },
    Add: (map) => (key: unknown, value: unknown) => map.set(key, value),
    Remove: (map) => (key: unknown) => map.delete(key),
    Clear: (map) => () => map.clear(),
    Keys: (map) => List.from(map.keys()),
    Values: (map) => List.from(map.values()),
};
const SET_METHODS: Record<string, (set: Set<unknown>) => unknown> = {
    Count: (set) => set.size,
    Contains: (set) => (item: unknown) => set.has(item),
    Add: (set) => (item: unknown) => {
        const had = set.has(item);
        set.add(item);
        return !had;
    },
    Remove: (set) => (item: unknown) => set.delete(item),
    Clear: (set) => () => set.clear(),
};
function memberNames(target: unknown): string[] {
    const names = new Set<string>();
    if (target === null || target === undefined)
        return [];
    if (typeof target === 'string')
        for (const name of Object.keys(STRING_METHODS))
            names.add(name);
    else if (typeof target === 'number')
        for (const name of Object.keys(NUMBER_METHODS))
            names.add(name);
    else if (Array.isArray(target)) {
        names.add('Length');
        for (const name of Object.keys(LINQ))
            names.add(name);
    }
    else if (typeof target === 'object' || typeof target === 'function') {
        let current: object | null = target as object;
        while (current && current !== Object.prototype && current !== Function.prototype) {
            for (const key of Object.getOwnPropertyNames(current))
                if (!key.startsWith('$') && key !== 'constructor')
                    names.add(key);
            current = Object.getPrototypeOf(current) as object | null;
        }
        if (isIterable(target))
            for (const name of Object.keys(LINQ))
                names.add(name);
    }
    return Array.from(names).sort();
}
function similar(wanted: string, candidates: readonly string[]): string[] {
    const lower = wanted.toLowerCase();
    return candidates
        .filter((candidate) => {
        const other = candidate.toLowerCase();
        return other === lower || other.includes(lower) || lower.includes(other) || levenshtein(lower, other) <= Math.max(1, Math.floor(wanted.length / 3));
    })
        .slice(0, 5);
}
function levenshtein(a: string, b: string): number {
    if (a.length === 0)
        return b.length;
    if (b.length === 0)
        return a.length;
    let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
    for (let i = 1; i <= a.length; i++) {
        const current = [i];
        for (let j = 1; j <= b.length; j++)
            current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        previous = current;
    }
    return previous[b.length];
}
function missingMember(target: unknown, name: string, verb: string): never {
    const names = memberNames(target);
    const hints = similar(name, names);
    const suffix = hints.length > 0 ? ` Parecidos: ${hints.join(', ')}.` : names.length > 0 ? ` Membros disponíveis: ${names.slice(0, 12).join(', ')}${names.length > 12 ? '…' : ''}.` : '';
    throw new InvalidOperationException(`${verb} "${name}" em ${describeType(target)}: o membro não existe.${suffix}`);
}
export function getMember(target: unknown, name: string, optional = false): unknown {
    if (isNullish(target)) {
        if (optional)
            return null;
        throw new NullReferenceException(`Não dá para ler "${name}" de um valor nulo.`);
    }
    const resolved = resolveMember(target, name);
    if (resolved === MISSING)
        return null;
    const value = resolved.value;
    if (typeof value === 'function' && resolved.thisArg !== undefined && !isClassConstructor(value))
        return (value as Fn).bind(resolved.thisArg);
    return value === undefined ? null : value;
}
const boundMethods = new WeakMap<object, Map<string, Fn>>();
export function boundMethod(target: unknown, name: string): Fn {
    if (isNullish(target))
        throw new NullReferenceException(`Não dá para ler o método "${name}" de um valor nulo.`);
    if (typeof target !== 'object' && typeof target !== 'function')
        throw new InvalidOperationException(`${describeType(target)} não tem o método "${name}".`);
    const object = target as object;
    let cache = boundMethods.get(object);
    if (!cache) {
        cache = new Map();
        boundMethods.set(object, cache);
    }
    const cached = cache.get(name);
    if (cached)
        return cached;
    const method = (object as AnyRecord)[name];
    if (typeof method !== 'function')
        missingMember(target, name, 'Leitura do método');
    const bound = (method as Fn).bind(object) as Fn;
    cache.set(name, bound);
    return bound;
}
export function setMember(target: unknown, name: string, value: unknown): unknown {
    if (isNullish(target))
        throw new NullReferenceException(`Não dá para atribuir "${name}" num valor nulo.`);
    if (typeof target !== 'object' && typeof target !== 'function')
        throw new InvalidOperationException(`Não dá para atribuir "${name}" em ${describeType(target)}.`);
    const object = target as AnyRecord;
    if (Array.isArray(object) && name === 'Length')
        throw new InvalidOperationException('Length de um array é só leitura; crie outro array ou use List.');
    const camel = lowerFirst(name);
    const key = name in object ? name : camel in object ? camel : upperFirst(name) in object ? upperFirst(name) : name;
    object[key] = value;
    return value;
}
export function callMember(target: unknown, name: string, args: readonly unknown[], optional = false): unknown {
    if (isNullish(target)) {
        if (optional)
            return null;
        throw new NullReferenceException(`Não dá para chamar "${name}" num valor nulo.`);
    }
    const resolved = resolveMember(target, name);
    if (resolved === MISSING)
        missingMember(target, name, 'Chamada de');
    let fn = resolved.value;
    if (typeof fn !== 'function') {
        if (isIterable(target) && LINQ[name])
            return LINQ[name](target as Iterable<unknown>, ...args);
        if (fn !== null && typeof fn === 'object' && typeof (fn as {
            Invoke?: unknown;
        }).Invoke === 'function')
            return ((fn as {
                Invoke: Fn;
            }).Invoke as Fn).apply(fn, args as unknown[]);
        throw new InvalidOperationException(`"${name}" em ${describeType(target)} não é um método (é ${describeType(fn)}).`);
    }
    if (isClassConstructor(fn) && resolved.thisArg !== undefined)
        fn = (...rest: unknown[]) => construct(resolved.value, rest);
    return (fn as Fn).apply(resolved.thisArg, args as unknown[]);
}
export function invoke(fn: unknown, args: readonly unknown[], optional = false): unknown {
    if (isNullish(fn)) {
        if (optional)
            return null;
        throw new NullReferenceException('Chamada de um delegate nulo.');
    }
    if (typeof fn !== 'function') {
        const invokeMethod = (fn as {
            Invoke?: unknown;
        }).Invoke;
        if (typeof invokeMethod === 'function')
            return (invokeMethod as Fn).apply(fn, args as unknown[]);
        throw new InvalidOperationException(`${describeType(fn)} não é uma função nem um delegate.`);
    }
    return (fn as Fn)(...args);
}
export function construct(ctor: unknown, args: readonly unknown[]): unknown {
    if (typeof ctor !== 'function')
        throw new InvalidOperationException(`Não dá para instanciar ${describeType(ctor)}: não é uma classe.`);
    const prototype = (ctor as {
        prototype?: {
            $ctor?: unknown;
        };
    }).prototype;
    if (prototype && typeof prototype.$ctor === 'function') {
        const instance = new (ctor as new () => {
            $ctor: Fn;
        })();
        return instance.$ctor(...args);
    }
    if (isClassConstructor(ctor))
        return new (ctor as new (...rest: unknown[]) => object)(...args);
    return (ctor as Fn)(...args);
}
export function elementAt(target: unknown, ...keys: unknown[]): unknown {
    if (isNullish(target))
        throw new NullReferenceException(`Não dá para indexar um valor nulo ([${keys.map((key) => str(key)).join(', ')}]).`);
    if (Array.isArray(target)) {
        let current: unknown = target;
        for (const key of keys) {
            if (!Array.isArray(current))
                throw new InvalidOperationException('Índice a mais para as dimensões do array.');
            current = arrayAt(current, key);
        }
        return current;
    }
    if (typeof target === 'string') {
        const index = Number(keys[0]);
        if (!Number.isInteger(index) || index < 0 || index >= target.length)
            throw new IndexOutOfRangeException(`Índice ${str(keys[0])} fora da string (Length = ${target.length}).`);
        return target[index];
    }
    const object = target as AnyRecord;
    if (typeof object.$at === 'function')
        return (object.$at as Fn)(...keys);
    if (object instanceof Map) {
        if (!object.has(keys[0]))
            throw new KeyNotFoundException(`A chave "${str(keys[0])}" não está no dicionário.`);
        return object.get(keys[0]);
    }
    if (typeof object === 'object' || typeof object === 'function') {
        const key = keys[0];
        const value = object[String(key)];
        return value === undefined ? null : value;
    }
    throw new InvalidOperationException(`${describeType(target)} não aceita indexação.`);
}
export function setElementAt(target: unknown, keys: readonly unknown[], value: unknown): unknown {
    if (isNullish(target))
        throw new NullReferenceException(`Não dá para indexar um valor nulo ([${keys.map((key) => str(key)).join(', ')}] = …).`);
    if (Array.isArray(target)) {
        let current: unknown[] = target;
        for (const key of keys.slice(0, -1)) {
            const next = arrayAt(current, key);
            if (!Array.isArray(next))
                throw new InvalidOperationException('Índice a mais para as dimensões do array.');
            current = next;
        }
        arraySet(current, keys[keys.length - 1], value);
        return value;
    }
    if (typeof target === 'string')
        throw new InvalidOperationException('Strings são imutáveis: use StringBuilder ou monte outra string.');
    const object = target as AnyRecord;
    if (typeof object.$set === 'function') {
        ;
        (object.$set as Fn)(...keys, value);
        return value;
    }
    if (object instanceof Map) {
        object.set(keys[0], value);
        return value;
    }
    if (typeof object === 'object' || typeof object === 'function') {
        object[String(keys[0])] = value;
        return value;
    }
    throw new InvalidOperationException(`${describeType(target)} não aceita indexação.`);
}
export function deconstruct(value: unknown, count: number): unknown[] {
    if (isNullish(value))
        throw new NullReferenceException('Não dá para desconstruir um valor nulo.');
    if (typeof value !== 'string' && isIterable(value))
        return Array.from(value);
    const method = (value as AnyRecord).Deconstruct;
    if (typeof method === 'function') {
        const refs = Array.from({ length: count }, (): Ref<unknown> => ({ v: null }));
        (method as Fn).apply(value, refs);
        return refs.map((ref) => ref.v);
    }
    throw new InvalidOperationException(`${describeType(value)} não pode ser desconstruído em ${count} partes.`);
}
export function fromEnd(target: unknown, offset: unknown): number {
    return lengthOf(target) - Number(offset);
}
export function lengthOf(target: unknown): number {
    if (isNullish(target))
        throw new NullReferenceException('Não dá para medir um valor nulo.');
    if (typeof target === 'string' || Array.isArray(target))
        return target.length;
    const count = (target as {
        Count?: unknown;
    }).Count;
    if (typeof count === 'number')
        return count;
    const length = (target as {
        length?: unknown;
    }).length;
    if (typeof length === 'number')
        return length;
    if (target instanceof Map || target instanceof Set)
        return target.size;
    throw new InvalidOperationException(`${describeType(target)} não tem comprimento.`);
}
export function slice(target: unknown, start: unknown, end: unknown): unknown {
    if (isNullish(target))
        throw new NullReferenceException('Não dá para fatiar um valor nulo.');
    const length = lengthOf(target);
    const from = isNullish(start) ? 0 : Number(start);
    const to = isNullish(end) ? length : Number(end);
    if (from < 0 || to > length || from > to)
        throw new ArgumentOutOfRangeException('range', `O intervalo ${from}..${to} está fora do alvo (comprimento ${length}).`);
    if (typeof target === 'string')
        return target.slice(from, to);
    if (Array.isArray(target))
        return target.slice(from, to);
    if (target instanceof List)
        return List.from(target.$items.slice(from, to));
    return Array.from(iterate(target, 'fatia')).slice(from, to);
}
function arithmeticOperands(a: unknown, b: unknown, operator: string): [
    number,
    number
] | null {
    if (typeof a === 'number' && typeof b === 'number')
        return [a, b];
    if (isNullish(a) || isNullish(b))
        return null;
    const left = typeof a === 'string' && a.length === 1 ? a.charCodeAt(0) : typeof a === 'boolean' ? NaN : a;
    const right = typeof b === 'string' && b.length === 1 ? b.charCodeAt(0) : typeof b === 'boolean' ? NaN : b;
    if (typeof left === 'number' && typeof right === 'number' && !Number.isNaN(left) && !Number.isNaN(right))
        return [left, right];
    throw new InvalidOperationException(`O operador ${operator} não vale entre ${describeType(a)} e ${describeType(b)}.`);
}
export function add(a: unknown, b: unknown): unknown {
    if (typeof a === 'number' && typeof b === 'number')
        return a + b;
    if (typeof a === 'string' || typeof b === 'string')
        return str(a) + str(b);
    const operands = arithmeticOperands(a, b, '+');
    return operands ? operands[0] + operands[1] : null;
}
export function sub(a: unknown, b: unknown): unknown {
    const operands = arithmeticOperands(a, b, '-');
    return operands ? operands[0] - operands[1] : null;
}
export function mul(a: unknown, b: unknown): unknown {
    const operands = arithmeticOperands(a, b, '*');
    return operands ? operands[0] * operands[1] : null;
}
export function div(a: unknown, b: unknown): unknown {
    const operands = arithmeticOperands(a, b, '/');
    return operands ? operands[0] / operands[1] : null;
}
export function idiv(a: number, b: number): number {
    if (b === 0)
        throw new DivideByZeroException();
    return Math.trunc(a / b);
}
export function rem(a: unknown, b: unknown): unknown {
    const operands = arithmeticOperands(a, b, '%');
    if (!operands)
        return null;
    if (operands[1] === 0 && Number.isInteger(operands[0]) && Number.isInteger(operands[1]))
        throw new DivideByZeroException();
    return operands[0] % operands[1];
}
export function irem(a: number, b: number): number {
    if (b === 0)
        throw new DivideByZeroException();
    return a % b;
}
export function neg(a: unknown): unknown {
    if (typeof a === 'number')
        return -a;
    if (isNullish(a))
        return null;
    const operands = arithmeticOperands(a, 0, '-');
    return operands ? -operands[0] : null;
}
export function eq(a: unknown, b: unknown): boolean {
    return equals(a, b);
}
export function neq(a: unknown, b: unknown): boolean {
    return !equals(a, b);
}
export function lt(a: unknown, b: unknown): boolean {
    return compare(a, b) < 0;
}
export function le(a: unknown, b: unknown): boolean {
    return compare(a, b) <= 0;
}
export function gt(a: unknown, b: unknown): boolean {
    return compare(a, b) > 0;
}
export function ge(a: unknown, b: unknown): boolean {
    return compare(a, b) >= 0;
}
export function concat(...parts: unknown[]): string {
    let text = '';
    for (const part of parts)
        text += str(part);
    return text;
}
export function truthy(value: unknown): boolean {
    if (typeof value === 'boolean')
        return value;
    if (isNullish(value))
        return false;
    throw new InvalidCastException(`Esperado um bool na condição, encontrado ${describeType(value)}.`);
}
type Multicast = Fn & {
    $targets?: Fn[];
};
function targetsOf(fn: unknown): Fn[] {
    if (isNullish(fn))
        return [];
    if (typeof fn !== 'function')
        throw new InvalidOperationException(`${describeType(fn)} não é um delegate.`);
    return (fn as Multicast).$targets ?? [fn as Fn];
}
function multicast(targets: Fn[]): Fn | null {
    if (targets.length === 0)
        return null;
    if (targets.length === 1)
        return targets[0];
    const combined: Multicast = (...args: unknown[]) => {
        let result: unknown;
        for (const target of targets)
            result = target(...args);
        return result;
    };
    combined.$targets = targets;
    return combined;
}
export function combine(a: unknown, b: unknown): Fn | null {
    return multicast([...targetsOf(a), ...targetsOf(b)]);
}
export function remove(a: unknown, b: unknown): Fn | null {
    const targets = [...targetsOf(a)];
    for (const removed of targetsOf(b)) {
        const index = targets.lastIndexOf(removed);
        if (index >= 0)
            targets.splice(index, 1);
    }
    return multicast(targets);
}
function defineEnum(name: string, members: Record<string, number>, flags = false): Record<string, unknown> {
    const names = Object.keys(members);
    const values = names.map((member) => members[member]);
    const info: EnumInfo = { name, names, values, flags };
    const enumObject: Record<string, unknown> = { ...members };
    Object.defineProperty(enumObject, ENUM_INFO, { value: info });
    Object.defineProperty(enumObject, TYPE_NAME, { value: name });
    Object.defineProperty(enumObject, 'ToString', { value: (value: unknown) => enumToString(enumObject, value) });
    Object.defineProperty(enumObject, '$values', { value: values });
    Object.defineProperty(enumObject, '$names', { value: names });
    return Object.freeze(enumObject);
}
function installRecord(ctor: Function, fields: readonly string[], name: string): void {
    const prototype = ctor.prototype as AnyRecord;
    Object.defineProperty(ctor, RECORD_FIELDS, { value: fields });
    if (!Object.prototype.hasOwnProperty.call(prototype, 'Equals')) {
        Object.defineProperty(prototype, 'Equals', {
            value: function Equals(this: AnyRecord, other: unknown) {
                if (other === null || typeof other !== 'object' || (other as object).constructor !== ctor)
                    return false;
                return fields.every((field) => equals(this[field], (other as AnyRecord)[field]));
            },
            configurable: true,
            writable: true,
        });
    }
    if (!Object.prototype.hasOwnProperty.call(prototype, 'GetHashKey')) {
        Object.defineProperty(prototype, 'GetHashKey', {
            value: function GetHashKey(this: AnyRecord) {
                return `record:${name}:${fields.map((field) => String(hashKey(this[field]))).join('\u0000')}`;
            },
            configurable: true,
            writable: true,
        });
    }
    if (!Object.prototype.hasOwnProperty.call(prototype, 'ToString')) {
        Object.defineProperty(prototype, 'ToString', {
            value: function ToString(this: AnyRecord) {
                return `${name} { ${fields.map((field) => `${field} = ${str(this[field])}`).join(', ')} }`;
            },
            configurable: true,
            writable: true,
        });
    }
    if (!Object.prototype.hasOwnProperty.call(prototype, 'Deconstruct')) {
        Object.defineProperty(prototype, 'Deconstruct', {
            value: function Deconstruct(this: AnyRecord, ...refs: Ref<unknown>[]) {
                refs.forEach((ref, index) => {
                    if (ref && typeof ref === 'object')
                        ref.v = this[fields[index]];
                });
            },
            configurable: true,
            writable: true,
        });
    }
    if (!(Symbol.iterator in prototype)) {
        Object.defineProperty(prototype, Symbol.iterator, {
            value: function* iterator(this: AnyRecord) {
                for (const field of fields)
                    yield this[field];
            },
            configurable: true,
            writable: true,
        });
    }
}
export function dispose(resource: unknown): void {
    if (isNullish(resource))
        return;
    const object = resource as AnyRecord;
    for (const name of ['Dispose', 'dispose', 'destroy', 'close', 'Close']) {
        if (typeof object[name] === 'function') {
            ;
            (object[name] as Fn).call(object);
            return;
        }
    }
}
export function defaultOf(type: unknown): unknown {
    if (typeof type === 'string') {
        switch (type) {
            case 'int':
            case 'long':
            case 'short':
            case 'byte':
            case 'sbyte':
            case 'uint':
            case 'ulong':
            case 'ushort':
            case 'float':
            case 'double':
            case 'decimal':
                return 0;
            case 'bool':
                return false;
            case 'char':
                return '\u0000';
            default:
                return null;
        }
    }
    if (type !== null && typeof type === 'object' && ENUM_INFO in type)
        return 0;
    return null;
}
export interface HelixRoot extends Record<string, unknown> {
}
