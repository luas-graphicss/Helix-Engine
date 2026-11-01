const MAX_ITEMS = 8;
const MAX_DEPTH = 2;
const MAX_TEXT = 160;
export type ValueKind = 'undefined' | 'null' | 'boolean' | 'number' | 'string' | 'function' | 'array' | 'object' | 'entity' | 'vector' | 'error' | 'symbol' | 'bigint';
export interface FormattedValue {
    readonly text: string;
    readonly kind: ValueKind;
}
function isEntityLike(value: object): value is {
    name: string;
} {
    return 'name' in value && 'children' in value && 'parent' in value && 'transform' in value;
}
function formatNumber(value: number): string {
    if (Number.isInteger(value))
        return String(value);
    if (!Number.isFinite(value))
        return String(value);
    const fixed = Math.abs(value) >= 100 ? value.toFixed(1) : value.toFixed(3);
    return fixed.replace(/\.?0+$/, '');
}
function formatVector(value: ArrayLike<number>): string {
    const parts: string[] = [];
    for (let index = 0; index < Math.min(value.length, 4); index++)
        parts.push(formatNumber(value[index]));
    return `(${parts.join(', ')}${value.length > 4 ? ', …' : ''})`;
}
function clip(text: string): string {
    return text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT - 1)}…` : text;
}
export function formatValue(value: unknown, depth = 0): FormattedValue {
    switch (typeof value) {
        case 'undefined':
            return { text: 'undefined', kind: 'undefined' };
        case 'boolean':
            return { text: String(value), kind: 'boolean' };
        case 'number':
            return { text: formatNumber(value), kind: 'number' };
        case 'bigint':
            return { text: `${value}n`, kind: 'bigint' };
        case 'string':
            return { text: clip(JSON.stringify(value)), kind: 'string' };
        case 'symbol':
            return { text: value.toString(), kind: 'symbol' };
        case 'function': {
            const name = (value as {
                name?: string;
            }).name;
            return { text: name ? `ƒ ${name}()` : 'ƒ ()', kind: 'function' };
        }
    }
    if (value === null)
        return { text: 'null', kind: 'null' };
    const object = value as object;
    if (object instanceof Error)
        return { text: clip(`${object.name}: ${object.message}`), kind: 'error' };
    if (ArrayBuffer.isView(object) && !(object instanceof DataView)) {
        const typed = object as unknown as ArrayLike<number>;
        if (typed.length >= 2 && typed.length <= 4)
            return { text: formatVector(typed), kind: 'vector' };
        return { text: `${object.constructor.name}(${typed.length})`, kind: 'array' };
    }
    if (isEntityLike(object))
        return { text: `Ator "${object.name}"`, kind: 'entity' };
    if (Array.isArray(object)) {
        if (depth >= MAX_DEPTH)
            return { text: `Array(${object.length})`, kind: 'array' };
        const items = object.slice(0, MAX_ITEMS).map((item) => formatValue(item, depth + 1).text);
        return { text: clip(`[${items.join(', ')}${object.length > MAX_ITEMS ? `, … +${object.length - MAX_ITEMS}` : ''}]`), kind: 'array' };
    }
    if (object instanceof Map)
        return { text: `Map(${object.size})`, kind: 'object' };
    if (object instanceof Set)
        return { text: `Set(${object.size})`, kind: 'object' };
    if (object instanceof Date)
        return { text: object.toISOString(), kind: 'object' };
    if (object instanceof Promise)
        return { text: 'Promise', kind: 'object' };
    const constructorName = object.constructor && object.constructor !== Object ? object.constructor.name : '';
    if (depth >= MAX_DEPTH)
        return { text: constructorName ? `${constructorName} {…}` : '{…}', kind: 'object' };
    let keys: string[];
    try {
        keys = Object.keys(object);
    }
    catch {
        return { text: constructorName || 'Object', kind: 'object' };
    }
    const entries: string[] = [];
    for (const key of keys.slice(0, MAX_ITEMS)) {
        let item: unknown;
        try {
            item = (object as Record<string, unknown>)[key];
        }
        catch {
            item = '(getter com erro)';
        }
        entries.push(`${key}: ${formatValue(item, depth + 1).text}`);
    }
    const body = `{${entries.join(', ')}${keys.length > MAX_ITEMS ? `, … +${keys.length - MAX_ITEMS}` : ''}}`;
    return { text: clip(constructorName ? `${constructorName} ${body}` : body), kind: 'object' };
}
export function entriesOf(value: unknown, limit = 64): Array<{
    key: string;
    value: FormattedValue;
}> | null {
    if (value === null || (typeof value !== 'object' && typeof value !== 'function'))
        return null;
    let keys: string[];
    try {
        keys = Object.keys(value as object);
    }
    catch {
        return null;
    }
    if (keys.length === 0)
        return null;
    return keys.slice(0, limit).map((key) => {
        let item: unknown;
        try {
            item = (value as Record<string, unknown>)[key];
        }
        catch {
            item = '(getter com erro)';
        }
        return { key, value: formatValue(item, 1) };
    });
}
