import { ARRAY_STATICS, ENUMERABLE_STATICS, List, iterate } from './collections';
import { ArgumentException, ArgumentNullException, ArgumentOutOfRangeException, FormatException, InvalidOperationException, OverflowException } from './errors';
import { enumInfo, enumParse, enumToString, format, formatNumber, numberToString, str, toInt, type Fn } from './values';
export type ConsoleLike = {
    log(...args: unknown[]): void;
    info(...args: unknown[]): void;
    warn(...args: unknown[]): void;
    error(...args: unknown[]): void;
    debug?(...args: unknown[]): void;
};
type Ref<T> = {
    v: T;
};
function number(value: unknown, what: string): number {
    if (typeof value === 'number')
        return value;
    if (typeof value === 'boolean')
        return value ? 1 : 0;
    if (typeof value === 'string' && value.length === 1)
        return value.charCodeAt(0);
    throw new ArgumentException(`${what} espera um número, recebeu ${str(value)}.`);
}
export const MATH: Record<string, unknown> = {
    PI: Math.PI,
    E: Math.E,
    Tau: Math.PI * 2,
    Abs: (x: unknown) => Math.abs(number(x, 'Math.Abs')),
    Sign: (x: unknown) => Math.sign(number(x, 'Math.Sign')),
    Max: (a: unknown, b: unknown, ...rest: unknown[]) => Math.max(number(a, 'Math.Max'), number(b, 'Math.Max'), ...rest.map((value) => number(value, 'Math.Max'))),
    Min: (a: unknown, b: unknown, ...rest: unknown[]) => Math.min(number(a, 'Math.Min'), number(b, 'Math.Min'), ...rest.map((value) => number(value, 'Math.Min'))),
    Clamp: (x: unknown, low: unknown, high: unknown) => {
        const min = number(low, 'Math.Clamp');
        const max = number(high, 'Math.Clamp');
        if (min > max)
            throw new ArgumentException(`Math.Clamp: o mínimo (${min}) é maior que o máximo (${max}).`);
        return Math.min(max, Math.max(min, number(x, 'Math.Clamp')));
    },
    Floor: (x: unknown) => Math.floor(number(x, 'Math.Floor')),
    Ceiling: (x: unknown) => Math.ceil(number(x, 'Math.Ceiling')),
    Truncate: (x: unknown) => Math.trunc(number(x, 'Math.Truncate')),
    Round: (x: unknown, digits: unknown = 0, mode?: unknown) => {
        const value = number(x, 'Math.Round');
        const places = typeof digits === 'number' ? digits : 0;
        const awayFromZero = mode === 1 || digits === 1;
        const factor = 10 ** places;
        const scaled = value * factor;
        const floor = Math.floor(scaled);
        const diff = scaled - floor;
        let rounded: number;
        if (Math.abs(diff - 0.5) < 1e-9)
            rounded = awayFromZero ? (scaled > 0 ? floor + 1 : floor) : floor % 2 === 0 ? floor : floor + 1;
        else
            rounded = Math.round(scaled);
        return rounded / factor;
    },
    Sqrt: (x: unknown) => Math.sqrt(number(x, 'Math.Sqrt')),
    Cbrt: (x: unknown) => Math.cbrt(number(x, 'Math.Cbrt')),
    Pow: (x: unknown, y: unknown) => Math.pow(number(x, 'Math.Pow'), number(y, 'Math.Pow')),
    Exp: (x: unknown) => Math.exp(number(x, 'Math.Exp')),
    Log: (x: unknown, base?: unknown) => (base === undefined ? Math.log(number(x, 'Math.Log')) : Math.log(number(x, 'Math.Log')) / Math.log(number(base, 'Math.Log'))),
    Log10: (x: unknown) => Math.log10(number(x, 'Math.Log10')),
    Log2: (x: unknown) => Math.log2(number(x, 'Math.Log2')),
    Sin: (x: unknown) => Math.sin(number(x, 'Math.Sin')),
    Cos: (x: unknown) => Math.cos(number(x, 'Math.Cos')),
    Tan: (x: unknown) => Math.tan(number(x, 'Math.Tan')),
    Asin: (x: unknown) => Math.asin(number(x, 'Math.Asin')),
    Acos: (x: unknown) => Math.acos(number(x, 'Math.Acos')),
    Atan: (x: unknown) => Math.atan(number(x, 'Math.Atan')),
    Atan2: (y: unknown, x: unknown) => Math.atan2(number(y, 'Math.Atan2'), number(x, 'Math.Atan2')),
    Sinh: (x: unknown) => Math.sinh(number(x, 'Math.Sinh')),
    Cosh: (x: unknown) => Math.cosh(number(x, 'Math.Cosh')),
    Tanh: (x: unknown) => Math.tanh(number(x, 'Math.Tanh')),
    DivRem: (a: unknown, b: unknown, out?: Ref<number>) => {
        const left = number(a, 'Math.DivRem');
        const right = number(b, 'Math.DivRem');
        if (right === 0)
            throw new ArgumentException('Math.DivRem: divisão por zero.');
        const quotient = Math.trunc(left / right);
        const remainder = left % right;
        if (out) {
            out.v = remainder;
            return quotient;
        }
        return new (class {
            Quotient = quotient;
            Remainder = remainder;
            Item1 = quotient;
            Item2 = remainder;
            *[Symbol.iterator]() {
                yield quotient;
                yield remainder;
            }
        })();
    },
    IEEERemainder: (a: unknown, b: unknown) => {
        const left = number(a, 'Math.IEEERemainder');
        const right = number(b, 'Math.IEEERemainder');
        return left - right * Math.round(left / right);
    },
    BigMul: (a: unknown, b: unknown) => number(a, 'Math.BigMul') * number(b, 'Math.BigMul'),
};
export const MATHF = MATH;
const INT_PATTERN = /^[+-]?\d+$/;
const FLOAT_PATTERN = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;
function parseInteger(text: unknown, what: string, min: number, max: number): number {
    if (text === null || text === undefined)
        throw new ArgumentNullException('s', `${what}: o texto é nulo.`);
    const trimmed = String(text).trim();
    if (!INT_PATTERN.test(trimmed))
        throw new FormatException(`${what}: "${trimmed}" não é um inteiro válido.`);
    const value = Number(trimmed);
    if (value < min || value > max)
        throw new OverflowException(`${what}: ${trimmed} está fora do intervalo do tipo.`);
    return value;
}
function parseFloat(text: unknown, what: string): number {
    if (text === null || text === undefined)
        throw new ArgumentNullException('s', `${what}: o texto é nulo.`);
    const trimmed = String(text).trim().replace(',', '.');
    if (/^[+-]?(infinity|∞)$/i.test(trimmed))
        return trimmed.startsWith('-') ? -Infinity : Infinity;
    if (/^nan$/i.test(trimmed))
        return NaN;
    if (!FLOAT_PATTERN.test(trimmed))
        throw new FormatException(`${what}: "${trimmed}" não é um número válido.`);
    return Number(trimmed);
}
function integerStatics(name: string, min: number, max: number): Record<string, unknown> {
    return {
        MinValue: min,
        MaxValue: max,
        Parse: (text: unknown) => parseInteger(text, `${name}.Parse`, min, max),
        TryParse: (text: unknown, out: Ref<number>) => {
            try {
                out.v = parseInteger(text, `${name}.TryParse`, min, max);
                return true;
            }
            catch {
                out.v = 0;
                return false;
            }
        },
        Equals: (a: unknown, b: unknown) => a === b,
        IsEvenInteger: (x: unknown) => Number(x) % 2 === 0,
        IsOddInteger: (x: unknown) => Math.abs(Number(x) % 2) === 1,
        IsNegative: (x: unknown) => Number(x) < 0,
        IsPositive: (x: unknown) => Number(x) >= 0,
        Abs: (x: unknown) => Math.abs(number(x, `${name}.Abs`)),
        Max: (a: unknown, b: unknown) => Math.max(number(a, `${name}.Max`), number(b, `${name}.Max`)),
        Min: (a: unknown, b: unknown) => Math.min(number(a, `${name}.Min`), number(b, `${name}.Min`)),
        Clamp: (x: unknown, low: unknown, high: unknown) => (MATH.Clamp as Fn)(x, low, high),
    };
}
function floatStatics(name: string, max: number, epsilon: number): Record<string, unknown> {
    return {
        MinValue: -max,
        MaxValue: max,
        Epsilon: epsilon,
        NaN: NaN,
        PositiveInfinity: Infinity,
        NegativeInfinity: -Infinity,
        Pi: Math.PI,
        E: Math.E,
        Tau: Math.PI * 2,
        Parse: (text: unknown) => parseFloat(text, `${name}.Parse`),
        TryParse: (text: unknown, out: Ref<number>) => {
            try {
                out.v = parseFloat(text, `${name}.TryParse`);
                return true;
            }
            catch {
                out.v = 0;
                return false;
            }
        },
        IsNaN: (x: unknown) => Number.isNaN(x),
        IsInfinity: (x: unknown) => x === Infinity || x === -Infinity,
        IsPositiveInfinity: (x: unknown) => x === Infinity,
        IsNegativeInfinity: (x: unknown) => x === -Infinity,
        IsFinite: (x: unknown) => Number.isFinite(x),
        IsNormal: (x: unknown) => Number.isFinite(x) && x !== 0,
        IsNegative: (x: unknown) => Number(x) < 0 || Object.is(x, -0),
        IsInteger: (x: unknown) => Number.isInteger(x),
        Abs: (x: unknown) => Math.abs(number(x, `${name}.Abs`)),
        Max: (a: unknown, b: unknown) => Math.max(number(a, `${name}.Max`), number(b, `${name}.Max`)),
        Min: (a: unknown, b: unknown) => Math.min(number(a, `${name}.Min`), number(b, `${name}.Min`)),
        Round: (x: unknown, digits?: unknown) => (MATH.Round as Fn)(x, digits),
        Floor: (x: unknown) => Math.floor(number(x, `${name}.Floor`)),
        Ceiling: (x: unknown) => Math.ceil(number(x, `${name}.Ceiling`)),
        Truncate: (x: unknown) => Math.trunc(number(x, `${name}.Truncate`)),
        Sqrt: (x: unknown) => Math.sqrt(number(x, `${name}.Sqrt`)),
        Pow: (x: unknown, y: unknown) => Math.pow(number(x, `${name}.Pow`), number(y, `${name}.Pow`)),
        Clamp: (x: unknown, low: unknown, high: unknown) => (MATH.Clamp as Fn)(x, low, high),
        Lerp: (a: unknown, b: unknown, t: unknown) => number(a, `${name}.Lerp`) + (number(b, `${name}.Lerp`) - number(a, `${name}.Lerp`)) * number(t, `${name}.Lerp`),
        Equals: (a: unknown, b: unknown) => a === b || (Number.isNaN(a) && Number.isNaN(b)),
    };
}
export const INT = integerStatics('int', -2147483648, 2147483647);
export const LONG = integerStatics('long', Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
export const SHORT = integerStatics('short', -32768, 32767);
export const BYTE = integerStatics('byte', 0, 255);
export const SBYTE = integerStatics('sbyte', -128, 127);
export const UINT = integerStatics('uint', 0, 4294967295);
export const ULONG = integerStatics('ulong', 0, Number.MAX_SAFE_INTEGER);
export const USHORT = integerStatics('ushort', 0, 65535);
export const FLOAT = floatStatics('float', 3.4028235e38, 1.401298e-45);
export const DOUBLE = floatStatics('double', Number.MAX_VALUE, Number.MIN_VALUE);
export const DECIMAL = floatStatics('decimal', 7.922816251426434e28, 1e-28);
export const BOOL: Record<string, unknown> = {
    TrueString: 'True',
    FalseString: 'False',
    Parse: (text: unknown) => {
        const normalized = String(text).trim().toLowerCase();
        if (normalized === 'true')
            return true;
        if (normalized === 'false')
            return false;
        throw new FormatException(`bool.Parse: "${str(text)}" não é "true" nem "false".`);
    },
    TryParse: (text: unknown, out: Ref<boolean>) => {
        const normalized = String(text ?? '').trim().toLowerCase();
        out.v = normalized === 'true';
        return normalized === 'true' || normalized === 'false';
    },
};
function char(value: unknown, what: string): string {
    if (typeof value === 'string' && value.length === 1)
        return value;
    if (typeof value === 'number')
        return String.fromCharCode(value);
    throw new ArgumentException(`${what} espera um char, recebeu ${str(value)}.`);
}
export const CHAR: Record<string, unknown> = {
    MinValue: '\u0000',
    MaxValue: '\uffff',
    IsDigit: (c: unknown) => /^\p{Nd}$/u.test(char(c, 'char.IsDigit')),
    IsNumber: (c: unknown) => /^\p{N}$/u.test(char(c, 'char.IsNumber')),
    IsLetter: (c: unknown) => /^\p{L}$/u.test(char(c, 'char.IsLetter')),
    IsLetterOrDigit: (c: unknown) => /^[\p{L}\p{Nd}]$/u.test(char(c, 'char.IsLetterOrDigit')),
    IsWhiteSpace: (c: unknown) => /^\s$/u.test(char(c, 'char.IsWhiteSpace')),
    IsUpper: (c: unknown) => {
        const text = char(c, 'char.IsUpper');
        return text !== text.toLowerCase() && text === text.toUpperCase();
    },
    IsLower: (c: unknown) => {
        const text = char(c, 'char.IsLower');
        return text !== text.toUpperCase() && text === text.toLowerCase();
    },
    IsPunctuation: (c: unknown) => /^\p{P}$/u.test(char(c, 'char.IsPunctuation')),
    IsSymbol: (c: unknown) => /^\p{S}$/u.test(char(c, 'char.IsSymbol')),
    IsControl: (c: unknown) => /^\p{Cc}$/u.test(char(c, 'char.IsControl')),
    IsAscii: (c: unknown) => char(c, 'char.IsAscii').charCodeAt(0) < 128,
    ToUpper: (c: unknown) => char(c, 'char.ToUpper').toUpperCase(),
    ToLower: (c: unknown) => char(c, 'char.ToLower').toLowerCase(),
    ToUpperInvariant: (c: unknown) => char(c, 'char.ToUpperInvariant').toUpperCase(),
    ToLowerInvariant: (c: unknown) => char(c, 'char.ToLowerInvariant').toLowerCase(),
    GetNumericValue: (c: unknown) => {
        const text = char(c, 'char.GetNumericValue');
        return /^\d$/.test(text) ? Number(text) : -1;
    },
    Parse: (text: unknown) => {
        const value = String(text);
        if (value.length !== 1)
            throw new FormatException(`char.Parse: "${value}" precisa ter exatamente um caractere.`);
        return value;
    },
    TryParse: (text: unknown, out: Ref<string>) => {
        const value = String(text ?? '');
        out.v = value.length === 1 ? value : '\u0000';
        return value.length === 1;
    },
    ConvertFromUtf32: (code: unknown) => String.fromCodePoint(Number(code)),
    ConvertToUtf32: (text: unknown, index: unknown = 0) => String(text).codePointAt(Number(index)) ?? 0,
    IsSurrogate: (c: unknown) => /^[\ud800-\udfff]$/.test(char(c, 'char.IsSurrogate')),
};
function text(value: unknown, what: string): string {
    if (value === null || value === undefined)
        throw new ArgumentNullException('value', `${what}: a string é nula.`);
    return str(value);
}
export function formatString(template: unknown, args: readonly unknown[]): string {
    const pattern = text(template, 'string.Format');
    const values = args.length === 1 && Array.isArray(args[0]) && !pattern.includes('{1}') ? (args[0] as unknown[]) : args;
    return pattern.replace(/\{\{|\}\}|\{(\d+)(?:,(-?\d+))?(?::([^}]*))?\}/g, (match, index: string | undefined, alignment: string | undefined, specifier: string | undefined) => {
        if (match === '{{')
            return '{';
        if (match === '}}')
            return '}';
        const position = Number(index);
        if (position >= values.length)
            throw new FormatException(`string.Format: o índice {${position}} não tem argumento correspondente (${values.length} argumentos).`);
        return format(values[position], specifier ?? null, alignment === undefined ? null : Number(alignment));
    });
}
export const STRING_STATICS: Record<string, unknown> = {
    Empty: '',
    IsNullOrEmpty: (value: unknown) => value === null || value === undefined || value === '',
    IsNullOrWhiteSpace: (value: unknown) => value === null || value === undefined || String(value).trim() === '',
    Join: (separator: unknown, ...parts: unknown[]) => {
        const items = parts.length === 1 && parts[0] !== null && typeof parts[0] === 'object' ? Array.from(iterate(parts[0], 'string.Join')) : parts;
        return items.map((item) => str(item)).join(str(separator));
    },
    Concat: (...parts: unknown[]) => {
        const items = parts.length === 1 && parts[0] !== null && typeof parts[0] === 'object' ? Array.from(iterate(parts[0], 'string.Concat')) : parts;
        return items.map((item) => str(item)).join('');
    },
    Format: (template: unknown, ...args: unknown[]) => formatString(template, args),
    Compare: (a: unknown, b: unknown, ignoreCase: unknown = false) => {
        const left = ignoreCase === true ? str(a).toLowerCase() : str(a);
        const right = ignoreCase === true ? str(b).toLowerCase() : str(b);
        return left < right ? -1 : left > right ? 1 : 0;
    },
    CompareOrdinal: (a: unknown, b: unknown) => (str(a) < str(b) ? -1 : str(a) > str(b) ? 1 : 0),
    Equals: (a: unknown, b: unknown, comparison?: unknown) => (comparison === 'OrdinalIgnoreCase' || comparison === 5 || comparison === 3 ? str(a).toLowerCase() === str(b).toLowerCase() : a === b),
    Copy: (value: unknown) => str(value),
    Intern: (value: unknown) => str(value),
};
export const STRING_METHODS: Record<string, (self: string, ...args: unknown[]) => unknown> = {
    ToString: (self, specifier?) => (specifier === undefined ? self : self),
    ToUpper: (self) => self.toUpperCase(),
    ToLower: (self) => self.toLowerCase(),
    ToUpperInvariant: (self) => self.toUpperCase(),
    ToLowerInvariant: (self) => self.toLowerCase(),
    Trim: (self, ...chars) => (chars.length === 0 ? self.trim() : trimChars(self, chars, true, true)),
    TrimStart: (self, ...chars) => (chars.length === 0 ? self.trimStart() : trimChars(self, chars, true, false)),
    TrimEnd: (self, ...chars) => (chars.length === 0 ? self.trimEnd() : trimChars(self, chars, false, true)),
    Contains: (self, value, comparison?) => (isIgnoreCase(comparison) ? self.toLowerCase().includes(str(value).toLowerCase()) : self.includes(str(value))),
    StartsWith: (self, value, comparison?) => (isIgnoreCase(comparison) ? self.toLowerCase().startsWith(str(value).toLowerCase()) : self.startsWith(str(value))),
    EndsWith: (self, value, comparison?) => (isIgnoreCase(comparison) ? self.toLowerCase().endsWith(str(value).toLowerCase()) : self.endsWith(str(value))),
    IndexOf: (self, value, start = 0, comparisonOrCount?) => {
        const from = Number(start);
        if (isIgnoreCase(comparisonOrCount) || isIgnoreCase(start))
            return self.toLowerCase().indexOf(str(value).toLowerCase(), typeof start === 'number' ? from : 0);
        return self.indexOf(str(value), from);
    },
    LastIndexOf: (self, value, start?) => (start === undefined ? self.lastIndexOf(str(value)) : self.lastIndexOf(str(value), Number(start))),
    IndexOfAny: (self, chars, start = 0) => {
        const set = Array.from(iterate(chars, 'IndexOfAny')).map((c) => str(c));
        for (let index = Number(start); index < self.length; index++)
            if (set.includes(self[index]))
                return index;
        return -1;
    },
    LastIndexOfAny: (self, chars) => {
        const set = Array.from(iterate(chars, 'LastIndexOfAny')).map((c) => str(c));
        for (let index = self.length - 1; index >= 0; index--)
            if (set.includes(self[index]))
                return index;
        return -1;
    },
    Substring: (self, start, length?) => {
        const from = Number(start);
        if (!Number.isInteger(from) || from < 0 || from > self.length)
            throw new ArgumentOutOfRangeException('startIndex', `Substring: início ${str(start)} fora da string (Length = ${self.length}).`);
        if (length === undefined)
            return self.slice(from);
        const count = Number(length);
        if (!Number.isInteger(count) || count < 0 || from + count > self.length)
            throw new ArgumentOutOfRangeException('length', `Substring: ${str(length)} caracteres a partir de ${from} passam do fim da string (Length = ${self.length}).`);
        return self.slice(from, from + count);
    },
    Replace: (self, search, replacement, comparison?) => {
        const needle = str(search);
        if (needle === '')
            throw new ArgumentException('Replace: o texto procurado não pode ser vazio.');
        if (isIgnoreCase(comparison))
            return self.replace(new RegExp(escapeRegExp(needle), 'gi'), () => str(replacement));
        return self.split(needle).join(str(replacement));
    },
    Split: (self, ...args) => {
        let separators: string[];
        let options: unknown = undefined;
        let count: number | null = null;
        const first = args[0];
        if (first === undefined || first === null)
            separators = [];
        else if (typeof first === 'object' && typeof (first as Iterable<unknown>)[Symbol.iterator] === 'function' && typeof first !== 'string')
            separators = Array.from(first as Iterable<unknown>).map((s) => str(s));
        else
            separators = [str(first)];
        for (const extra of args.slice(1)) {
            if (typeof extra === 'number') {
                if (count === null && !isSplitOption(extra))
                    count = extra;
                else
                    options = extra;
            }
            else if (typeof extra === 'string' && extra.length > 0 && !isSplitOption(extra))
                separators.push(extra);
            else
                options = extra;
        }
        let parts: string[];
        if (separators.length === 0)
            parts = self.split(/\s+/);
        else
            parts = self.split(new RegExp(separators.filter((s) => s.length > 0).map(escapeRegExp).join('|')));
        if (count !== null && count > 0 && parts.length > count)
            parts = [...parts.slice(0, count - 1), parts.slice(count - 1).join(separators[0] ?? ' ')];
        if (options === 1 || options === 'RemoveEmptyEntries' || options === 3)
            parts = parts.filter((part) => part !== '');
        if (options === 2 || options === 'TrimEntries' || options === 3)
            parts = parts.map((part) => part.trim());
        return parts;
    },
    PadLeft: (self, width, padding = ' ') => self.padStart(Number(width), str(padding)),
    PadRight: (self, width, padding = ' ') => self.padEnd(Number(width), str(padding)),
    Insert: (self, index, value) => {
        const at = Number(index);
        if (at < 0 || at > self.length)
            throw new ArgumentOutOfRangeException('startIndex', `Insert: índice ${str(index)} fora da string.`);
        return self.slice(0, at) + str(value) + self.slice(at);
    },
    Remove: (self, start, length?) => {
        const from = Number(start);
        if (from < 0 || from > self.length)
            throw new ArgumentOutOfRangeException('startIndex', `Remove: índice ${str(start)} fora da string.`);
        return length === undefined ? self.slice(0, from) : self.slice(0, from) + self.slice(from + Number(length));
    },
    ToCharArray: (self) => Array.from(self),
    CompareTo: (self, other) => (self < str(other) ? -1 : self > str(other) ? 1 : 0),
    Equals: (self, other, comparison?) => (isIgnoreCase(comparison) ? self.toLowerCase() === str(other).toLowerCase() : self === other),
    GetHashCode: (self) => {
        let hash = 0;
        for (let index = 0; index < self.length; index++)
            hash = (hash * 31 + self.charCodeAt(index)) | 0;
        return hash;
    },
    Clone: (self) => self,
    Normalize: (self) => self.normalize(),
    GetType: (self) => ({ Name: 'String', FullName: 'System.String', ToString: () => 'System.String' }),
    GetEnumerator: (self) => self[Symbol.iterator](),
    Count: (self, predicate?) => (typeof predicate === 'function' ? Array.from(self).filter((c) => Boolean((predicate as Fn)(c))).length : self.length),
};
function isIgnoreCase(comparison: unknown): boolean {
    return comparison === 'OrdinalIgnoreCase' || comparison === 'InvariantCultureIgnoreCase' || comparison === 'CurrentCultureIgnoreCase' || comparison === 1 || comparison === 3 || comparison === 5;
}
function isSplitOption(value: unknown): boolean {
    return value === 'None' || value === 'RemoveEmptyEntries' || value === 'TrimEntries';
}
function trimChars(self: string, chars: unknown[], start: boolean, end: boolean): string {
    const set = new Set(chars.flatMap((c) => (Array.isArray(c) ? c.map((item) => str(item)) : [str(c)])));
    let from = 0;
    let to = self.length;
    if (start)
        while (from < to && set.has(self[from]))
            from++;
    if (end)
        while (to > from && set.has(self[to - 1]))
            to--;
    return self.slice(from, to);
}
export function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
export const STRING_COMPARISON: Record<string, unknown> = { CurrentCulture: 0, CurrentCultureIgnoreCase: 1, InvariantCulture: 2, InvariantCultureIgnoreCase: 3, Ordinal: 4, OrdinalIgnoreCase: 5 };
export const STRING_SPLIT_OPTIONS: Record<string, unknown> = { None: 0, RemoveEmptyEntries: 1, TrimEntries: 2 };
export const MIDPOINT_ROUNDING: Record<string, unknown> = { ToEven: 0, AwayFromZero: 1, ToZero: 2, ToNegativeInfinity: 3, ToPositiveInfinity: 4 };
export class StringBuilder {
    private parts: string[] = [];
    private length = 0;
    constructor(initial?: unknown) {
        if (typeof initial === 'string')
            this.Append(initial);
    }
    get Length(): number {
        return this.length;
    }
    set Length(value: number) {
        const text = this.ToString().slice(0, Math.max(0, value));
        this.parts = [text];
        this.length = text.length;
    }
    Append(value: unknown, ...rest: unknown[]): this {
        const chunk = rest.length === 2 && typeof value === 'string' ? value.slice(Number(rest[0]), Number(rest[0]) + Number(rest[1])) : str(value);
        this.parts.push(chunk);
        this.length += chunk.length;
        return this;
    }
    AppendLine(value: unknown = ''): this {
        return this.Append(`${str(value)}\n`);
    }
    AppendFormat(template: unknown, ...args: unknown[]): this {
        return this.Append(formatString(template, args));
    }
    AppendJoin(separator: unknown, ...values: unknown[]): this {
        return this.Append((STRING_STATICS.Join as Fn)(separator, ...values));
    }
    Insert(index: unknown, value: unknown): this {
        const current = this.ToString();
        const at = Number(index);
        this.parts = [current.slice(0, at) + str(value) + current.slice(at)];
        this.length = this.parts[0].length;
        return this;
    }
    Remove(start: unknown, count: unknown): this {
        const current = this.ToString();
        this.parts = [current.slice(0, Number(start)) + current.slice(Number(start) + Number(count))];
        this.length = this.parts[0].length;
        return this;
    }
    Replace(search: unknown, replacement: unknown): this {
        this.parts = [this.ToString().split(str(search)).join(str(replacement))];
        this.length = this.parts[0].length;
        return this;
    }
    Clear(): this {
        this.parts = [];
        this.length = 0;
        return this;
    }
    ToString(): string {
        if (this.parts.length > 1)
            this.parts = [this.parts.join('')];
        return this.parts[0] ?? '';
    }
    Equals(other: unknown): boolean {
        return other instanceof StringBuilder && other.ToString() === this.ToString();
    }
}
export const CONVERT: Record<string, unknown> = {
    ToInt32: (value: unknown) => convertToInteger(value, 'Convert.ToInt32'),
    ToInt64: (value: unknown) => convertToInteger(value, 'Convert.ToInt64'),
    ToInt16: (value: unknown) => convertToInteger(value, 'Convert.ToInt16'),
    ToByte: (value: unknown) => convertToInteger(value, 'Convert.ToByte'),
    ToDouble: (value: unknown) => convertToFloat(value, 'Convert.ToDouble'),
    ToSingle: (value: unknown) => convertToFloat(value, 'Convert.ToSingle'),
    ToDecimal: (value: unknown) => convertToFloat(value, 'Convert.ToDecimal'),
    ToBoolean: (value: unknown) => {
        if (typeof value === 'boolean')
            return value;
        if (typeof value === 'number')
            return value !== 0;
        if (typeof value === 'string')
            return (BOOL.Parse as Fn)(value);
        if (value === null || value === undefined)
            return false;
        throw new FormatException(`Convert.ToBoolean: não dá para converter ${str(value)}.`);
    },
    ToString: (value: unknown, base?: unknown) => (typeof base === 'number' && typeof value === 'number' ? value.toString(base) : str(value)),
    ToChar: (value: unknown) => (typeof value === 'number' ? String.fromCharCode(value) : char(value, 'Convert.ToChar')),
    ToBase64String: (bytes: unknown) => {
        const array = Array.from(iterate(bytes, 'Convert.ToBase64String')).map((b) => Number(b));
        return typeof btoa === 'function' ? btoa(String.fromCharCode(...array)) : '';
    },
    FromBase64String: (textValue: unknown) => (typeof atob === 'function' ? Array.from(atob(str(textValue))).map((c) => c.charCodeAt(0)) : []),
};
function convertToInteger(value: unknown, what: string): number {
    if (value === null || value === undefined)
        return 0;
    if (typeof value === 'number')
        return (MATH.Round as Fn)(value) as number;
    if (typeof value === 'boolean')
        return value ? 1 : 0;
    if (typeof value === 'string') {
        if (value.length === 1 && !/\d/.test(value))
            return value.charCodeAt(0);
        return parseInteger(value, what, Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
    }
    throw new FormatException(`${what}: não dá para converter ${str(value)}.`);
}
function convertToFloat(value: unknown, what: string): number {
    if (value === null || value === undefined)
        return 0;
    if (typeof value === 'number')
        return value;
    if (typeof value === 'boolean')
        return value ? 1 : 0;
    if (typeof value === 'string')
        return parseFloat(value, what);
    throw new FormatException(`${what}: não dá para converter ${str(value)}.`);
}
export const ENUM_STATICS: Record<string, unknown> = {
    GetNames: (enumObject: unknown) => List.from(enumInfo(enumObject)?.names ?? []).ToArray(),
    GetValues: (enumObject: unknown) => (enumInfo(enumObject)?.values ?? []).slice(),
    GetName: (enumObject: unknown, value: unknown) => {
        const info = enumInfo(enumObject);
        const index = info ? info.values.indexOf(Number(value)) : -1;
        return index >= 0 && info ? info.names[index] : null;
    },
    IsDefined: (enumObject: unknown, value: unknown) => {
        const info = enumInfo(enumObject);
        return info !== null && (typeof value === 'string' ? info.names.includes(value) : info.values.includes(Number(value)));
    },
    Parse: (enumObject: unknown, textValue: unknown, ignoreCase: unknown = false) => {
        const value = enumParse(enumObject, textValue, ignoreCase === true);
        if (value === null)
            throw new ArgumentException(`Enum.Parse: "${str(textValue)}" não é um valor de ${enumInfo(enumObject)?.name ?? 'enum'}.`);
        return value;
    },
    TryParse: (enumObject: unknown, textValue: unknown, ...rest: unknown[]) => {
        const out = rest[rest.length - 1] as Ref<unknown>;
        const ignoreCase = rest.length > 1 && rest[0] === true;
        const value = enumParse(enumObject, textValue, ignoreCase);
        if (out && typeof out === 'object')
            out.v = value ?? 0;
        return value !== null;
    },
    ToString: (enumObject: unknown, value: unknown) => enumToString(enumObject, value),
    Format: (enumObject: unknown, value: unknown) => enumToString(enumObject, value),
    ToObject: (_enumObject: unknown, value: unknown) => Number(value),
};
type Scheduler = {
    wait?(seconds: number): Promise<unknown>;
    delay?(seconds: number): Promise<unknown>;
};
export function createTaskStatics(helix: Record<string, unknown>): Record<string, unknown> {
    const delay = (ms: unknown): Promise<void> => {
        const seconds = Math.max(0, Number(ms)) / 1000;
        const time = helix.time as Scheduler | undefined;
        if (time && typeof time.wait === 'function')
            return time.wait(seconds).then(() => undefined);
        return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
    };
    const yieldNow = (): Promise<void> => {
        const time = helix.time as Scheduler | undefined;
        if (time && typeof time.wait === 'function')
            return time.wait(0).then(() => undefined);
        return Promise.resolve();
    };
    return {
        CompletedTask: Promise.resolve(),
        Delay: delay,
        Yield: yieldNow,
        FromResult: (value: unknown) => Promise.resolve(value),
        FromException: (error: unknown) => Promise.reject(error),
        WhenAll: (...tasks: unknown[]) => Promise.all(flattenTasks(tasks)),
        WhenAny: (...tasks: unknown[]) => Promise.race(flattenTasks(tasks)),
        Run: (fn: unknown) => {
            if (typeof fn !== 'function')
                throw new ArgumentException('Task.Run espera uma função.');
            return Promise.resolve().then(() => (fn as Fn)());
        },
    };
}
function flattenTasks(tasks: unknown[]): unknown[] {
    if (tasks.length === 1 && tasks[0] !== null && typeof tasks[0] === 'object' && !(tasks[0] instanceof Promise))
        return Array.from(iterate(tasks[0], 'Task.WhenAll'));
    return tasks;
}
export class Random {
    private state: number;
    constructor(seed?: unknown) {
        this.state = typeof seed === 'number' ? (seed >>> 0) || 1 : (Math.floor(Math.random() * 0xffffffff) >>> 0) || 1;
    }
    static get Shared(): Random {
        return shared;
    }
    private nextUnit(): number {
        let x = this.state;
        x ^= x << 13;
        x ^= x >>> 17;
        x ^= x << 5;
        this.state = x >>> 0;
        return this.state / 0x100000000;
    }
    Next(min?: unknown, max?: unknown): number {
        if (min === undefined)
            return Math.floor(this.nextUnit() * 2147483647);
        if (max === undefined) {
            const limit = Number(min);
            if (limit < 0)
                throw new ArgumentOutOfRangeException('maxValue', 'Random.Next: o limite precisa ser não negativo.');
            return Math.floor(this.nextUnit() * limit);
        }
        const low = Number(min);
        const high = Number(max);
        if (low > high)
            throw new ArgumentOutOfRangeException('minValue', 'Random.Next: o mínimo é maior que o máximo.');
        return low + Math.floor(this.nextUnit() * (high - low));
    }
    NextInt64(min?: unknown, max?: unknown): number {
        return this.Next(min, max);
    }
    NextDouble(): number {
        return this.nextUnit();
    }
    NextSingle(): number {
        return this.nextUnit();
    }
    NextBytes(buffer: unknown): void {
        if (!Array.isArray(buffer))
            throw new ArgumentException('Random.NextBytes espera um array.');
        for (let index = 0; index < buffer.length; index++)
            buffer[index] = Math.floor(this.nextUnit() * 256);
    }
    Shuffle(array: unknown): void {
        if (!Array.isArray(array))
            throw new ArgumentException('Random.Shuffle espera um array.');
        for (let index = array.length - 1; index > 0; index--) {
            const other = Math.floor(this.nextUnit() * (index + 1));
            [array[index], array[other]] = [array[other], array[index]];
        }
    }
    GetItems(choices: unknown, length: unknown): unknown[] {
        const items = Array.from(iterate(choices, 'Random.GetItems'));
        if (items.length === 0)
            throw new ArgumentException('Random.GetItems: a lista de opções está vazia.');
        return Array.from({ length: Number(length) }, () => items[Math.floor(this.nextUnit() * items.length)]);
    }
    ToString(): string {
        return 'System.Random';
    }
}
const shared = new Random();
export class TimeSpan {
    constructor(readonly TotalMilliseconds: number) { }
    static FromSeconds(seconds: unknown): TimeSpan {
        return new TimeSpan(Number(seconds) * 1000);
    }
    static FromMilliseconds(ms: unknown): TimeSpan {
        return new TimeSpan(Number(ms));
    }
    static FromMinutes(minutes: unknown): TimeSpan {
        return new TimeSpan(Number(minutes) * 60000);
    }
    static FromHours(hours: unknown): TimeSpan {
        return new TimeSpan(Number(hours) * 3600000);
    }
    static FromDays(days: unknown): TimeSpan {
        return new TimeSpan(Number(days) * 86400000);
    }
    static get Zero(): TimeSpan {
        return new TimeSpan(0);
    }
    get TotalSeconds(): number {
        return this.TotalMilliseconds / 1000;
    }
    get TotalMinutes(): number {
        return this.TotalMilliseconds / 60000;
    }
    get TotalHours(): number {
        return this.TotalMilliseconds / 3600000;
    }
    get TotalDays(): number {
        return this.TotalMilliseconds / 86400000;
    }
    get Milliseconds(): number {
        return Math.trunc(this.TotalMilliseconds % 1000);
    }
    get Seconds(): number {
        return Math.trunc(this.TotalSeconds % 60);
    }
    get Minutes(): number {
        return Math.trunc(this.TotalMinutes % 60);
    }
    get Hours(): number {
        return Math.trunc(this.TotalHours % 24);
    }
    get Days(): number {
        return Math.trunc(this.TotalDays);
    }
    Add(other: TimeSpan): TimeSpan {
        return new TimeSpan(this.TotalMilliseconds + other.TotalMilliseconds);
    }
    Subtract(other: TimeSpan): TimeSpan {
        return new TimeSpan(this.TotalMilliseconds - other.TotalMilliseconds);
    }
    CompareTo(other: unknown): number {
        return other instanceof TimeSpan ? this.TotalMilliseconds - other.TotalMilliseconds : 1;
    }
    Equals(other: unknown): boolean {
        return other instanceof TimeSpan && other.TotalMilliseconds === this.TotalMilliseconds;
    }
    GetHashKey(): string {
        return `timespan:${this.TotalMilliseconds}`;
    }
    ToString(): string {
        const sign = this.TotalMilliseconds < 0 ? '-' : '';
        const total = Math.abs(this.TotalMilliseconds);
        const hours = Math.floor(total / 3600000);
        const minutes = Math.floor((total % 3600000) / 60000);
        const seconds = Math.floor((total % 60000) / 1000);
        const ms = Math.floor(total % 1000);
        const base = `${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        return ms > 0 ? `${base}.${String(ms).padStart(3, '0')}0000` : base;
    }
}
export class DateTime {
    readonly $date: Date;
    constructor(...args: unknown[]) {
        if (args.length === 0)
            this.$date = new Date(0);
        else if (args.length === 1 && args[0] instanceof Date)
            this.$date = new Date(args[0].getTime());
        else if (args.length === 1 && typeof args[0] === 'number')
            this.$date = new Date(args[0]);
        else {
            const [year, month, day, hour = 0, minute = 0, second = 0, ms = 0] = args.map((value) => Number(value));
            this.$date = new Date(year, month - 1, day, hour, minute, second, ms);
        }
    }
    static get Now(): DateTime {
        return new DateTime(new Date());
    }
    static get UtcNow(): DateTime {
        return new DateTime(new Date());
    }
    static get Today(): DateTime {
        const now = new Date();
        return new DateTime(now.getFullYear(), now.getMonth() + 1, now.getDate());
    }
    static get MinValue(): DateTime {
        return new DateTime(new Date(-8640000000000000));
    }
    static get MaxValue(): DateTime {
        return new DateTime(new Date(8640000000000000));
    }
    static Parse(textValue: unknown): DateTime {
        const parsed = new Date(str(textValue));
        if (Number.isNaN(parsed.getTime()))
            throw new FormatException(`DateTime.Parse: "${str(textValue)}" não é uma data válida.`);
        return new DateTime(parsed);
    }
    static TryParse(textValue: unknown, out: Ref<DateTime>): boolean {
        const parsed = new Date(str(textValue));
        const ok = !Number.isNaN(parsed.getTime());
        out.v = ok ? new DateTime(parsed) : new DateTime();
        return ok;
    }
    get Year(): number {
        return this.$date.getFullYear();
    }
    get Month(): number {
        return this.$date.getMonth() + 1;
    }
    get Day(): number {
        return this.$date.getDate();
    }
    get Hour(): number {
        return this.$date.getHours();
    }
    get Minute(): number {
        return this.$date.getMinutes();
    }
    get Second(): number {
        return this.$date.getSeconds();
    }
    get Millisecond(): number {
        return this.$date.getMilliseconds();
    }
    get DayOfWeek(): number {
        return this.$date.getDay();
    }
    get DayOfYear(): number {
        const start = new Date(this.$date.getFullYear(), 0, 0);
        return Math.floor((this.$date.getTime() - start.getTime()) / 86400000);
    }
    get Ticks(): number {
        return this.$date.getTime() * 10000 + 621355968000000000;
    }
    get Date(): DateTime {
        return new DateTime(this.Year, this.Month, this.Day);
    }
    get TimeOfDay(): TimeSpan {
        return new TimeSpan(this.$date.getTime() - new Date(this.Year, this.Month - 1, this.Day).getTime());
    }
    AddMilliseconds(ms: unknown): DateTime {
        return new DateTime(this.$date.getTime() + Number(ms));
    }
    AddSeconds(seconds: unknown): DateTime {
        return this.AddMilliseconds(Number(seconds) * 1000);
    }
    AddMinutes(minutes: unknown): DateTime {
        return this.AddMilliseconds(Number(minutes) * 60000);
    }
    AddHours(hours: unknown): DateTime {
        return this.AddMilliseconds(Number(hours) * 3600000);
    }
    AddDays(days: unknown): DateTime {
        return this.AddMilliseconds(Number(days) * 86400000);
    }
    AddMonths(months: unknown): DateTime {
        const copy = new Date(this.$date.getTime());
        copy.setMonth(copy.getMonth() + Number(months));
        return new DateTime(copy);
    }
    AddYears(years: unknown): DateTime {
        const copy = new Date(this.$date.getTime());
        copy.setFullYear(copy.getFullYear() + Number(years));
        return new DateTime(copy);
    }
    Add(span: TimeSpan): DateTime {
        return this.AddMilliseconds(span.TotalMilliseconds);
    }
    Subtract(other: unknown): unknown {
        if (other instanceof DateTime)
            return new TimeSpan(this.$date.getTime() - other.$date.getTime());
        if (other instanceof TimeSpan)
            return this.AddMilliseconds(-other.TotalMilliseconds);
        throw new ArgumentException('DateTime.Subtract espera um DateTime ou um TimeSpan.');
    }
    CompareTo(other: unknown): number {
        return other instanceof DateTime ? this.$date.getTime() - other.$date.getTime() : 1;
    }
    Equals(other: unknown): boolean {
        return other instanceof DateTime && other.$date.getTime() === this.$date.getTime();
    }
    GetHashKey(): string {
        return `datetime:${this.$date.getTime()}`;
    }
    ToString(specifier?: unknown): string {
        return typeof specifier === 'string' ? format(this.$date, specifier, null) : format(this.$date, 'MM/dd/yyyy HH:mm:ss', null);
    }
    ToShortDateString(): string {
        return format(this.$date, 'd', null);
    }
    ToLongTimeString(): string {
        return format(this.$date, 'T', null);
    }
    ToShortTimeString(): string {
        return format(this.$date, 't', null);
    }
}
export function createConsoleStatics(console: ConsoleLike): Record<string, unknown> {
    const write = (level: 'log' | 'info' | 'warn' | 'error', parts: unknown[]) => {
        const message = parts.length > 1 && typeof parts[0] === 'string' && /\{\d/.test(parts[0]) ? formatString(parts[0], parts.slice(1)) : parts.map((part) => str(part)).join('');
        console[level](message);
    };
    let pending = '';
    return {
        WriteLine: (...parts: unknown[]) => {
            if (pending) {
                parts.unshift(pending);
                pending = '';
            }
            write('log', parts);
        },
        Write: (...parts: unknown[]) => {
            pending += parts.map((part) => str(part)).join('');
        },
        Error: {
            WriteLine: (...parts: unknown[]) => write('error', parts),
            Write: (...parts: unknown[]) => write('error', parts),
        },
        Out: {
            WriteLine: (...parts: unknown[]) => write('log', parts),
            Write: (...parts: unknown[]) => write('log', parts),
        },
        ReadLine: () => {
            throw new InvalidOperationException('Console.ReadLine não existe num jogo: leia a entrada por helix.input.');
        },
        Clear: () => undefined,
        Beep: () => undefined,
    };
}
export function createDebugStatics(console: ConsoleLike): Record<string, unknown> {
    return {
        Log: (...parts: unknown[]) => console.log(parts.map((part) => str(part)).join(' ')),
        LogFormat: (template: unknown, ...args: unknown[]) => console.log(formatString(template, args)),
        LogWarning: (...parts: unknown[]) => console.warn(parts.map((part) => str(part)).join(' ')),
        LogWarningFormat: (template: unknown, ...args: unknown[]) => console.warn(formatString(template, args)),
        LogError: (...parts: unknown[]) => console.error(parts.map((part) => str(part)).join(' ')),
        LogErrorFormat: (template: unknown, ...args: unknown[]) => console.error(formatString(template, args)),
        LogException: (error: unknown) => console.error(str(error)),
        WriteLine: (...parts: unknown[]) => console.log(parts.map((part) => str(part)).join('')),
        Write: (...parts: unknown[]) => console.log(parts.map((part) => str(part)).join('')),
        Assert: (condition: unknown, message?: unknown) => {
            if (!condition)
                console.error(message === undefined ? 'Debug.Assert falhou.' : `Debug.Assert falhou: ${str(message)}`);
        },
        Fail: (message?: unknown) => console.error(message === undefined ? 'Debug.Fail' : str(message)),
    };
}
type Vec = {
    x: number;
    y: number;
    z?: number;
};
function vec3(x: unknown = 0, y: unknown = 0, z: unknown = 0): Vec {
    return { x: Number(x), y: Number(y), z: Number(z) };
}
function vec2(x: unknown = 0, y: unknown = 0): Vec {
    return { x: Number(x), y: Number(y) };
}
function component(vector: unknown, key: 'x' | 'y' | 'z'): number {
    const value = (vector as Record<string, unknown> | null)?.[key];
    return typeof value === 'number' ? value : 0;
}
function vectorStatics(dimensions: 2 | 3): Record<string, unknown> {
    const make = dimensions === 3 ? vec3 : vec2;
    const map = (a: unknown, fn: (component: number, key: 'x' | 'y' | 'z') => number): Vec => (dimensions === 3 ? make(fn(component(a, 'x'), 'x'), fn(component(a, 'y'), 'y'), fn(component(a, 'z'), 'z')) : make(fn(component(a, 'x'), 'x'), fn(component(a, 'y'), 'y')));
    const zip = (a: unknown, b: unknown, fn: (left: number, right: number) => number): Vec => map(a, (value, key) => fn(value, component(b, key)));
    const length = (a: unknown): number => Math.hypot(component(a, 'x'), component(a, 'y'), dimensions === 3 ? component(a, 'z') : 0);
    const statics: Record<string, unknown> = {
        Zero: make(0, 0, 0),
        One: make(1, 1, 1),
        Up: dimensions === 3 ? vec3(0, 1, 0) : vec2(0, 1),
        Down: dimensions === 3 ? vec3(0, -1, 0) : vec2(0, -1),
        Left: dimensions === 3 ? vec3(-1, 0, 0) : vec2(-1, 0),
        Right: dimensions === 3 ? vec3(1, 0, 0) : vec2(1, 0),
        UnitX: dimensions === 3 ? vec3(1, 0, 0) : vec2(1, 0),
        UnitY: dimensions === 3 ? vec3(0, 1, 0) : vec2(0, 1),
        Add: (a: unknown, b: unknown) => zip(a, b, (left, right) => left + right),
        Subtract: (a: unknown, b: unknown) => zip(a, b, (left, right) => left - right),
        Multiply: (a: unknown, b: unknown) => (typeof b === 'number' ? map(a, (value) => value * b) : zip(a, b, (left, right) => left * right)),
        Divide: (a: unknown, b: unknown) => (typeof b === 'number' ? map(a, (value) => value / b) : zip(a, b, (left, right) => left / right)),
        Negate: (a: unknown) => map(a, (value) => -value),
        Scale: (a: unknown, factor: unknown) => map(a, (value) => value * Number(factor)),
        Dot: (a: unknown, b: unknown) => component(a, 'x') * component(b, 'x') + component(a, 'y') * component(b, 'y') + (dimensions === 3 ? component(a, 'z') * component(b, 'z') : 0),
        Length: length,
        Magnitude: length,
        LengthSquared: (a: unknown) => length(a) ** 2,
        Distance: (a: unknown, b: unknown) => length(zip(a, b, (left, right) => left - right)),
        DistanceSquared: (a: unknown, b: unknown) => length(zip(a, b, (left, right) => left - right)) ** 2,
        Normalize: (a: unknown) => {
            const size = length(a);
            return size === 0 ? make(0, 0, 0) : map(a, (value) => value / size);
        },
        Lerp: (a: unknown, b: unknown, t: unknown) => zip(a, b, (left, right) => left + (right - left) * Number(t)),
        Min: (a: unknown, b: unknown) => zip(a, b, Math.min),
        Max: (a: unknown, b: unknown) => zip(a, b, Math.max),
        Clamp: (a: unknown, low: unknown, high: unknown) => map(a, (value, key) => Math.min(component(high, key), Math.max(component(low, key), value))),
        Abs: (a: unknown) => map(a, Math.abs),
        Reflect: (a: unknown, normal: unknown) => {
            const dot = (statics.Dot as Fn)(a, normal) as number;
            return zip(a, normal, (left, right) => left - 2 * dot * right);
        },
    };
    if (dimensions === 3) {
        statics.Forward = vec3(0, 0, -1);
        statics.Back = vec3(0, 0, 1);
        statics.UnitZ = vec3(0, 0, 1);
        statics.Cross = (a: unknown, b: unknown) => vec3(component(a, 'y') * component(b, 'z') - component(a, 'z') * component(b, 'y'), component(a, 'z') * component(b, 'x') - component(a, 'x') * component(b, 'z'), component(a, 'x') * component(b, 'y') - component(a, 'y') * component(b, 'x'));
    }
    return statics;
}
export const VECTOR3 = Object.assign(function Vector3(x?: unknown, y?: unknown, z?: unknown) {
    return vec3(x, y, z);
}, vectorStatics(3));
export const VECTOR2 = Object.assign(function Vector2(x?: unknown, y?: unknown) {
    return vec2(x, y);
}, vectorStatics(2));
export const COLOR = Object.assign(function Color(r: unknown = 0, g: unknown = 0, b: unknown = 0, a: unknown = 1) {
    return { r: Number(r), g: Number(g), b: Number(b), a: Number(a) };
}, {
    White: { r: 1, g: 1, b: 1, a: 1 },
    Black: { r: 0, g: 0, b: 0, a: 1 },
    Red: { r: 1, g: 0, b: 0, a: 1 },
    Green: { r: 0, g: 1, b: 0, a: 1 },
    Blue: { r: 0, g: 0, b: 1, a: 1 },
    Yellow: { r: 1, g: 1, b: 0, a: 1 },
    Cyan: { r: 0, g: 1, b: 1, a: 1 },
    Magenta: { r: 1, g: 0, b: 1, a: 1 },
    Gray: { r: 0.5, g: 0.5, b: 0.5, a: 1 },
    Clear: { r: 0, g: 0, b: 0, a: 0 },
    Lerp: (a: Record<string, number>, b: Record<string, number>, t: unknown) => {
        const amount = Number(t);
        return { r: a.r + (b.r - a.r) * amount, g: a.g + (b.g - a.g) * amount, b: a.b + (b.b - a.b) * amount, a: (a.a ?? 1) + ((b.a ?? 1) - (a.a ?? 1)) * amount };
    },
    FromHex: (hex: unknown) => {
        const match = /^#?([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(str(hex));
        if (!match)
            throw new FormatException(`Color.FromHex: "${str(hex)}" não é uma cor hexadecimal.`);
        const value = parseInt(match[1], 16);
        return { r: ((value >> 16) & 255) / 255, g: ((value >> 8) & 255) / 255, b: (value & 255) / 255, a: match[2] ? parseInt(match[2], 16) / 255 : 1 };
    },
});
