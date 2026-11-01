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
    private document(): void {
        const src = this.src;
        let pos = 0;
        let header: readonly string[] = [];
        for (;;) {
            pos = this.skipChars(pos, WS);
            const char = this.charAt(pos);
            if (char === '')
                break;
            if (char === '\n') {
                pos++;
                continue;
            }
            if (KEY_INITIAL_CHARS.includes(char)) {
                pos = this.keyValueRule(pos, header);
                pos = this.skipChars(pos, WS);
            }
            else if (char === '[') {
                this.flags.finalizePending();
                if (src[pos + 1] === '[') {
                    const result = this.createListRule(pos);
                    pos = result.pos;
                    header = result.key;
                }
                else {
                    const result = this.createDictRule(pos);
                    pos = result.pos;
                    header = result.key;
                }
                pos = this.skipChars(pos, WS);
            }
            else if (char !== '#') {
                if (char === '=')
                    this.fail('Falta o nome da chave antes de "=".', 'missing-key', pos);
                if (char === ']')
                    this.fail('"]" sem um "[" correspondente nesta linha.', 'unexpected-bracket', pos);
                this.fail(`${describeChar(char)[0].toUpperCase()}${describeChar(char).slice(1)} não pode começar uma linha de TOML: espere uma chave (nome = valor), um cabeçalho ([tabela]) ou um comentário (#).`, 'invalid-statement', pos);
            }
            pos = this.skipComment(pos);
            const next = this.charAt(pos);
            if (next === '')
                break;
            if (next !== '\n')
                this.fail(`Depois de um valor ou cabeçalho só pode vir um comentário ou o fim da linha, mas encontrei ${describeChar(next)}.${this.trailingHint(pos)}`, 'expected-newline', pos);
            pos++;
        }
    }
    private trailingHint(pos: number): string {
        const rest = this.src.slice(pos, this.src.indexOf('\n', pos) === -1 ? undefined : this.src.indexOf('\n', pos));
        const before = this.src.slice(this.lineStarts[this.position(pos).line - 1], pos);
        if (/^[0-9]/.test(rest) && /(^|[=\s])[+-]?0$/.test(before))
            return ' Números não podem ter zeros à esquerda (escreva 7 em vez de 07).';
        if (/^[xob][0-9A-Fa-f]/.test(rest) && /[+-]0$/.test(before))
            return ' Números hexadecimais, octais e binários não aceitam sinal (0xFF, 0o755, 0b1010).';
        if (/^[XOB][0-9A-Fa-f]/.test(rest) && /(^|[=\s])0$/.test(before))
            return ' O prefixo de base precisa ser minúsculo: 0x, 0o ou 0b.';
        if (/^[0-9_]/.test(rest) && /[0-9]_$/.test(before))
            return ' O separador "_" só pode ficar entre dois dígitos.';
        if (rest.startsWith(','))
            return ' Cada chave fica numa linha própria; a vírgula só separa itens dentro de [ ] ou { }.';
        if (/^\.[0-9]/.test(rest))
            return ' Um float precisa de dígitos dos dois lados do ponto (0.5, 7.0).';
        if (rest.startsWith('.'))
            return ' Chaves pontuadas (a.b = 1) só valem antes do "=".';
        if (/^[A-Za-z0-9_-]+\s*=/.test(rest))
            return ' Cada chave fica numa linha própria.';
        if (/^(T|t|\s[0-9])/.test(rest) && /[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(before))
            return ' Uma data-hora precisa de horas, minutos e segundos (2024-05-27T07:32:00).';
        return '';
    }
    private createDictRule(pos: number): {
        pos: number;
        key: readonly string[];
    } {
        const start = pos;
        pos++;
        pos = this.skipChars(pos, WS);
        const parsed = this.parseKey(pos, 'do cabeçalho');
        pos = parsed.pos;
        const key = parsed.key;
        if (this.charAt(pos) !== ']')
            this.fail(`O cabeçalho [${describeKey(key)} precisa fechar com "]" na mesma linha, mas encontrei ${describeChar(this.charAt(pos))}.`, 'unclosed-table-header', pos);
        if (this.flags.is(key, 'explicit') || this.flags.is(key, 'frozen')) {
            this.report(this.flags.is(key, 'frozen') ? `[${describeKey(key)}] não pode ser declarada: "${describeKey(key)}" já foi definida como valor (tabela inline ou lista) e está fechada.` : `A tabela [${describeKey(key)}] já foi declarada antes neste arquivo; junte as duas seções numa só.`, 'duplicate-table', start, pos + 1);
            return { pos: pos + 1, key };
        }
        this.flags.set(key, 'explicit', false);
        try {
            this.out.getOrCreateNest(key);
        }
        catch (cause) {
            if (!(cause instanceof NotATableError))
                throw cause;
            this.report(`[${describeKey(key)}] não pode ser uma tabela: um dos nomes desse caminho já guarda um valor que não é tabela.`, 'not-a-table', start, pos + 1);
        }
        return { pos: pos + 1, key };
    }
    private createListRule(pos: number): {
        pos: number;
        key: readonly string[];
    } {
        const start = pos;
        pos += 2;
        pos = this.skipChars(pos, WS);
        const parsed = this.parseKey(pos, 'do cabeçalho');
        pos = parsed.pos;
        const key = parsed.key;
        if (!this.src.startsWith(']]', pos))
            this.fail(`O cabeçalho [[${describeKey(key)} precisa fechar com "]]" na mesma linha, mas encontrei ${describeChar(this.charAt(pos))}.`, 'unclosed-array-header', pos);
        if (this.flags.is(key, 'frozen')) {
            this.report(`[[${describeKey(key)}]] não pode acrescentar um item: "${describeKey(key)}" foi definida como valor (lista ou tabela inline) e está fechada.`, 'frozen-array', start, pos + 2);
            return { pos: pos + 2, key };
        }
        this.flags.unsetAll(key);
        this.flags.set(key, 'explicit', false);
        try {
            this.out.appendNestToList(key);
        }
        catch (cause) {
            if (!(cause instanceof NotATableError))
                throw cause;
            this.report(`[[${describeKey(key)}]] não pode ser uma lista de tabelas: "${describeKey(key)}" já guarda outro tipo de valor.`, 'not-an-array-of-tables', start, pos + 2);
        }
        return { pos: pos + 2, key };
    }
    private keyValueRule(pos: number, header: readonly string[]): number {
        const start = pos;
        const pair = this.parseKeyValuePair(pos);
        pos = pair.pos;
        const key = pair.key;
        const value = pair.value;
        const keyParent = key.slice(0, -1);
        const keyStem = key[key.length - 1];
        const absoluteParent = [...header, ...keyParent];
        for (let index = 1; index < key.length; index++) {
            const containerKey = [...header, ...key.slice(0, index)];
            if (this.flags.is(containerKey, 'explicit')) {
                this.report(`A chave pontuada "${describeKey(key)}" tentaria estender a tabela "${describeKey(containerKey)}", que já foi declarada por cabeçalho (ou por outra seção); acrescente a chave dentro da seção dela.`, 'dotted-redefines-table', start, pair.keyEnd);
                return pos;
            }
            this.flags.addPending(containerKey, 'explicit');
        }
        if (this.flags.is(absoluteParent, 'frozen')) {
            this.report(`"${describeKey(key)}" não pode ser acrescentada: "${describeKey(absoluteParent)}" é uma tabela inline ou lista já fechada.`, 'frozen-table', start, pair.keyEnd);
            return pos;
        }
        let nest: TomlTable;
        try {
            nest = this.out.getOrCreateNest(absoluteParent);
        }
        catch (cause) {
            if (!(cause instanceof NotATableError))
                throw cause;
            this.report(`"${describeKey(key)}" não pode ser acrescentada: um dos nomes do caminho "${describeKey(absoluteParent)}" já guarda um valor que não é tabela.`, 'not-a-table', start, pair.keyEnd);
            return pos;
        }
        if (Object.prototype.hasOwnProperty.call(nest, keyStem)) {
            this.report(`A chave "${describeKey(key)}" já foi definida${header.length > 0 ? ` em [${describeKey(header)}]` : ''}; cada chave só pode aparecer uma vez (o primeiro valor é mantido).`, 'duplicate-key', start, pair.keyEnd);
            return pos;
        }
        if (isTable(value) || Array.isArray(value))
            this.flags.set([...header, ...key], 'frozen', true);
        assign(nest, keyStem, value);
        return pos;
    }
    private parseKeyValuePair(pos: number): {
        pos: number;
        key: readonly string[];
        keyEnd: number;
        value: TomlValue;
    } {
        const parsed = this.parseKey(pos, 'da chave');
        pos = parsed.pos;
        const char = this.charAt(pos);
        if (char !== '=') {
            if (char === ':')
                this.fail(`Depois da chave "${describeKey(parsed.key)}" vem "=" (TOML não usa ":" como em YAML/JSON).`, 'expected-equals', pos);
            this.fail(`Depois da chave "${describeKey(parsed.key)}" era esperado "=", mas encontrei ${describeChar(char)}.`, 'expected-equals', pos);
        }
        pos++;
        pos = this.skipChars(pos, WS);
        const next = this.charAt(pos);
        if (next === '' || next === '\n' || next === '#')
            this.fail(`A chave "${describeKey(parsed.key)}" está sem valor depois do "=".`, 'missing-value', pos);
        const value = this.parseValue(pos);
        return { pos: value.pos, key: parsed.key, keyEnd: parsed.end, value: value.value };
    }
    private parseKey(pos: number, what: string): {
        pos: number;
        key: string[];
        end: number;
    } {
        const first = this.parseKeyPart(pos, what);
        pos = first.pos;
        let end = pos;
        const key = [first.part];
        pos = this.skipChars(pos, WS);
        for (;;) {
            if (this.charAt(pos) !== '.')
                return { pos, key, end };
            pos++;
            pos = this.skipChars(pos, WS);
            const part = this.parseKeyPart(pos, what);
            pos = part.pos;
            end = pos;
            key.push(part.part);
            pos = this.skipChars(pos, WS);
        }
    }
    private parseKeyPart(pos: number, what: string): {
        pos: number;
        part: string;
    } {
        const char = this.charAt(pos);
        if (char !== '' && BARE_KEY_CHARS.includes(char)) {
            const start = pos;
            pos = this.skipChars(pos, BARE_KEY_CHARS);
            return { pos, part: this.src.slice(start, pos) };
        }
        if (char === "'") {
            const literal = this.parseLiteralStr(pos);
            return { pos: literal.pos, part: literal.value };
        }
        if (char === '"') {
            const basic = this.parseOneLineBasicStr(pos);
            return { pos: basic.pos, part: basic.value };
        }
        if (char === '' || char === '\n')
            this.fail(`Falta o nome ${what} (depois do ponto ou do colchete).`, 'missing-key', pos);
        if (char === '.')
            this.fail(`Nome ${what} vazio entre dois pontos; cada parte de uma chave pontuada precisa de um nome.`, 'empty-key-part', pos);
        this.fail(`${describeChar(char)[0].toUpperCase()}${describeChar(char).slice(1)} não pode fazer parte de um nome de chave sem aspas; use só letras, dígitos, "-" e "_", ou ponha o nome entre aspas.`, 'invalid-key-character', pos);
    }
    private parseValue(pos: number): {
        pos: number;
        value: TomlValue;
    } {
        const src = this.src;
        const char = this.charAt(pos);
        if (char === '"')
            return src.startsWith('"""', pos) ? this.parseMultilineStr(pos, false) : this.parseOneLineBasicStr(pos);
        if (char === "'")
            return src.startsWith("'''", pos) ? this.parseMultilineStr(pos, true) : this.parseLiteralStr(pos);
        if (char === 't' && src.startsWith('true', pos))
            return { pos: pos + 4, value: true };
        if (char === 'f' && src.startsWith('false', pos))
            return { pos: pos + 5, value: false };
        if (char === '[')
            return this.parseArray(pos);
        if (char === '{')
            return this.parseInlineTable(pos);
        const datetime = matchAt(RE_DATETIME, src, pos);
        if (datetime)
            return { pos: pos + datetime[0].length, value: this.matchToDateTime(datetime, pos) };
        const localTime = matchAt(RE_LOCALTIME, src, pos);
        if (localTime)
            return { pos: pos + localTime[0].length, value: this.matchToLocalTime(localTime, pos) };
        const number = matchAt(RE_NUMBER, src, pos);
        if (number)
            return { pos: pos + number[0].length, value: this.matchToNumber(number) };
        const three = src.slice(pos, pos + 3);
        if (three === 'inf')
            return { pos: pos + 3, value: Infinity };
        if (three === 'nan')
            return { pos: pos + 3, value: NaN };
        const four = src.slice(pos, pos + 4);
        if (four === '+inf')
            return { pos: pos + 4, value: Infinity };
        if (four === '-inf')
            return { pos: pos + 4, value: -Infinity };
        if (four === '+nan' || four === '-nan')
            return { pos: pos + 4, value: NaN };
        this.fail(this.describeInvalidValue(pos), 'invalid-value', pos);
    }
    private describeInvalidValue(pos: number): string {
        const lineEnd = this.src.indexOf('\n', pos);
        const rest = this.src.slice(pos, lineEnd === -1 ? undefined : lineEnd).trim();
        if (/^(True|TRUE|False|FALSE)\b/.test(rest))
            return `"${/^[A-Za-z]+/.exec(rest)![0]}" não é um booleano em TOML: use true ou false, em minúsculas.`;
        if (/^(yes|no|on|off|null|nil|None)\b/.test(rest))
            return `"${/^[A-Za-z]+/.exec(rest)![0]}" não existe em TOML; use true/false, um número, texto entre aspas, ou remova a chave para "sem valor".`;
        if (/^\.[0-9]/.test(rest))
            return 'Um float precisa de um dígito antes do ponto (0.5 em vez de .5).';
        if (/^[+-]?0[0-9]/.test(rest))
            return 'Números não podem ter zeros à esquerda (escreva 7 em vez de 07).';
        if (/^[+-]?(0x|0o|0b)/i.test(rest))
            return 'Números hexadecimais, octais e binários não aceitam sinal e usam o prefixo em minúsculas (0xFF, 0o755, 0b1010).';
        if (/^0X|^0O|^0B/.test(rest))
            return 'O prefixo de base precisa ser minúsculo: 0x, 0o ou 0b.';
        if (/^[0-9]{4}-[0-9]{2}-[0-9]{2}/.test(rest))
            return 'Data inválida: use AAAA-MM-DD, com mês de 01 a 12 e dia válido para o mês.';
        if (/^[0-9]{1,2}:[0-9]{2}/.test(rest))
            return 'Hora inválida: use HH:MM:SS, com horas de 00 a 23 e minutos e segundos de 00 a 59.';
        if (/^[A-Za-z_]/.test(rest))
            return `"${/^[A-Za-z_][A-Za-z0-9_-]*/.exec(rest)![0]}" não é um valor válido: texto precisa ficar entre aspas ("${/^[A-Za-z_][A-Za-z0-9_-]*/.exec(rest)![0]}").`;
        if (rest.startsWith(','))
            return 'Vírgula no lugar de um valor.';
        if (rest.startsWith(']'))
            return 'Falta um valor antes de "]".';
        if (rest.startsWith('}'))
            return 'Falta um valor antes de "}".';
        return `${describeChar(this.charAt(pos))[0].toUpperCase()}${describeChar(this.charAt(pos)).slice(1)} não começa um valor válido de TOML (texto entre aspas, número, true/false, data, [lista] ou {tabela}).`;
    }
    private matchToNumber(match: RegExpExecArray): number {
        const text = match[0].replace(/_/g, '');
        if (match[1])
            return parseInt(text.slice(2), 16);
        if (match[2])
            return parseInt(text.slice(2), 2);
        if (match[3])
            return parseInt(text.slice(2), 8);
        if (match[5] || match[6])
            return parseFloat(text);
        return parseInt(text, 10);
    }
    private matchToLocalTime(match: RegExpExecArray, pos: number): TomlDateTime {
        const hour = Number(match[1]);
        const minute = Number(match[2]);
        const second = Number(match[3]);
        const nanosecond = this.fractionToNanoseconds(match[4]);
        if (second === 60 && !(hour === 23 && minute === 59))
            this.fail('Segundo 60 (segundo bissexto) só existe em 23:59:60.', 'invalid-time', pos, pos + match[0].length);
        return new TomlDateTime({ kind: 'local-time', year: 1970, month: 1, day: 1, hour, minute, second, nanosecond, offsetMinutes: null });
    }
    private matchToDateTime(match: RegExpExecArray, pos: number): TomlDateTime {
        const year = Number(match[1]);
        const month = Number(match[2]);
        const day = Number(match[3]);
        const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
        if (day > daysInMonth)
            this.fail(`${match[1]}-${match[2]} não tem dia ${match[3]} (o mês tem ${daysInMonth} dias).`, 'invalid-date', pos, pos + match[0].length);
        if (match[4] === undefined)
            return new TomlDateTime({ kind: 'local-date', year, month, day, hour: 0, minute: 0, second: 0, nanosecond: 0, offsetMinutes: null });
        const hour = Number(match[4]);
        const minute = Number(match[5]);
        const second = Number(match[6]);
        const nanosecond = this.fractionToNanoseconds(match[7]);
        if (second === 60 && !(hour === 23 && minute === 59))
            this.fail('Segundo 60 (segundo bissexto) só existe em 23:59:60.', 'invalid-time', pos, pos + match[0].length);
        let kind: TomlDateTimeKind = 'local-date-time';
        let offsetMinutes: number | null = null;
        if (match[8] !== undefined) {
            kind = 'offset-date-time';
            offsetMinutes = 0;
        }
        else if (match[9] !== undefined) {
            kind = 'offset-date-time';
            const sign = match[9] === '-' ? -1 : 1;
            offsetMinutes = sign * (Number(match[10]) * 60 + Number(match[11]));
        }
        return new TomlDateTime({ kind, year, month, day, hour, minute, second, nanosecond, offsetMinutes });
    }
    private fractionToNanoseconds(digits: string | undefined): number {
        if (!digits)
            return 0;
        return Number(digits.slice(0, 9).padEnd(9, '0'));
    }
    private parseOneLineBasicStr(pos: number): {
        pos: number;
        value: string;
    } {
        return this.parseBasicStr(pos + 1, false, pos);
    }
    private parseLiteralStr(pos: number): {
        pos: number;
        value: string;
    } {
        const start = pos + 1;
        const end = this.skipUntil(start, "'", ILLEGAL_LITERAL_STR_CHARS, true, 'Uma string literal');
        return { pos: end + 1, value: this.src.slice(start, end) };
    }
    private parseMultilineStr(pos: number, literal: boolean): {
        pos: number;
        value: string;
    } {
        const opening = pos;
        pos += 3;
        if (this.src.startsWith('\n', pos))
            pos++;
        let result: string;
        const delimiter = literal ? "'" : '"';
        if (literal) {
            const end = this.skipUntil(pos, "'''", ILLEGAL_MULTILINE_LITERAL_STR_CHARS, true, 'Uma string literal de várias linhas');
            result = this.src.slice(pos, end);
            pos = end + 3;
        }
        else {
            const parsed = this.parseBasicStr(pos, true, opening);
            result = parsed.value;
            pos = parsed.pos;
        }
        if (!this.src.startsWith(delimiter, pos))
            return { pos, value: result };
        pos++;
        if (!this.src.startsWith(delimiter, pos))
            return { pos, value: result + delimiter };
        pos++;
        return { pos, value: result + delimiter + delimiter };
    }
    private parseBasicStr(pos: number, multiline: boolean, opening: number): {
        pos: number;
        value: string;
    } {
        const src = this.src;
        const errorOn = multiline ? ILLEGAL_MULTILINE_BASIC_STR_CHARS : ILLEGAL_BASIC_STR_CHARS;
        let result = '';
        let startPos = pos;
        for (;;) {
            if (pos >= src.length)
                this.fail(`A string que começa aqui não foi fechada${multiline ? ' (faltam as três aspas de fecho """)' : ' (falta a aspa de fecho ")'}.`, 'unterminated-string', opening, src.length);
            const char = src[pos];
            if (char === '"') {
                if (!multiline)
                    return { pos: pos + 1, value: result + src.slice(startPos, pos) };
                if (src.startsWith('"""', pos))
                    return { pos: pos + 3, value: result + src.slice(startPos, pos) };
                pos++;
                continue;
            }
            if (char === '\\') {
                result += src.slice(startPos, pos);
                const escaped = this.parseBasicStrEscape(pos, multiline);
                pos = escaped.pos;
                result += escaped.value;
                startPos = pos;
                continue;
            }
            if (errorOn.has(char)) {
                if (char === '\n')
                    this.fail('Uma string entre aspas simples não pode quebrar linha; feche-a na mesma linha ou use três aspas (""") para texto em várias linhas.', 'unterminated-string', opening, pos);
                this.fail(`${describeChar(char)[0].toUpperCase()}${describeChar(char).slice(1)} não pode aparecer dentro de uma string; use o escape \\u${char.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}.`, 'illegal-character', pos);
            }
            pos++;
        }
    }
    private parseBasicStrEscape(pos: number, multiline: boolean): {
        pos: number;
        value: string;
    } {
        const src = this.src;
        const escapeId = src.slice(pos, pos + 2);
        const escapeStart = pos;
        pos += 2;
        if (multiline && (escapeId === '\\ ' || escapeId === '\\\t' || escapeId === '\\\n')) {
            if (escapeId !== '\\\n') {
                pos = this.skipChars(pos, WS);
                if (pos >= src.length)
                    return { pos, value: '' };
                if (src[pos] !== '\n')
                    this.fail('Uma barra invertida só pode terminar a linha (para juntar linhas) se depois dela vier apenas espaço até a quebra de linha.', 'invalid-escape', escapeStart, pos);
                pos++;
            }
            pos = this.skipChars(pos, WS_AND_NEWLINE);
            return { pos, value: '' };
        }
        if (escapeId === '\\u')
            return this.parseHexChar(pos, 4, escapeStart);
        if (escapeId === '\\U')
            return this.parseHexChar(pos, 8, escapeStart);
        const replacement = BASIC_STR_ESCAPE_REPLACEMENTS[escapeId];
        if (replacement === undefined) {
            const shown = escapeId.length < 2 || escapeId[1] === '\n' ? '\\' : escapeId;
            this.fail(`"${shown}" não é um escape válido; os escapes de TOML são \\b \\t \\n \\f \\r \\" \\\\ \\uXXXX e \\UXXXXXXXX (para uma barra literal escreva \\\\ ou use aspas simples).`, 'invalid-escape', escapeStart, pos);
        }
        return { pos, value: replacement };
    }
    private parseHexChar(pos: number, length: number, escapeStart: number): {
        pos: number;
        value: string;
    } {
        const hex = this.src.slice(pos, pos + length);
        if (hex.length !== length || [...hex].some((char) => !HEX_DIGITS.includes(char)))
            this.fail(`O escape \\${length === 4 ? 'u' : 'U'} precisa de exatamente ${length} dígitos hexadecimais.`, 'invalid-escape', escapeStart, pos + hex.length);
        pos += length;
        const codePoint = parseInt(hex, 16);
        const scalar = (codePoint >= 0 && codePoint <= 0xd7ff) || (codePoint >= 0xe000 && codePoint <= 0x10ffff);
        if (!scalar)
            this.fail(`\\${length === 4 ? 'u' : 'U'}${hex} não é um caractere Unicode válido (pares substitutos e valores acima de U+10FFFF não existem como caracteres).`, 'invalid-escape', escapeStart, pos);
        return { pos, value: String.fromCodePoint(codePoint) };
    }
    private parseArray(pos: number): {
        pos: number;
        value: TomlValue[];
    } {
        const opening = pos;
        pos++;
        const array: TomlValue[] = [];
        pos = this.skipCommentsAndArrayWs(pos);
        if (this.src.startsWith(']', pos))
            return { pos: pos + 1, value: array };
        for (;;) {
            const item = this.parseValue(pos);
            pos = item.pos;
            array.push(item.value);
            pos = this.skipCommentsAndArrayWs(pos);
            const char = this.charAt(pos);
            if (char === ']')
                return { pos: pos + 1, value: array };
            if (char !== ',') {
                if (char === '')
                    this.fail('A lista que começa aqui não foi fechada: falta "]".', 'unclosed-array', opening, pos);
                this.fail(`Dentro de uma lista os itens são separados por vírgula, mas depois de um item encontrei ${describeChar(char)}.`, 'unclosed-array', pos);
            }
            pos++;
            pos = this.skipCommentsAndArrayWs(pos);
            if (this.src.startsWith(']', pos))
                return { pos: pos + 1, value: array };
        }
    }
    private parseInlineTable(pos: number): {
        pos: number;
        value: TomlTable;
    } {
        const opening = pos;
        pos++;
        const nested = new NestedTable();
        const flags = new Flags();
        pos = this.skipChars(pos, WS);
        if (this.src.startsWith('}', pos))
            return { pos: pos + 1, value: nested.table };
        for (;;) {
            if (this.charAt(pos) === '\n' || this.charAt(pos) === '')
                this.fail('Uma tabela inline { } precisa ficar inteira numa linha; para várias linhas use um cabeçalho [tabela].', 'multiline-inline-table', opening, pos);
            const pairStart = pos;
            const pair = this.parseKeyValuePair(pos);
            pos = pair.pos;
            const key = pair.key;
            const keyParent = key.slice(0, -1);
            const keyStem = key[key.length - 1];
            if (flags.is(key, 'frozen'))
                this.fail(`"${describeKey(key)}" não pode ser acrescentada: a tabela inline "${describeKey(keyParent)}" já está fechada.`, 'frozen-table', pairStart, pair.keyEnd);
            let nest: TomlTable;
            try {
                nest = nested.getOrCreateNest(keyParent, false);
            }
            catch (cause) {
                if (!(cause instanceof NotATableError))
                    throw cause;
                this.fail(`"${describeKey(key)}": um dos nomes do caminho já guarda um valor que não é tabela.`, 'not-a-table', pairStart, pair.keyEnd);
            }
            if (Object.prototype.hasOwnProperty.call(nest, keyStem))
                this.fail(`A chave "${describeKey(key)}" aparece duas vezes na mesma tabela inline.`, 'duplicate-key', pairStart, pair.keyEnd);
            assign(nest, keyStem, pair.value);
            pos = this.skipChars(pos, WS);
            const char = this.charAt(pos);
            if (char === '}')
                return { pos: pos + 1, value: nested.table };
            if (char !== ',') {
                if (char === '\n' || char === '')
                    this.fail('A tabela inline que começa aqui não foi fechada: falta "}" na mesma linha.', 'unclosed-inline-table', opening, pos);
                this.fail(`Dentro de uma tabela inline os pares são separados por vírgula, mas encontrei ${describeChar(char)}.`, 'unclosed-inline-table', pos);
            }
            if (isTable(pair.value) || Array.isArray(pair.value))
                flags.set(key, 'frozen', true);
            pos++;
            pos = this.skipChars(pos, WS);
            if (this.charAt(pos) === '}')
                this.fail('Tabelas inline não aceitam vírgula depois do último par.', 'trailing-comma', pos);
        }
    }
}
export function parseToml(source: string): TomlParseResult {
    return new TomlParser(source).parse();
}
export function parseTomlOrThrow(source: string): TomlTable {
    const result = parseToml(source);
    const first = result.diagnostics[0];
    if (first)
        throw new Error(`TOML inválido (linha ${first.line}, coluna ${first.column}): ${first.message}`);
    return result.value;
}
