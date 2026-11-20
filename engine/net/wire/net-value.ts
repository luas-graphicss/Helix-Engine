import type { ByteReader } from './byte-reader';
import type { ByteWriter } from './byte-writer';
import { WireError } from './wire-error';
export type NetValue = null | boolean | number | string | NetValue[] | {
    [key: string]: NetValue;
};
export const MAX_NET_VALUE_DEPTH = 16;
export const MAX_NET_STRING_BYTES = 64 * 1024;
const MAX_NET_KEY_BYTES = 256;
const FORBIDDEN_KEYS: ReadonlySet<string> = new Set(['__proto__', 'constructor', 'prototype']);
const TAG_NULL = 0;
const TAG_FALSE = 1;
const TAG_TRUE = 2;
const TAG_POSITIVE_INTEGER = 3;
const TAG_NEGATIVE_INTEGER = 4;
const TAG_FLOAT = 5;
const TAG_STRING = 6;
const TAG_ARRAY = 7;
const TAG_OBJECT = 8;
const encoder = new TextEncoder();
export function isNetValue(value: unknown, depth = 0): value is NetValue {
    if (value === null || typeof value === 'boolean' || typeof value === 'string')
        return true;
    if (typeof value === 'number')
        return Number.isFinite(value);
    if (typeof value !== 'object' || depth >= MAX_NET_VALUE_DEPTH)
        return false;
    if (Array.isArray(value))
        return value.every((entry) => isNetValue(entry, depth + 1));
    const prototype: unknown = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null)
        return false;
    return Object.entries(value).every(([key, entry]) => !FORBIDDEN_KEYS.has(key) && isNetValue(entry, depth + 1));
}
function writeNumber(writer: ByteWriter, value: number): void {
    if (!Number.isFinite(value))
        throw new WireError(`${value} cannot cross the network`);
    if (!Number.isSafeInteger(value)) {
        writer.u8(TAG_FLOAT).f64(value);
        return;
    }
    if (value < 0)
        writer.u8(TAG_NEGATIVE_INTEGER).varuint(-value);
    else
        writer.u8(TAG_POSITIVE_INTEGER).varuint(value);
}
function writeText(writer: ByteWriter, text: string, maxBytes: number): void {
    const encoded = encoder.encode(text);
    if (encoded.length > maxBytes)
        throw new WireError(`text of ${encoded.length} bytes exceeds the ${maxBytes} byte limit`);
    writer.block(encoded);
}
export function writeNetValue(writer: ByteWriter, value: NetValue, depth = 0): void {
    if (value === null) {
        writer.u8(TAG_NULL);
        return;
    }
    if (typeof value === 'boolean') {
        writer.u8(value ? TAG_TRUE : TAG_FALSE);
        return;
    }
    if (typeof value === 'number') {
        writeNumber(writer, value);
        return;
    }
    if (typeof value === 'string') {
        writer.u8(TAG_STRING);
        writeText(writer, value, MAX_NET_STRING_BYTES);
        return;
    }
    if (depth >= MAX_NET_VALUE_DEPTH)
        throw new WireError(`value is nested deeper than ${MAX_NET_VALUE_DEPTH} levels`);
    if (Array.isArray(value)) {
        writer.u8(TAG_ARRAY).varuint(value.length);
        for (const entry of value)
            writeNetValue(writer, entry, depth + 1);
        return;
    }
    const entries = Object.entries(value);
    writer.u8(TAG_OBJECT).varuint(entries.length);
    for (const [key, entry] of entries) {
        if (FORBIDDEN_KEYS.has(key))
            throw new WireError(`key "${key}" cannot cross the network`);
        writeText(writer, key, MAX_NET_KEY_BYTES);
        writeNetValue(writer, entry, depth + 1);
    }
}
function readCount(reader: ByteReader, depth: number, minimumEntryBytes: number): number {
    if (depth >= MAX_NET_VALUE_DEPTH)
        throw new WireError(`value is nested deeper than ${MAX_NET_VALUE_DEPTH} levels`);
    const count = reader.varuint();
    if (count * minimumEntryBytes > reader.remaining)
        throw new WireError(`collection of ${count} entries does not fit in the message`);
    return count;
}
function readArray(reader: ByteReader, depth: number): NetValue[] {
    const count = readCount(reader, depth, 1);
    const entries: NetValue[] = [];
    for (let index = 0; index < count; index++)
        entries.push(readNetValue(reader, depth + 1));
    return entries;
}
function readObject(reader: ByteReader, depth: number): {
    [key: string]: NetValue;
} {
    const count = readCount(reader, depth, 2);
    const entries: {
        [key: string]: NetValue;
    } = {};
    for (let index = 0; index < count; index++) {
        const key = reader.string(MAX_NET_KEY_BYTES);
        if (FORBIDDEN_KEYS.has(key))
            throw new WireError(`key "${key}" cannot cross the network`);
        entries[key] = readNetValue(reader, depth + 1);
    }
    return entries;
}
function readFloat(reader: ByteReader): number {
    const value = reader.f64();
    if (!Number.isFinite(value))
        throw new WireError('non-finite number in the message');
    return value;
}
export function readNetValue(reader: ByteReader, depth = 0): NetValue {
    const tag = reader.u8();
    switch (tag) {
        case TAG_NULL:
            return null;
        case TAG_FALSE:
            return false;
        case TAG_TRUE:
            return true;
        case TAG_POSITIVE_INTEGER:
            return reader.varuint();
        case TAG_NEGATIVE_INTEGER:
            return -reader.varuint();
        case TAG_FLOAT:
            return readFloat(reader);
        case TAG_STRING:
            return reader.string(MAX_NET_STRING_BYTES);
        case TAG_ARRAY:
            return readArray(reader, depth);
        case TAG_OBJECT:
            return readObject(reader, depth);
        default:
            throw new WireError(`unknown value tag ${tag}`);
    }
}
export function writeNetValues(writer: ByteWriter, values: readonly NetValue[]): void {
    writer.varuint(values.length);
    for (const value of values)
        writeNetValue(writer, value);
}
export function readNetValues(reader: ByteReader): NetValue[] {
    return readArray(reader, 0);
}
