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
    dedent: (s) => {
        const lines = s.split('\n');
        let common: string | null = null;
        for (const line of lines) {
            if (line.trim().length === 0)
                continue;
            const leading = line.match(/^[ \t]*/)?.[0] ?? '';
            if (common === null || leading.length < common.length)
                common = leading;
        }
        const width = common?.length ?? 0;
        return lines.map((line) => (line.startsWith(common ?? '') ? line.slice(width) : line.trimStart())).join('\n');
    },
    to_int: (s) => toInt(s),
    to_float: (s) => toFloat(s),
    hex_to_int: (s) => parseInt(s.replace(/^0x/i, ''), 16) || 0,
    bin_to_int: (s) => parseInt(s.replace(/^0b/i, ''), 2) || 0,
    is_valid_int: (s) => /^[+-]?\d+$/.test(s.trim()),
    is_valid_float: (s) => /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s.trim()),
    is_valid_hex_number: (s, withPrefix = false) => (truthy(withPrefix) ? /^0x[0-9a-fA-F]+$/i.test(s) : /^[0-9a-fA-F]+$/.test(s)),
    is_valid_identifier: (s) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(s),
    is_valid_html_color: (s) => /^#?([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(s),
    is_valid_ip_address: (s) => /^(\d{1,3}\.){3}\d{1,3}$/.test(s) || s.includes(':'),
    is_valid_filename: (s) => s.length > 0 && !/[:/\\?*"|%<>]/.test(s),
    is_absolute_path: (s) => s.startsWith('/') || /^[a-zA-Z]:[/\\]/.test(s) || /^\w+:\/\//.test(s),
    is_relative_path: (s) => !(s.startsWith('/') || /^[a-zA-Z]:[/\\]/.test(s) || /^\w+:\/\//.test(s)),
    get_file: (s) => s.slice(s.lastIndexOf('/') + 1),
    get_extension: (s) => {
        const file = s.slice(s.lastIndexOf('/') + 1);
        const dot = file.lastIndexOf('.');
        return dot <= 0 ? '' : file.slice(dot + 1);
    },
    get_basename: (s) => {
        const slash = s.lastIndexOf('/');
        const dot = s.lastIndexOf('.');
        return dot > slash ? s.slice(0, dot) : s;
    },
    get_base_dir: (s) => {
        const slash = s.lastIndexOf('/');
        return slash === -1 ? '' : s.slice(0, slash);
    },
    path_join: (s, file) => (s.endsWith('/') ? s + requireString(file, 'path_join') : `${s}/${requireString(file, 'path_join')}`),
    simplify_path: (s) => {
        const absolute = s.startsWith('/');
        const parts: string[] = [];
        for (const part of s.split('/')) {
            if (part === '' || part === '.')
                continue;
            if (part === '..')
                parts.pop();
            else
                parts.push(part);
        }
        return (absolute ? '/' : '') + parts.join('/');
    },
    get_slice: (s, delimiter, slice) => {
        const parts = s.split(requireString(delimiter, 'get_slice', 'o delimitador'));
        const index = toInt(slice);
        return index >= 0 && index < parts.length ? parts[index] : '';
    },
    get_slice_count: (s, delimiter) => s.split(requireString(delimiter, 'get_slice_count', 'o delimitador')).length,
    get_slicec: (s, delimiter, slice) => {
        const parts = s.split(String.fromCodePoint(toInt(delimiter)));
        const index = toInt(slice);
        return index >= 0 && index < parts.length ? parts[index] : '';
    },
    match: (s, pattern) => wildcardToRegExp(requireString(pattern, 'match', 'o padrão'), false).test(s),
    matchn: (s, pattern) => wildcardToRegExp(requireString(pattern, 'matchn', 'o padrão'), true).test(s),
    is_subsequence_of: (s, text) => {
        const haystack = requireString(text, 'is_subsequence_of');
        let index = 0;
        for (const char of haystack)
            if (index < s.length && s[index] === char)
                index++;
        return index === s.length;
    },
    is_subsequence_ofn: (s, text) => STRING_METHODS.is_subsequence_of(s.toLowerCase(), requireString(text, 'is_subsequence_ofn').toLowerCase()),
    casecmp_to: (s, other) => (s < requireString(other, 'casecmp_to') ? -1 : s > (other as string) ? 1 : 0),
    nocasecmp_to: (s, other) => {
        const a = s.toLowerCase();
        const b = requireString(other, 'nocasecmp_to').toLowerCase();
        return a < b ? -1 : a > b ? 1 : 0;
    },
    naturalnocasecmp_to: (s, other) => s.localeCompare(requireString(other, 'naturalnocasecmp_to'), undefined, { numeric: true, sensitivity: 'base' }),
    similarity: (s, other) => {
        const text = requireString(other, 'similarity');
        if (s === text)
            return 1;
        if (s.length < 2 || text.length < 2)
            return 0;
        const bigrams = (value: string) => {
            const map = new Map<string, number>();
            for (let index = 0; index < value.length - 1; index++) {
                const pair = value.slice(index, index + 2);
                map.set(pair, (map.get(pair) ?? 0) + 1);
            }
            return map;
        };
        const left = bigrams(s);
        const right = bigrams(text);
        let shared = 0;
        for (const [pair, count] of left)
            shared += Math.min(count, right.get(pair) ?? 0);
        return (2 * shared) / (s.length - 1 + (text.length - 1));
    },
    format: (s, values, placeholder = '{_}') => {
        const template = requireString(placeholder, 'format', 'o marcador');
        let result = s;
        if (values instanceof Dictionary) {
            for (const [key, value] of values)
                result = result.split(template.replace('_', str(key))).join(str(value));
            return result;
        }
        if (Array.isArray(values)) {
            values.forEach((value, index) => {
                if (Array.isArray(value) && value.length === 2)
                    result = result.split(template.replace('_', str(value[0]))).join(str(value[1]));
                else {
                    result = result.split(template.replace('_', String(index))).join(str(value));
                    const positional = template.replace('_', '');
                    if (positional.length > 0)
                        result = result.replace(positional, str(value));
                }
            });
            return result;
        }
        return fail(`String.format(): esperava uma lista ou um Dictionary, recebeu ${describeTypeOf(values)}.`);
    },
    hash: (s) => {
        let hash = 5381;
        for (let index = 0; index < s.length; index++)
            hash = ((hash << 5) + hash + s.charCodeAt(index)) >>> 0;
        return hash;
    },
    unicode_at: (s, at) => s.codePointAt(toInt(at)) ?? 0,
    to_ascii_buffer: (s) => Array.from(s, (char) => char.charCodeAt(0) & 255),
    to_utf8_buffer: (s) => Array.from(new TextEncoder().encode(s)),
    to_utf16_buffer: (s) => {
        const bytes: number[] = [];
        for (let index = 0; index < s.length; index++) {
            const code = s.charCodeAt(index);
            bytes.push(code & 255, code >> 8);
        }
        return bytes;
    },
    c_escape: (s) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/\t/g, '\\t').replace(/\r/g, '\\r').replace(/"/g, '\\"').replace(/'/g, "\\'"),
    c_unescape: (s) => s.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\r/g, '\r').replace(/\\"/g, '"').replace(/\\'/g, "'").replace(/\\\\/g, '\\'),
    json_escape: (s) => JSON.stringify(s).slice(1, -1),
    xml_escape: (s, escapeQuotes = false) => {
        let result = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        if (truthy(escapeQuotes))
            result = result.replace(/"/g, '&quot;').replace(/'/g, '&apos;');
        return result;
    },
    xml_unescape: (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&'),
    uri_encode: (s) => encodeURIComponent(s),
    uri_decode: (s) => decodeURIComponent(s),
    validate_node_name: (s) => s.replace(/[.:@/"%]/g, ''),
    validate_filename: (s) => s.replace(/[:/\\?*"|%<>]/g, '_'),
    md5_text: () => fail('String.md5_text() não está disponível: hashes criptográficos ficam fora do runtime de scripts.'),
    sha256_text: () => fail('String.sha256_text() não está disponível: hashes criptográficos ficam fora do runtime de scripts.'),
    num_int64: (_s, value) => String(toInt(value)),
};
export const STRING_STATICS: Record<string, Fn> = {
    num: (value, decimals = -1) => {
        const number = toFloat(value);
        const digits = toInt(decimals);
        return digits < 0 ? str(number) : number.toFixed(digits);
    },
    num_int64: (value) => String(toInt(value)),
    num_uint64: (value) => String(Math.abs(toInt(value))),
    num_scientific: (value) => toFloat(value).toExponential(),
    chr: (code) => String.fromCodePoint(toInt(code)),
    humanize_size: (size) => {
        const bytes = toInt(size);
        const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
        let value = bytes;
        let unit = 0;
        while (value >= 1024 && unit < units.length - 1) {
            value /= 1024;
            unit++;
        }
        return unit === 0 ? `${value} B` : `${value.toFixed(2)} ${units[unit]}`;
    },
};
type List = unknown[];
function normalizeIndex(list: ArrayLike<unknown>, index: unknown, method: string, allowEnd = false): number {
    const at = requireInt(index, 'Array', method, 'o índice');
    const resolved = at < 0 ? list.length + at : at;
    if (resolved < 0 || resolved > list.length || (!allowEnd && resolved === list.length))
        fail(`Array.${method}(): índice ${at} fora dos limites (tamanho ${list.length}).`);
    return resolved;
}
function deepCopy(value: unknown): unknown {
    if (Array.isArray(value))
        return value.map((item) => deepCopy(item));
    if (value instanceof Dictionary) {
        const copy = new Dictionary();
        for (const [key, entry] of value)
            copy.set(key, deepCopy(entry));
        return copy;
    }
    if (isValueType(value))
        return cloneValueType(value);
    return value;
}
function cloneValueType(value: unknown): unknown {
    if (value === null || typeof value !== 'object')
        return value;
    const ctor = value.constructor as new (source: unknown) => unknown;
    return new ctor(value);
}
function sortValues(a: unknown, b: unknown): number {
    return compare(a, b, 'sort');
}
const ARRAY_METHODS: Record<string, Method<List>> = {
    size: (list) => list.length,
    is_empty: (list) => list.length === 0,
    append: (list, value) => {
        list.push(value);
        return null;
    },
    push_back: (list, value) => {
        list.push(value);
        return null;
    },
    push_front: (list, value) => {
        list.unshift(value);
        return null;
    },
    pop_back: (list) => (list.length === 0 ? null : list.pop()),
    pop_front: (list) => (list.length === 0 ? null : list.shift()),
    pop_at: (list, index) => {
        if (list.length === 0)
            return null;
        const at = normalizeIndex(list, index, 'pop_at');
        return list.splice(at, 1)[0];
    },
    insert: (list, index, value) => {
        const at = normalizeIndex(list, index, 'insert', true);
        list.splice(at, 0, value);
        return 0;
    },
    remove_at: (list, index) => {
        const at = normalizeIndex(list, index, 'remove_at');
        list.splice(at, 1);
        return null;
    },
    erase: (list, value) => {
        const at = list.findIndex((item) => eq(item, value));
        if (at !== -1)
            list.splice(at, 1);
        return null;
    },
    clear: (list) => {
        list.length = 0;
        return null;
    },
    has: (list, value) => list.some((item) => eq(item, value)),
    find: (list, value, from = 0) => {
        for (let index = Math.max(0, toInt(from)); index < list.length; index++)
            if (eq(list[index], value))
                return index;
        return -1;
    },
    rfind: (list, value, from = -1) => {
        const start = toInt(from) < 0 ? list.length - 1 : Math.min(toInt(from), list.length - 1);
        for (let index = start; index >= 0; index--)
            if (eq(list[index], value))
                return index;
        return -1;
    },
    find_custom: (list, fn, from = 0) => {
        const predicate = requireCallable(fn, 'Array', 'find_custom');
        for (let index = Math.max(0, toInt(from)); index < list.length; index++)
            if (truthy(predicate(list[index])))
                return index;
        return -1;
    },
    rfind_custom: (list, fn, from = -1) => {
        const predicate = requireCallable(fn, 'Array', 'rfind_custom');
        const start = toInt(from) < 0 ? list.length - 1 : Math.min(toInt(from), list.length - 1);
        for (let index = start; index >= 0; index--)
            if (truthy(predicate(list[index])))
                return index;
        return -1;
    },
    count: (list, value) => list.filter((item) => eq(item, value)).length,
    front: (list) => (list.length === 0 ? null : list[0]),
    back: (list) => (list.length === 0 ? null : list[list.length - 1]),
    get: (list, index, fallback = null) => {
        const at = toInt(index);
        const resolved = at < 0 ? list.length + at : at;
        return resolved >= 0 && resolved < list.length ? list[resolved] : fallback;
    },
    set: (list, index, value) => {
        list[normalizeIndex(list, index, 'set')] = value;
        return null;
    },
    duplicate: (list, deep = false) => (truthy(deep) ? (deepCopy(list) as List) : list.slice()),
    slice: (list, begin = 0, end = 2147483647, step = 1, deep = false) => {
        const stride = toInt(step);
        if (stride === 0)
            fail('Array.slice(): o passo não pode ser 0.');
        let start = toInt(begin);
        let stop = toInt(end);
        if (start < 0)
            start += list.length;
        if (stop < 0)
            stop += list.length;
        const result: List = [];
        if (stride > 0) {
            start = Math.max(0, start);
            stop = Math.min(list.length, stop);
            for (let index = start; index < stop; index += stride)
                result.push(truthy(deep) ? deepCopy(list[index]) : list[index]);
        }
        else {
            start = Math.min(list.length - 1, start);
            stop = Math.max(-1, stop);
            for (let index = start; index > stop; index += stride)
                result.push(truthy(deep) ? deepCopy(list[index]) : list[index]);
        }
        return result;
    },
    reverse: (list) => {
        list.reverse();
        return null;
    },
    sort: (list) => {
        list.sort(sortValues);
        return null;
    },
    sort_custom: (list, fn) => {
        const before = requireCallable(fn, 'Array', 'sort_custom');
        list.sort((a, b) => (truthy(before(a, b)) ? -1 : truthy(before(b, a)) ? 1 : 0));
        return null;
    },
    shuffle: (list) => {
        for (let index = list.length - 1; index > 0; index--) {
            const other = Math.floor(Math.random() * (index + 1));
            const swap = list[index];
            list[index] = list[other];
            list[other] = swap;
        }
        return null;
    },
    map: (list, fn) => {
        const mapper = requireCallable(fn, 'Array', 'map');
        return list.map((item) => mapper(item));
    },
    filter: (list, fn) => {
        const predicate = requireCallable(fn, 'Array', 'filter');
        return list.filter((item) => truthy(predicate(item)));
    },
    reduce: (list, fn, accum = null) => {
        const reducer = requireCallable(fn, 'Array', 'reduce');
        let value = accum;
        let start = 0;
        if (value === null && list.length > 0) {
            value = list[0];
            start = 1;
        }
        for (let index = start; index < list.length; index++)
            value = reducer(value, list[index]);
        return value;
    },
    any: (list, fn) => {
        const predicate = requireCallable(fn, 'Array', 'any');
        return list.some((item) => truthy(predicate(item)));
    },
    all: (list, fn) => {
        const predicate = requireCallable(fn, 'Array', 'all');
        return list.every((item) => truthy(predicate(item)));
    },
    append_array: (list, other) => {
        if (!Array.isArray(other))
            fail(`Array.append_array(): esperava uma lista, recebeu ${describeTypeOf(other)}.`);
        list.push(...other);
        return null;
    },
    assign: (list, other) => {
        if (!Array.isArray(other))
            fail(`Array.assign(): esperava uma lista, recebeu ${describeTypeOf(other)}.`);
        list.length = 0;
        list.push(...other);
        return null;
    },
    fill: (list, value) => {
        list.fill(value);
        return null;
    },
    resize: (list, size) => {
        const wanted = requireInt(size, 'Array', 'resize', 'o tamanho');
        if (wanted < 0)
            fail('Array.resize(): o tamanho não pode ser negativo.');
        const previous = list.length;
        list.length = wanted;
        for (let index = previous; index < wanted; index++)
            list[index] = null;
        return 0;
    },
    min: (list) => {
        if (list.length === 0)
            return null;
        let best = list[0];
        for (const item of list)
            if (compare(item, best, 'min') < 0)
                best = item;
        return best;
    },
    max: (list) => {
        if (list.length === 0)
            return null;
        let best = list[0];
        for (const item of list)
            if (compare(item, best, 'max') > 0)
                best = item;
        return best;
    },
    pick_random: (list) => (list.length === 0 ? null : list[Math.floor(Math.random() * list.length)]),
    bsearch: (list, value, before = true) => {
        let low = 0;
        let high = list.length;
        const first = truthy(before);
        while (low < high) {
            const middle = (low + high) >> 1;
            const result = compare(list[middle], value, 'bsearch');
            if (result < 0 || (!first && result === 0))
                low = middle + 1;
            else
                high = middle;
        }
        return low;
    },
    bsearch_custom: (list, value, fn, before = true) => {
        const less = requireCallable(fn, 'Array', 'bsearch_custom');
        let low = 0;
        let high = list.length;
        const first = truthy(before);
        while (low < high) {
            const middle = (low + high) >> 1;
            if (truthy(less(list[middle], value)) || (!first && eq(list[middle], value)))
                low = middle + 1;
            else
                high = middle;
        }
        return low;
    },
    hash: (list) => STRING_METHODS.hash(str(list)) as number,
    is_read_only: () => false,
    make_read_only: () => null,
    is_typed: () => false,
    is_same_typed: () => false,
    get_typed_builtin: () => 0,
    get_typed_class_name: () => '',
    get_typed_script: () => null,
};
interface DictView {
    has(key: unknown): boolean;
    get(key: unknown): unknown;
    set(key: unknown, value: unknown): void;
    delete(key: unknown): boolean;
    keys(): unknown[];
    values(): unknown[];
    size(): number;
    clear(): void;
    fresh(): DictView;
    source: unknown;
}
