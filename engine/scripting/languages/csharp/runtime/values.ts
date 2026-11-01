import { FormatException, InvalidCastException, OverflowException } from './errors';
export type AnyRecord = Record<string, unknown>;
export type Fn = (...args: unknown[]) => unknown;
export const TYPE_NAME = Symbol.for('helix.csharp.typeName');
export const RECORD_FIELDS = Symbol.for('helix.csharp.recordFields');
export const ENUM_INFO = Symbol.for('helix.csharp.enumInfo');
export interface EnumInfo {
    readonly name: string;
    readonly names: readonly string[];
    readonly values: readonly number[];
    readonly flags: boolean;
}
export function isNullish(value: unknown): value is null | undefined {
    return value === null || value === undefined;
}
function hasToString(value: object): value is {
    ToString(): unknown;
} {
    return typeof (value as {
        ToString?: unknown;
    }).ToString === 'function';
}
export function str(value: unknown): string {
    if (value === null || value === undefined)
        return '';
    switch (typeof value) {
        case 'string':
            return value;
        case 'boolean':
            return value ? 'True' : 'False';
        case 'number':
            return numberToString(value);
        case 'bigint':
            return value.toString();
        case 'function':
            return (value as {
                name?: string;
            }).name ? `Method ${(value as {
                name: string;
            }).name}` : 'Method';
        case 'symbol':
            return value.toString();
        default:
            break;
    }
    const object = value as object;
    if (hasToString(object) && !Array.isArray(object)) {
        const text = object.ToString();
        return typeof text === 'string' ? text : str(text);
    }
    if (Array.isArray(object))
        return `[${object.map((item) => str(item)).join(', ')}]`;
    if (object instanceof Map)
        return `{${Array.from(object.entries()).map(([key, item]) => `[${str(key)}, ${str(item)}]`).join(', ')}}`;
    if (object instanceof Set)
        return `{${Array.from(object).map((item) => str(item)).join(', ')}}`;
    if (object instanceof Error)
        return `${object.name}: ${object.message}`;
    if (object instanceof Promise)
        return 'Task';
    const named = (object as {
        [TYPE_NAME]?: string;
    })[TYPE_NAME] ?? object.constructor?.name;
    if (named && named !== 'Object')
        return named;
    try {
        return JSON.stringify(object);
    }
    catch {
        return Object.prototype.toString.call(object);
    }
}
export function numberToString(value: number): string {
    if (Number.isNaN(value))
        return 'NaN';
    if (value === Infinity)
        return '∞';
    if (value === -Infinity)
        return '-∞';
    if (Object.is(value, -0))
        return '-0';
    const text = String(value);
    if (!/e/i.test(text))
        return text;
    const fixed = Number(value.toPrecision(15));
    return String(fixed).replace(/e\+?/i, 'E');
}
export function format(value: unknown, specifier: string | null, alignment: number | null): string {
    let text: string;
    if (specifier && typeof value === 'number')
        text = formatNumber(value, specifier);
    else if (specifier && value instanceof Date)
        text = formatDate(value, specifier);
    else if (specifier && typeof value === 'object' && value !== null && typeof (value as {
        ToString?: unknown;
    }).ToString === 'function' && (value as {
        ToString: Fn;
    }).ToString.length >= 1) {
        text = str((value as {
            ToString: Fn;
        }).ToString(specifier));
    }
    else
        text = str(value);
    if (alignment === null || alignment === 0)
        return text;
    const width = Math.abs(alignment);
    if (text.length >= width)
        return text;
    return alignment > 0 ? text.padStart(width) : text.padEnd(width);
}
function group(integerDigits: string): string {
    return integerDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
export function formatNumber(value: number, specifier: string): string {
    const match = /^([a-zA-Z])(\d*)$/.exec(specifier);
    if (!match)
        return applyCustomFormat(value, specifier);
    const kind = match[1].toUpperCase();
    const digits = match[2] === '' ? null : Number(match[2]);
    switch (kind) {
        case 'F': {
            return value.toFixed(digits ?? 2);
        }
        case 'N': {
            const fixed = Math.abs(value).toFixed(digits ?? 2);
            const [whole, fraction] = fixed.split('.');
            return `${value < 0 ? '-' : ''}${group(whole)}${fraction ? `.${fraction}` : ''}`;
        }
        case 'P': {
            return `${formatNumber(value * 100, `N${digits ?? 2}`)} %`;
        }
        case 'C': {
            return `${value < 0 ? '-' : ''}$${formatNumber(Math.abs(value), `N${digits ?? 2}`)}`;
        }
        case 'D': {
            if (!Number.isInteger(value))
                throw new FormatException('O formato "D" só vale para inteiros.');
            const text = String(Math.abs(value));
            return `${value < 0 ? '-' : ''}${digits ? text.padStart(digits, '0') : text}`;
        }
        case 'X': {
            if (!Number.isInteger(value))
                throw new FormatException('O formato "X" só vale para inteiros.');
            const text = (value < 0 ? value >>> 0 : value).toString(16);
            const cased = match[1] === 'X' ? text.toUpperCase() : text;
            return digits ? cased.padStart(digits, '0') : cased;
        }
        case 'E': {
            const text = value.toExponential(digits ?? 6);
            return text.replace(/e([+-])(\d)$/, 'e$10$2').replace('e', match[1] === 'E' ? 'E' : 'e');
        }
        case 'G': {
            return digits ? String(Number(value.toPrecision(digits))) : numberToString(value);
        }
        case 'R':
            return numberToString(value);
        default:
            return applyCustomFormat(value, specifier);
    }
}
function applyCustomFormat(value: number, pattern: string): string {
    const [integerPattern, fractionPattern = ''] = pattern.split('.');
    const minFraction = (fractionPattern.match(/0/g) ?? []).length;
    const maxFraction = fractionPattern.replace(/[^0#]/g, '').length;
    let text = Math.abs(value).toFixed(maxFraction);
    if (maxFraction > minFraction)
        text = text.replace(/\.?0+$/, (zeros) => (zeros.startsWith('.') ? '' : zeros)).replace(/(\.\d*?)0+$/, '$1');
    let [whole, fraction = ''] = text.split('.');
    if (fraction.length < minFraction)
        fraction = fraction.padEnd(minFraction, '0');
    const minInteger = (integerPattern.match(/0/g) ?? []).length;
    if (whole.length < minInteger)
        whole = whole.padStart(minInteger, '0');
    if (integerPattern.includes(','))
        whole = group(whole);
    const sign = value < 0 ? '-' : '';
    return fraction.length > 0 ? `${sign}${whole}.${fraction}` : `${sign}${whole}`;
}
function pad(value: number, width = 2): string {
    return String(value).padStart(width, '0');
}
export function formatDate(date: Date, specifier: string): string {
    const tokens: Record<string, string> = {
        yyyy: String(date.getFullYear()),
        yy: pad(date.getFullYear() % 100),
        MM: pad(date.getMonth() + 1),
        M: String(date.getMonth() + 1),
        dd: pad(date.getDate()),
        d: String(date.getDate()),
        HH: pad(date.getHours()),
        H: String(date.getHours()),
        hh: pad(date.getHours() % 12 || 12),
        h: String(date.getHours() % 12 || 12),
        mm: pad(date.getMinutes()),
        m: String(date.getMinutes()),
        ss: pad(date.getSeconds()),
        s: String(date.getSeconds()),
        fff: pad(date.getMilliseconds(), 3),
        tt: date.getHours() < 12 ? 'AM' : 'PM',
    };
    if (specifier === 'd')
        return `${tokens.MM}/${tokens.dd}/${tokens.yyyy}`;
    if (specifier === 't')
        return `${tokens.HH}:${tokens.mm}`;
    if (specifier === 'T')
        return `${tokens.HH}:${tokens.mm}:${tokens.ss}`;
    if (specifier === 'g')
        return `${tokens.MM}/${tokens.dd}/${tokens.yyyy} ${tokens.HH}:${tokens.mm}`;
    if (specifier === 'o' || specifier === 'O')
        return date.toISOString();
    return specifier.replace(/yyyy|yy|MM|M|dd|d|HH|H|hh|h|mm|m|ss|s|fff|tt/g, (token) => tokens[token] ?? token);
}
export function toInt(value: unknown, context = 'conversão para int'): number {
    if (typeof value === 'number') {
        if (Number.isNaN(value) || !Number.isFinite(value))
            throw new OverflowException(`${context}: ${numberToString(value)} não cabe num int.`);
        return Math.trunc(value);
    }
    if (typeof value === 'boolean')
        return value ? 1 : 0;
    if (typeof value === 'string') {
        if (value.length === 1)
            return value.charCodeAt(0);
        throw new InvalidCastException(`${context}: não dá para converter a string "${value}" em int com um cast; use int.Parse.`);
    }
    if (value === null || value === undefined)
        throw new InvalidCastException(`${context}: o valor é nulo.`);
    throw new InvalidCastException(`${context}: não dá para converter ${describeType(value)} em int.`);
}
export function toFloat(value: unknown, context = 'conversão para float'): number {
    if (typeof value === 'number')
        return value;
    if (typeof value === 'boolean')
        return value ? 1 : 0;
    if (typeof value === 'string' && value.length === 1)
        return value.charCodeAt(0);
    if (value === null || value === undefined)
        throw new InvalidCastException(`${context}: o valor é nulo.`);
    throw new InvalidCastException(`${context}: não dá para converter ${describeType(value)} em float.`);
}
export function toChar(value: unknown): string {
    if (typeof value === 'string') {
        if (value.length === 1)
            return value;
        throw new InvalidCastException(`Não dá para converter a string "${value}" em char: ela tem ${value.length} caracteres.`);
    }
    if (typeof value === 'number')
        return String.fromCharCode(Math.trunc(value));
    throw new InvalidCastException(`Não dá para converter ${describeType(value)} em char.`);
}
export function charCode(value: unknown): number {
    if (typeof value === 'string' && value.length > 0)
        return value.charCodeAt(0);
    if (typeof value === 'number')
        return value;
    throw new InvalidCastException(`Esperado um char, encontrado ${describeType(value)}.`);
}
