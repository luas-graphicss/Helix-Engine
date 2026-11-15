import type { JsonSchema } from '@/engine/mcp/protocol/json-schema';
import { isFiniteNumber, isRecord, type JsonRecord } from '@/engine/mcp/protocol/json-shape';
export type PreparedArguments = {
    readonly ok: true;
    readonly arguments: JsonRecord;
} | {
    readonly ok: false;
    readonly problem: string;
};
function parseJsonText(text: string): unknown {
    try {
        return JSON.parse(text);
    }
    catch {
        return undefined;
    }
}
function coerceText(schema: JsonSchema, text: string): unknown {
    switch (schema.type) {
        case 'number':
        case 'integer': {
            const parsed = Number(text);
            return text.trim() !== '' && Number.isFinite(parsed) ? parsed : text;
        }
        case 'boolean':
            if (text === 'true')
                return true;
            return text === 'false' ? false : text;
        case 'array': {
            const parsed = parseJsonText(text);
            return Array.isArray(parsed) ? coerceValue(schema, parsed) : [coerceValue(schema.items ?? {}, text)];
        }
        case 'object': {
            const parsed = parseJsonText(text);
            return isRecord(parsed) ? coerceRecord(schema, parsed) : text;
        }
        default:
            return text;
    }
}
function coerceValue(schema: JsonSchema, value: unknown): unknown {
    if (typeof value === 'string')
        return coerceText(schema, value);
    if (Array.isArray(value))
        return value.map((item) => coerceValue(schema.items ?? {}, item));
    return isRecord(value) ? coerceRecord(schema, value) : value;
}
function coerceRecord(schema: JsonSchema, record: JsonRecord): JsonRecord {
    const properties = schema.properties ?? {};
    const entries = Object.entries(record)
        .filter(([, value]) => value !== null && value !== undefined)
        .map(([name, value]) => [name, Object.hasOwn(properties, name) ? coerceValue(properties[name], value) : value] as const);
    return Object.fromEntries(entries);
}
function validateList(schema: JsonSchema, value: unknown, path: string): string | null {
    if (!Array.isArray(value))
        return `"${path}" must be a list`;
    if (schema.minItems !== undefined && value.length < schema.minItems)
        return `"${path}" needs at least ${schema.minItems} item(s)`;
    if (schema.maxItems !== undefined && value.length > schema.maxItems)
        return `"${path}" accepts at most ${schema.maxItems} item(s)`;
    for (const [index, item] of value.entries()) {
        const problem = validateValue(schema.items ?? {}, item, `${path}[${index}]`);
        if (problem)
            return problem;
    }
    return null;
}
function validateRecord(schema: JsonSchema, value: unknown, path: string): string | null {
    if (!isRecord(value))
        return `"${path}" must be an object`;
    const properties = schema.properties ?? {};
    const qualify = (name: string) => (path ? `${path}.${name}` : name);
    for (const [name, item] of Object.entries(value)) {
        if (!Object.hasOwn(properties, name))
            return `unknown argument "${qualify(name)}" (valid: ${Object.keys(properties).join(', ') || 'none'})`;
        const problem = validateValue(properties[name], item, qualify(name));
        if (problem)
            return problem;
    }
    const missing = (schema.required ?? []).find((name) => !Object.hasOwn(value, name));
    return missing === undefined ? null : `"${qualify(missing)}" is required`;
}
function validateScalar(schema: JsonSchema, value: unknown, path: string): string | null {
    switch (schema.type) {
        case 'string':
            return typeof value === 'string' ? null : `"${path}" must be a string`;
        case 'number':
            return isFiniteNumber(value) ? null : `"${path}" must be a number`;
        case 'integer':
            return isFiniteNumber(value) && Number.isInteger(value) ? null : `"${path}" must be an integer`;
        case 'boolean':
            return typeof value === 'boolean' ? null : `"${path}" must be true or false`;
        default:
            return null;
    }
}
function validateValue(schema: JsonSchema, value: unknown, path: string): string | null {
    if (schema.type === 'array')
        return validateList(schema, value, path);
    if (schema.type === 'object')
        return validateRecord(schema, value, path);
    const problem = validateScalar(schema, value, path);
    if (problem)
        return problem;
    if (schema.enum && !(typeof value === 'string' && schema.enum.includes(value)))
        return `"${path}" must be one of: ${schema.enum.join(', ')}`;
    return null;
}
export function prepareArguments(schema: JsonSchema, raw: unknown): PreparedArguments {
    if (raw !== undefined && raw !== null && !isRecord(raw))
        return { ok: false, problem: 'the arguments must be a JSON object' };
    const prepared = coerceRecord(schema, isRecord(raw) ? raw : {});
    const problem = validateRecord(schema, prepared, '');
    return problem ? { ok: false, problem } : { ok: true, arguments: prepared };
}
