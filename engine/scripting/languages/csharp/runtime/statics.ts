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
