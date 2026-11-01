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
