export type TypedArrayKind = 'f32' | 'f64' | 'u8' | 'u8c' | 'u16' | 'u32' | 'i8' | 'i16' | 'i32';
export type TypedArray = Float32Array | Float64Array | Uint8Array | Uint8ClampedArray | Uint16Array | Uint32Array | Int8Array | Int16Array | Int32Array;
export interface TaggedArray {
    '@array': TypedArrayKind;
    values: number[];
}
export type PlainValue = null | boolean | number | string | PlainValue[] | TaggedArray | {
    [key: string]: PlainValue;
};
type TypedArrayConstructor = new (values: ArrayLike<number> | ArrayBuffer, byteOffset?: number, length?: number) => TypedArray;
const CONSTRUCTORS: Record<TypedArrayKind, TypedArrayConstructor> = {
    f32: Float32Array,
    f64: Float64Array,
    u8: Uint8Array,
    u8c: Uint8ClampedArray,
    u16: Uint16Array,
    u32: Uint32Array,
    i8: Int8Array,
    i16: Int16Array,
    i32: Int32Array,
};
export function typedArrayKind(array: TypedArray): TypedArrayKind {
    if (array instanceof Float32Array)
        return 'f32';
    if (array instanceof Float64Array)
        return 'f64';
    if (array instanceof Uint8ClampedArray)
        return 'u8c';
    if (array instanceof Uint8Array)
        return 'u8';
    if (array instanceof Uint16Array)
        return 'u16';
    if (array instanceof Uint32Array)
        return 'u32';
    if (array instanceof Int8Array)
        return 'i8';
    if (array instanceof Int16Array)
        return 'i16';
    return 'i32';
}
export function createTypedArray(kind: TypedArrayKind, values: ArrayLike<number>): TypedArray {
    return new CONSTRUCTORS[kind](values);
}
export function viewTypedArray(kind: TypedArrayKind, buffer: ArrayBuffer, byteOffset: number, length: number): TypedArray {
    return new CONSTRUCTORS[kind](buffer, byteOffset, length);
}
export function bytesPerElement(kind: TypedArrayKind): number {
    return (CONSTRUCTORS[kind] as unknown as {
        BYTES_PER_ELEMENT: number;
    }).BYTES_PER_ELEMENT;
}
export function isTypedArray(value: unknown): value is TypedArray {
    return ArrayBuffer.isView(value) && !(value instanceof DataView);
}
function isTaggedArray(value: unknown): value is TaggedArray {
    return typeof value === 'object' && value !== null && '@array' in value && Array.isArray((value as TaggedArray).values);
}
function isPlainObject(value: unknown): value is Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value) || isTypedArray(value))
        return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}
export function toPlain(value: unknown, path = 'valor'): PlainValue {
    if (value === null)
        return null;
    switch (typeof value) {
        case 'boolean':
        case 'string':
            return value;
        case 'number':
            return Number.isFinite(value) ? value : 0;
        case 'object':
            break;
        default:
            throw new Error(`${path}: ${typeof value} não é serializável.`);
    }
    if (isTypedArray(value))
        return { '@array': typedArrayKind(value), values: Array.from(value as ArrayLike<number>) };
    if (Array.isArray(value))
        return value.map((item, index) => toPlain(item, `${path}[${index}]`));
    if (!isPlainObject(value))
        throw new Error(`${path}: instâncias de ${value.constructor?.name ?? 'classe'} precisam de um codec próprio.`);
    const result: {
        [key: string]: PlainValue;
    } = {};
    for (const [key, item] of Object.entries(value)) {
        if (item === undefined || typeof item === 'function')
            continue;
        result[key] = toPlain(item, `${path}.${key}`);
    }
    return result;
}
export function fromPlain(value: PlainValue): unknown {
    if (value === null || typeof value !== 'object')
        return value;
    if (isTaggedArray(value))
        return createTypedArray(value['@array'], value.values);
    if (Array.isArray(value))
        return value.map(fromPlain);
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value))
        result[key] = fromPlain(item);
    return result;
}
export function restoreInto<T extends object>(target: T, source: PlainValue | undefined): T {
    if (!isPlainObject(source))
        return target;
    const record = target as Record<string, unknown>;
    for (const [key, item] of Object.entries(source)) {
        const current = record[key];
        if (isPlainObject(current) && isPlainObject(item) && !isTaggedArray(item)) {
            restoreInto(current, item);
        }
        else if (isTypedArray(current) && isTaggedArray(item)) {
            record[key] = createTypedArray(typedArrayKind(current), item.values);
        }
        else {
            record[key] = fromPlain(item);
        }
    }
    return target;
}
