import { Dictionary, Signal, Vector2, Vector3, Vector4, callableMeta, describeTypeOf, fail, isScriptClass, isScriptInstance, isValueType, isVecLike, makeCallable, vectorArity } from './values';
import { compare, eq, str, toFloat, toInt, truthy } from './variant';
type Method<T> = (self: T, ...args: unknown[]) => unknown;
type Fn = (...args: unknown[]) => unknown;
export function norm(value: unknown): unknown {
    return value === undefined ? null : value;
}
function distance(a: string, b: string): number {
    const rows = a.length + 1;
    const cols = b.length + 1;
    const previous = new Array<number>(cols);
    const current = new Array<number>(cols);
    for (let j = 0; j < cols; j++)
        previous[j] = j;
    for (let i = 1; i < rows; i++) {
        current[0] = i;
        for (let j = 1; j < cols; j++)
            current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        for (let j = 0; j < cols; j++)
            previous[j] = current[j];
    }
    return previous[cols - 1];
}
export function closest(name: string, candidates: Iterable<string>): string | null {
    let best: string | null = null;
    let bestDistance = Infinity;
    const lower = name.toLowerCase();
    for (const candidate of candidates) {
        const score = distance(lower, candidate.toLowerCase());
        if (score < bestDistance && score <= Math.max(2, Math.floor(name.length / 3))) {
            best = candidate;
            bestDistance = score;
        }
    }
    return best;
}
function suggestionText(name: string, candidates: Iterable<string>): string {
    const suggestion = closest(name, candidates);
    return suggestion ? ` Você quis dizer "${suggestion}"?` : '';
}
export function toEngineValue(value: unknown): unknown {
    if (value instanceof Dictionary) {
        const object: Record<string, unknown> = {};
        for (const [key, entry] of value)
            object[typeof key === 'string' ? key : str(key)] = toEngineValue(entry);
        return object;
    }
    if (Array.isArray(value)) {
        for (let index = 0; index < value.length; index++) {
            const item = value[index];
            if (item instanceof Dictionary || (Array.isArray(item) && item.some((inner) => inner instanceof Dictionary)))
                return value.map((entry) => toEngineValue(entry));
        }
        return value;
    }
    return value;
}
export function toEngineArgs(args: unknown[]): unknown[] {
    for (let index = 0; index < args.length; index++) {
        const value = args[index];
        if (value instanceof Dictionary || Array.isArray(value)) {
            const converted = args.slice();
            for (let inner = index; inner < args.length; inner++)
                converted[inner] = toEngineValue(args[inner]);
            return converted;
        }
    }
    return args;
}
function requireString(value: unknown, method: string, what = 'o argumento'): string {
    if (typeof value !== 'string')
        fail(`String.${method}(): ${what} precisa ser uma String, recebeu ${describeTypeOf(value)}.`);
    return value;
}
function requireInt(value: unknown, owner: string, method: string, what = 'o argumento'): number {
    if (typeof value !== 'number' || !Number.isInteger(value))
        fail(`${owner}.${method}(): ${what} precisa ser um int, recebeu ${describeTypeOf(value)}.`);
    return value;
}
function requireCallable(value: unknown, owner: string, method: string): Fn {
    if (typeof value !== 'function')
        fail(`${owner}.${method}(): esperava um Callable, recebeu ${describeTypeOf(value)}.`);
    return value as Fn;
}
function wildcardToRegExp(pattern: string, caseInsensitive: boolean): RegExp {
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
    return new RegExp(`^${escaped}$`, caseInsensitive ? 'is' : 's');
}
function splitWords(text: string): string[] {
    return text
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
        .split(/[\s_\-]+/)
        .filter((word) => word.length > 0);
}
const STRING_METHODS: Record<string, Method<string>> = {
    length: (s) => s.length,
    is_empty: (s) => s.length === 0,
    to_upper: (s) => s.toUpperCase(),
    to_lower: (s) => s.toLowerCase(),
    capitalize: (s) => splitWords(s)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' '),
    to_camel_case: (s) => {
        const words = splitWords(s);
        return words.map((word, index) => (index === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())).join('');
    },
    to_pascal_case: (s) => splitWords(s)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(''),
    to_snake_case: (s) => splitWords(s)
        .map((word) => word.toLowerCase())
        .join('_'),
    begins_with: (s, prefix) => s.startsWith(requireString(prefix, 'begins_with')),
    ends_with: (s, suffix) => s.endsWith(requireString(suffix, 'ends_with')),
    contains: (s, what) => s.includes(requireString(what, 'contains')),
    containsn: (s, what) => s.toLowerCase().includes(requireString(what, 'containsn').toLowerCase()),
    find: (s, what, from = 0) => s.indexOf(requireString(what, 'find'), toInt(from)),
    findn: (s, what, from = 0) => s.toLowerCase().indexOf(requireString(what, 'findn').toLowerCase(), toInt(from)),
    rfind: (s, what, from = -1) => s.lastIndexOf(requireString(what, 'rfind'), toInt(from) < 0 ? undefined : toInt(from)),
    rfindn: (s, what, from = -1) => s.toLowerCase().lastIndexOf(requireString(what, 'rfindn').toLowerCase(), toInt(from) < 0 ? undefined : toInt(from)),
    count: (s, what, from = 0, to = 0) => {
        const needle = requireString(what, 'count');
        if (needle.length === 0)
            return 0;
        const slice = s.slice(toInt(from), toInt(to) === 0 ? undefined : toInt(to));
        return slice.split(needle).length - 1;
    },
    countn: (s, what) => {
        const needle = requireString(what, 'countn').toLowerCase();
        return needle.length === 0 ? 0 : s.toLowerCase().split(needle).length - 1;
    },
    replace: (s, what, forwhat) => s.split(requireString(what, 'replace')).join(requireString(forwhat, 'replace', 'a substituição')),
    replacen: (s, what, forwhat) => {
        const needle = requireString(what, 'replacen');
        if (needle.length === 0)
            return s;
        const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return s.replace(new RegExp(escaped, 'gi'), () => requireString(forwhat, 'replacen', 'a substituição'));
    },
    substr: (s, from, length = -1) => {
        const start = toInt(from);
        const count = toInt(length);
        return count < 0 ? s.slice(start) : s.slice(start, start + count);
    },
    left: (s, length) => {
        const count = toInt(length);
        return count < 0 ? s.slice(0, Math.max(0, s.length + count)) : s.slice(0, count);
    },
    right: (s, length) => {
        const count = toInt(length);
        return count < 0 ? s.slice(Math.min(s.length, -count)) : s.slice(Math.max(0, s.length - count));
    },
    split: (s, delimiter = '', allowEmpty = true, maxsplit = 0) => {
        const separator = requireString(delimiter, 'split', 'o delimitador');
        const limit = toInt(maxsplit);
        let parts: string[];
        if (separator.length === 0)
            parts = Array.from(s);
        else if (limit > 0) {
            parts = [];
            let rest = s;
            while (parts.length < limit) {
                const at = rest.indexOf(separator);
                if (at === -1)
                    break;
                parts.push(rest.slice(0, at));
                rest = rest.slice(at + separator.length);
            }
            parts.push(rest);
        }
        else
            parts = s.split(separator);
        return truthy(allowEmpty) ? parts : parts.filter((part) => part.length > 0);
    },
    rsplit: (s, delimiter = '', allowEmpty = true, maxsplit = 0) => {
        const separator = requireString(delimiter, 'rsplit', 'o delimitador');
        const limit = toInt(maxsplit);
        let parts: string[];
        if (separator.length === 0)
            parts = Array.from(s);
        else if (limit > 0) {
            parts = [];
            let rest = s;
            while (parts.length < limit) {
                const at = rest.lastIndexOf(separator);
                if (at === -1)
                    break;
                parts.unshift(rest.slice(at + separator.length));
                rest = rest.slice(0, at);
            }
            parts.unshift(rest);
        }
        else
            parts = s.split(separator);
        return truthy(allowEmpty) ? parts : parts.filter((part) => part.length > 0);
    },
    split_floats: (s, delimiter, allowEmpty = true) => {
        const parts = s.split(requireString(delimiter, 'split_floats', 'o delimitador'));
        return (truthy(allowEmpty) ? parts : parts.filter((part) => part.length > 0)).map((part) => toFloat(part));
    },
    join: (s, parts) => {
        if (!Array.isArray(parts))
            fail(`String.join(): esperava uma lista de Strings, recebeu ${describeTypeOf(parts)}.`);
        return parts.map((part) => str(part)).join(s);
    },
    strip_edges: (s, left = true, right = true) => {
        let result = s;
        if (truthy(left))
            result = result.replace(/^\s+/, '');
        if (truthy(right))
            result = result.replace(/\s+$/, '');
        return result;
    },
    strip_escapes: (s) => s.replace(/[\x00-\x1f\x7f]/g, ''),
    lstrip: (s, chars) => {
        const set = requireString(chars, 'lstrip');
        let index = 0;
        while (index < s.length && set.includes(s[index]))
            index++;
        return s.slice(index);
    },
    rstrip: (s, chars) => {
        const set = requireString(chars, 'rstrip');
        let end = s.length;
        while (end > 0 && set.includes(s[end - 1]))
            end--;
        return s.slice(0, end);
    },
    trim_prefix: (s, prefix) => {
        const text = requireString(prefix, 'trim_prefix');
        return s.startsWith(text) ? s.slice(text.length) : s;
    },
    trim_suffix: (s, suffix) => {
        const text = requireString(suffix, 'trim_suffix');
        return s.endsWith(text) ? s.slice(0, s.length - text.length) : s;
    },
    insert: (s, position, what) => {
        const at = toInt(position);
        return s.slice(0, at) + requireString(what, 'insert') + s.slice(at);
    },
    erase: (s, position, chars = 1) => {
        const at = toInt(position);
        return s.slice(0, at) + s.slice(at + toInt(chars));
    },
    repeat: (s, count) => s.repeat(Math.max(0, toInt(count))),
    reverse: (s) => Array.from(s).reverse().join(''),
    pad_zeros: (s, digits) => {
        const wanted = toInt(digits);
        const negative = s.startsWith('-');
        const body = negative ? s.slice(1) : s;
        const dot = body.indexOf('.');
        const integer = dot === -1 ? body : body.slice(0, dot);
        const rest = dot === -1 ? '' : body.slice(dot);
        return (negative ? '-' : '') + integer.padStart(wanted, '0') + rest;
    },
    pad_decimals: (s, digits) => {
        const wanted = toInt(digits);
        const dot = s.indexOf('.');
        if (wanted <= 0)
            return dot === -1 ? s : s.slice(0, dot);
        if (dot === -1)
            return `${s}.${'0'.repeat(wanted)}`;
        const decimals = s.slice(dot + 1);
        return decimals.length >= wanted ? s.slice(0, dot + 1 + wanted) : s + '0'.repeat(wanted - decimals.length);
    },
    lpad: (s, length, character = ' ') => s.padStart(toInt(length), requireString(character, 'lpad')),
    rpad: (s, length, character = ' ') => s.padEnd(toInt(length), requireString(character, 'rpad')),
    indent: (s, prefix) => s.split('\n').map((line) => (line.length > 0 ? requireString(prefix, 'indent') + line : line)).join('\n'),
};
