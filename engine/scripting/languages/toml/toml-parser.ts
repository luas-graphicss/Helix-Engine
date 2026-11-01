import { TomlDateTime, type TomlDateTimeKind } from './toml-datetime';
export type TomlValue = string | number | boolean | TomlDateTime | TomlValue[] | TomlTable;
export interface TomlTable {
    [key: string]: TomlValue;
}
export interface TomlDiagnostic {
    readonly message: string;
    readonly line: number;
    readonly column: number;
    readonly endLine: number;
    readonly endColumn: number;
    readonly code: string;
}
export interface TomlParseResult {
    readonly value: TomlTable;
    readonly diagnostics: readonly TomlDiagnostic[];
}
const WS = ' \t';
const WS_AND_NEWLINE = ' \t\n';
const BARE_KEY_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const KEY_INITIAL_CHARS = `${BARE_KEY_CHARS}"'`;
const HEX_DIGITS = '0123456789ABCDEFabcdef';
function controlChars(): Set<string> {
    const chars = new Set<string>();
    for (let code = 0; code < 32; code++)
        chars.add(String.fromCharCode(code));
    chars.add(String.fromCharCode(127));
    return chars;
}
const ASCII_CTRL = controlChars();
const ILLEGAL_BASIC_STR_CHARS = new Set([...ASCII_CTRL].filter((char) => char !== '\t'));
const ILLEGAL_MULTILINE_BASIC_STR_CHARS = new Set([...ASCII_CTRL].filter((char) => char !== '\t' && char !== '\n'));
const ILLEGAL_LITERAL_STR_CHARS = ILLEGAL_BASIC_STR_CHARS;
const ILLEGAL_MULTILINE_LITERAL_STR_CHARS = ILLEGAL_MULTILINE_BASIC_STR_CHARS;
const ILLEGAL_COMMENT_CHARS = ILLEGAL_BASIC_STR_CHARS;
const BASIC_STR_ESCAPE_REPLACEMENTS: Readonly<Record<string, string>> = {
    '\\b': '\u0008',
    '\\t': '\t',
    '\\n': '\n',
    '\\f': '\u000c',
    '\\r': '\r',
    '\\"': '"',
    '\\\\': '\\',
};
const TIME_PATTERN = '([01][0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9]|60)(?:\\.([0-9]+))?';
const RE_LOCALTIME = new RegExp(TIME_PATTERN, 'y');
const RE_DATETIME = new RegExp(`([0-9]{4})-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])(?:[Tt ]${TIME_PATTERN}(?:([Zz])|([+-])([01][0-9]|2[0-3]):([0-5][0-9]))?)?`, 'y');
const RE_NUMBER = /(?:0(?:(x[0-9A-Fa-f](?:_?[0-9A-Fa-f])*)|(b[01](?:_?[01])*)|(o[0-7](?:_?[0-7])*))|([+-]?(?:0|[1-9](?:_?[0-9])*))(\.[0-9](?:_?[0-9])*)?([eE][+-]?[0-9](?:_?[0-9])*)?)/y;
function matchAt(pattern: RegExp, source: string, pos: number): RegExpExecArray | null {
    pattern.lastIndex = pos;
    return pattern.exec(source);
}
class TomlSyntaxError extends Error {
    constructor(message: string, readonly code: string, readonly start: number, readonly end: number = start) {
        super(message);
    }
}
function describeChar(char: string): string {
    if (char === '')
        return 'o fim do arquivo';
    if (char === '\n')
        return 'uma quebra de linha';
    if (char === '\t')
        return 'uma tabulação';
    const code = char.charCodeAt(0);
    if (code < 32 || code === 127)
        return `o caractere de controle U+${code.toString(16).toUpperCase().padStart(4, '0')}`;
    return `"${char}"`;
}
function describeKey(key: readonly string[]): string {
    return key.map((part) => (/^[A-Za-z0-9_-]+$/.test(part) ? part : JSON.stringify(part))).join('.');
}
type Flag = 'frozen' | 'explicit';
interface FlagNode {
    readonly flags: Set<Flag>;
    readonly recursiveFlags: Set<Flag>;
    readonly nested: Map<string, FlagNode>;
}
function flagNode(): FlagNode {
    return { flags: new Set(), recursiveFlags: new Set(), nested: new Map() };
}
class Flags {
    private readonly root = new Map<string, FlagNode>();
    private readonly pending: Array<[
        readonly string[],
        Flag
    ]> = [];
    addPending(key: readonly string[], flag: Flag): void {
        this.pending.push([key, flag]);
    }
    finalizePending(): void {
        for (const [key, flag] of this.pending)
            this.set(key, flag, false);
        this.pending.length = 0;
    }
    unsetAll(key: readonly string[]): void {
        let container = this.root;
        for (const part of key.slice(0, -1)) {
            const node = container.get(part);
            if (!node)
                return;
            container = node.nested;
        }
        container.delete(key[key.length - 1]);
    }
    set(key: readonly string[], flag: Flag, recursive: boolean): void {
        let container = this.root;
        for (const part of key.slice(0, -1)) {
            let node = container.get(part);
            if (!node) {
                node = flagNode();
                container.set(part, node);
            }
            container = node.nested;
        }
        const stem = key[key.length - 1];
        let node = container.get(stem);
        if (!node) {
            node = flagNode();
            container.set(stem, node);
        }
        ;
        (recursive ? node.recursiveFlags : node.flags).add(flag);
    }
    is(key: readonly string[], flag: Flag): boolean {
        if (key.length === 0)
            return false;
        let container = this.root;
        for (const part of key.slice(0, -1)) {
            const node = container.get(part);
            if (!node)
                return false;
            if (node.recursiveFlags.has(flag))
                return true;
            container = node.nested;
        }
        const node = container.get(key[key.length - 1]);
        return node ? node.flags.has(flag) || node.recursiveFlags.has(flag) : false;
    }
}
function isTable(value: unknown): value is TomlTable {
    return value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof TomlDateTime);
}
function assign(table: TomlTable, key: string, value: TomlValue): void {
    if (key === '__proto__')
        Object.defineProperty(table, key, { value, enumerable: true, writable: true, configurable: true });
    else
        table[key] = value;
}
class NotATableError extends Error {
}
class NestedTable {
    readonly table: TomlTable = {};
    getOrCreateNest(key: readonly string[], accessLists = true): TomlTable {
        let container: TomlTable = this.table;
        for (const part of key) {
            if (!Object.prototype.hasOwnProperty.call(container, part))
                assign(container, part, {});
            let next: TomlValue = container[part];
            if (accessLists && Array.isArray(next))
                next = next[next.length - 1];
            if (!isTable(next))
                throw new NotATableError();
            container = next;
        }
        return container;
    }
    appendNestToList(key: readonly string[]): void {
        const container = this.getOrCreateNest(key.slice(0, -1));
        const stem = key[key.length - 1];
        if (Object.prototype.hasOwnProperty.call(container, stem)) {
            const list = container[stem];
            if (!Array.isArray(list))
                throw new NotATableError();
            list.push({});
        }
        else {
            assign(container, stem, [{}]);
        }
    }
}
class TomlParser {
    private readonly src: string;
    private readonly lineStarts: number[] = [0];
    private readonly diagnostics: TomlDiagnostic[] = [];
    private readonly flags = new Flags();
    private readonly out = new NestedTable();
    constructor(source: string) {
        this.src = source.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
        for (let index = 0; index < this.src.length; index++)
            if (this.src.charCodeAt(index) === 10)
                this.lineStarts.push(index + 1);
    }
    parse(): TomlParseResult {
        try {
            this.document();
        }
        catch (cause) {
            if (!(cause instanceof TomlSyntaxError))
                throw cause;
            this.report(cause.message, cause.code, cause.start, cause.end);
        }
        return { value: this.out.table, diagnostics: this.diagnostics };
    }
    private position(offset: number): {
        line: number;
        column: number;
    } {
        const clamped = Math.max(0, Math.min(offset, this.src.length));
        let low = 0;
        let high = this.lineStarts.length - 1;
        while (low < high) {
            const middle = (low + high + 1) >> 1;
            if (this.lineStarts[middle] <= clamped)
                low = middle;
            else
                high = middle - 1;
        }
        return { line: low + 1, column: clamped - this.lineStarts[low] + 1 };
    }
    private report(message: string, code: string, start: number, end: number = start): void {
        const from = this.position(start);
        const to = this.position(Math.max(end, start));
        this.diagnostics.push({ message, code, line: from.line, column: from.column, endLine: to.line, endColumn: to.column + (end === start ? 1 : 0) });
    }
    private fail(message: string, code: string, start: number, end: number = start): never {
        throw new TomlSyntaxError(message, code, start, end);
    }
    private charAt(pos: number): string {
        return pos < this.src.length ? this.src[pos] : '';
    }
    private skipChars(pos: number, chars: string): number {
        while (pos < this.src.length && chars.includes(this.src[pos]))
            pos++;
        return pos;
    }
    private skipUntil(pos: number, expect: string, errorOn: ReadonlySet<string>, errorOnEof: boolean, what: string): number {
        let newPos = this.src.indexOf(expect, pos);
        if (newPos === -1) {
            newPos = this.src.length;
            if (errorOnEof)
                this.fail(`${what} começou mas o arquivo terminou antes de ${JSON.stringify(expect)} fechá-la.`, 'unterminated', pos, newPos);
        }
        for (let index = pos; index < newPos; index++) {
            const char = this.src[index];
            if (errorOn.has(char))
                this.fail(`${describeChar(char)[0].toUpperCase()}${describeChar(char).slice(1)} não pode aparecer em ${what.toLowerCase()}.${char === '\n' ? ' Para texto em várias linhas use três aspas (""" ou \'\'\').' : ''}`, 'illegal-character', index);
        }
        return newPos;
    }
    private skipComment(pos: number): number {
        if (this.charAt(pos) !== '#')
            return pos;
        return this.skipUntil(pos + 1, '\n', ILLEGAL_COMMENT_CHARS, false, 'Um comentário');
    }
    private skipCommentsAndArrayWs(pos: number): number {
        for (;;) {
            const before = pos;
            pos = this.skipChars(pos, WS_AND_NEWLINE);
            pos = this.skipComment(pos);
            if (pos === before)
                return pos;
        }
    }
}
