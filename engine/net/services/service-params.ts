import type { NetValue } from '../wire/net-value';
import { ServiceError } from './service-protocol';
export type NetRecord = {
    [key: string]: NetValue;
};
export interface TextRule {
    readonly maxLength: number;
    readonly fallback?: string;
}
export interface IntegerRule {
    readonly min: number;
    readonly max: number;
    readonly fallback?: number;
}
const MAX_DATA_KEYS = 16;
const MAX_DATA_KEY_LENGTH = 32;
const MAX_DATA_VALUE_LENGTH = 2048;
export function isNetRecord(value: NetValue | undefined): value is NetRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function requireRecord(params: NetValue): NetRecord {
    if (!isNetRecord(params))
        throw new ServiceError('invalid', 'os parâmetros devem ser um objeto');
    return params;
}
export function readText(params: NetRecord, key: string, rule: TextRule): string {
    const value = params[key];
    if (value === undefined && rule.fallback !== undefined)
        return rule.fallback;
    if (typeof value !== 'string')
        throw new ServiceError('invalid', `"${key}" deve ser um texto`);
    const text = value.trim();
    if (text.length === 0 || text.length > rule.maxLength)
        throw new ServiceError('invalid', `"${key}" deve ter de 1 a ${rule.maxLength} caracteres`);
    return text;
}
export function readInteger(params: NetRecord, key: string, rule: IntegerRule): number {
    const value = params[key];
    if (value === undefined && rule.fallback !== undefined)
        return rule.fallback;
    if (typeof value !== 'number' || !Number.isInteger(value) || value < rule.min || value > rule.max)
        throw new ServiceError('invalid', `"${key}" deve ser um inteiro de ${rule.min} a ${rule.max}`);
    return value;
}
export function readFlag(params: NetRecord, key: string, fallback: boolean): boolean {
    const value = params[key];
    if (value === undefined)
        return fallback;
    if (typeof value !== 'boolean')
        throw new ServiceError('invalid', `"${key}" deve ser verdadeiro ou falso`);
    return value;
}
export function readData(params: NetRecord, key: string): NetRecord {
    const value = params[key];
    if (value === undefined)
        return {};
    if (!isNetRecord(value))
        throw new ServiceError('invalid', `"${key}" deve ser um objeto`);
    const entries = Object.entries(value);
    if (entries.length > MAX_DATA_KEYS)
        throw new ServiceError('invalid', `"${key}" aceita até ${MAX_DATA_KEYS} chaves`);
    for (const [name, entry] of entries)
        if (name.length > MAX_DATA_KEY_LENGTH || JSON.stringify(entry).length > MAX_DATA_VALUE_LENGTH)
            throw new ServiceError('invalid', `"${key}.${name}" é grande demais`);
    return structuredClone(value);
}
