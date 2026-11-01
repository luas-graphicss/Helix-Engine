import { CLOSERS, KEYWORDS, OPENERS, OPERATORS, type SourceSpan, type Token } from './tokens';
export interface LexDiagnostic extends SourceSpan {
    readonly message: string;
}
export interface LexResult {
    readonly tokens: Token[];
    readonly diagnostics: LexDiagnostic[];
}
const SIMPLE_ESCAPES: Record<string, string> = { n: '\n', t: '\t', r: '\r', a: '\x07', b: '\b', f: '\f', v: '\v', '"': '"', "'": "'", '\\': '\\' };
function isIdentifierStart(char: string): boolean {
    return /[\p{L}_]/u.test(char);
}
function isIdentifierPart(char: string): boolean {
    return /[\p{L}\p{N}_]/u.test(char);
}
function isDigit(char: string): boolean {
    return char >= '0' && char <= '9';
}
interface Position {
    readonly line: number;
    readonly column: number;
}
export class Lexer {
    private index = 0;
    private line = 1;
    private column = 1;
    private readonly tokens: Token[] = [];
    private readonly diagnostics: LexDiagnostic[] = [];
    private readonly indents: Array<{
        width: number;
        depth: number;
    }> = [{ width: 0, depth: 0 }];
    private depth = 0;
    private indentChar: ' ' | '\t' | null = null;
    private atLineStart = true;
    private continuation = false;
    constructor(private readonly source: string) { }
    tokenize(): LexResult {
        while (this.index < this.source.length) {
            if (this.atLineStart && !this.continuation) {
                this.readIndentation();
                if (this.index >= this.source.length)
                    break;
            }
            this.atLineStart = false;
            const char = this.source[this.index];
            if (char === '\n') {
                this.newline();
                continue;
            }
            if (char === ' ' || char === '\t' || char === '\r') {
                this.advance();
                continue;
            }
            if (char === '#') {
                while (this.index < this.source.length && this.source[this.index] !== '\n')
                    this.advance();
                continue;
            }
            if (char === '\\' && this.peekPastSpaces(1) === '\n') {
                while (this.source[this.index] !== '\n')
                    this.advance();
                this.continuation = true;
                this.advance();
                this.line++;
                this.column = 1;
                continue;
            }
            this.continuation = false;
            if (isDigit(char) || (char === '.' && isDigit(this.source[this.index + 1] ?? ''))) {
                this.readNumber();
                continue;
            }
            if (char === '"' || char === "'") {
                this.readString(null);
                continue;
            }
            if ((char === 'r' || char === '&' || char === '^') && (this.source[this.index + 1] === '"' || this.source[this.index + 1] === "'")) {
                this.readString(char);
                continue;
            }
            if (char === '$') {
                this.readNodeShortcut();
                continue;
            }
            if (char === '%' && isIdentifierStart(this.source[this.index + 1] ?? '') && this.previousAllowsUnique()) {
                this.readUniqueNode();
                continue;
            }
            if (char === '@') {
                this.readAnnotation();
                continue;
            }
            if (isIdentifierStart(char)) {
                this.readIdentifier();
                continue;
            }
            if (!this.readOperator()) {
                const start = this.position();
                this.advance();
                this.error(`Caractere inesperado "${char}".`, start);
            }
        }
        this.finish();
        return { tokens: this.tokens, diagnostics: this.diagnostics };
    }
    private readIndentation(): void {
        const soft = this.depth > 0;
        let start = this.position();
        let width = 0;
        let char: '\t' | ' ' | null = null;
        while (this.index < this.source.length) {
            const current = this.source[this.index];
            if (current === ' ' || current === '\t') {
                if (char === null)
                    char = current;
                else if (char !== current && !soft) {
                    this.error(current === '\t' ? 'Indentação misturada: a linha usa tabulação e espaço ao mesmo tempo.' : 'Indentação misturada: a linha usa espaço e tabulação ao mesmo tempo.', this.position());
                }
                width += current === '\t' ? 4 : 1;
                this.advance();
                continue;
            }
            if (current !== '\n' && current !== '\r' && current !== '#')
                break;
            if (current === '#')
                while (this.index < this.source.length && this.source[this.index] !== '\n')
                    this.advance();
            if (this.source[this.index] === '\r')
                this.advance();
            if (this.source[this.index] === '\n') {
                this.advance();
                this.line++;
                this.column = 1;
            }
            start = this.position();
            width = 0;
            char = null;
        }
        if (this.index >= this.source.length)
            return;
        if (char !== null && !soft) {
            if (this.indentChar === null)
                this.indentChar = char;
            else if (this.indentChar !== char) {
                this.error(char === '\t' ? 'O arquivo indenta com espaços, mas esta linha usa tabulação.' : 'O arquivo indenta com tabulações, mas esta linha usa espaços.', start);
            }
        }
        const current = this.indents[this.indents.length - 1].width;
        if (width > current) {
            this.indents.push({ width, depth: this.depth });
            this.pushLayout('indent', start);
        }
        else if (width < current) {
            while (this.indents.length > 1 && this.indents[this.indents.length - 1].width > width && (!soft || this.indents[this.indents.length - 1].depth > 0)) {
                const block = this.indents.pop()!;
                this.pushLayout('dedent', start, block.depth);
            }
            if (!soft && this.indents[this.indents.length - 1].width !== width) {
                this.error('A indentação desta linha não corresponde a nenhum bloco aberto.', start);
            }
        }
    }
    private newline(): void {
        const start = this.position();
        this.advance();
        if (!this.continuation) {
            const last = this.tokens[this.tokens.length - 1];
            if (last && last.kind !== 'newline' && last.kind !== 'indent' && last.kind !== 'dedent')
                this.pushLayout('newline', start);
        }
        this.line++;
        this.column = 1;
        this.atLineStart = true;
    }
    private closeSoftBlocks(at: Position): void {
        while (this.indents.length > 1 && this.indents[this.indents.length - 1].depth > this.depth) {
            const block = this.indents.pop()!;
            this.pushLayout('dedent', at, block.depth);
        }
    }
    private finish(): void {
        const end = this.position();
        const last = this.tokens[this.tokens.length - 1];
        if (last && last.kind !== 'newline' && last.kind !== 'dedent' && last.kind !== 'indent')
            this.pushLayout('newline', end);
        while (this.indents.length > 1) {
            const block = this.indents.pop()!;
            this.pushLayout('dedent', end, block.depth);
        }
        this.tokens.push({ kind: 'eof', value: '', line: end.line, column: end.column, endLine: end.line, endColumn: end.column });
    }
    private readNumber(): void {
        const start = this.position();
        const startIndex = this.index;
        let isFloat = false;
        const second = this.source[this.index + 1];
        if (this.source[this.index] === '0' && (second === 'x' || second === 'X' || second === 'b' || second === 'B')) {
            const hex = second === 'x' || second === 'X';
            this.advanceBy(2);
            const digitsStart = this.index;
            while (this.index < this.source.length && (hex ? /[0-9a-fA-F_]/ : /[01_]/).test(this.source[this.index]))
                this.advance();
            const digits = this.source.slice(digitsStart, this.index).replace(/_/g, '');
            if (digits.length === 0)
                this.error(hex ? 'Número hexadecimal sem dígitos depois de 0x.' : 'Número binário sem dígitos depois de 0b.', start);
            const value = digits.length === 0 ? 0 : parseInt(digits, hex ? 16 : 2);
            this.pushNumber('int', this.source.slice(startIndex, this.index), value, start);
            return;
        }
        while (this.index < this.source.length && (isDigit(this.source[this.index]) || this.source[this.index] === '_'))
            this.advance();
        if (this.source[this.index] === '.' && isDigit(this.source[this.index + 1] ?? '')) {
            isFloat = true;
            this.advance();
            while (this.index < this.source.length && (isDigit(this.source[this.index]) || this.source[this.index] === '_'))
                this.advance();
        }
        else if (this.source[this.index] === '.' && !isIdentifierStart(this.source[this.index + 1] ?? '') && this.source[this.index + 1] !== '.') {
            this.advance();
            this.error('Número decimal incompleto: escreva os dígitos depois do ponto (por exemplo 5.0).', start);
            isFloat = true;
        }
        if (this.source[this.index] === 'e' || this.source[this.index] === 'E') {
            const save = { index: this.index, line: this.line, column: this.column };
            this.advance();
            if (this.source[this.index] === '+' || this.source[this.index] === '-')
                this.advance();
            if (isDigit(this.source[this.index] ?? '')) {
                isFloat = true;
                while (this.index < this.source.length && isDigit(this.source[this.index]))
                    this.advance();
            }
            else {
                this.index = save.index;
                this.line = save.line;
                this.column = save.column;
            }
        }
        const text = this.source.slice(startIndex, this.index);
        if (isIdentifierStart(this.source[this.index] ?? '')) {
            this.error(`Número seguido de letra: "${text}${this.source[this.index]}" não é um literal válido.`, start);
        }
        this.pushNumber(isFloat ? 'float' : 'int', text, Number(text.replace(/_/g, '')), start);
    }
    private readString(prefix: 'r' | '&' | '^' | null): void {
        const start = this.position();
        if (prefix)
            this.advance();
        const quote = this.source[this.index];
        const triple = this.source.startsWith(quote.repeat(3), this.index);
        const closing = triple ? quote.repeat(3) : quote;
        this.advanceBy(closing.length);
        let value = '';
        let closed = false;
        while (this.index < this.source.length) {
            if (this.source.startsWith(closing, this.index)) {
                this.advanceBy(closing.length);
                closed = true;
                break;
            }
            const char = this.source[this.index];
            if (char === '\n') {
                if (!triple)
                    break;
                value += char;
                this.advance();
                this.line++;
                this.column = 1;
                continue;
            }
            if (char === '\\' && prefix !== 'r') {
                const escapeStart = this.position();
                this.advance();
                const code = this.source[this.index];
                if (code === undefined)
                    break;
                if (code === '\n') {
                    this.advance();
                    this.line++;
                    this.column = 1;
                    continue;
                }
                if (code === 'u' || code === 'U') {
                    const length = code === 'u' ? 4 : 6;
                    const hex = this.source.slice(this.index + 1, this.index + 1 + length);
                    if (hex.length === length && /^[0-9a-fA-F]+$/.test(hex)) {
                        value += String.fromCodePoint(parseInt(hex, 16));
                        this.advanceBy(1 + length);
                    }
                    else {
                        this.error(`Escape \\${code} precisa de ${length} dígitos hexadecimais.`, escapeStart);
                        this.advance();
                    }
                    continue;
                }
                const simple = SIMPLE_ESCAPES[code];
                if (simple === undefined) {
                    this.error(`Escape inválido "\\${code}" na string.`, escapeStart);
                    value += code;
                }
                else
                    value += simple;
                this.advance();
                continue;
            }
            value += char;
            this.advance();
        }
        if (!closed)
            this.error(triple ? 'String de aspas triplas sem fechamento.' : 'String sem fechamento: faltou a aspa final nesta linha.', start);
        const kind = prefix === '&' ? 'string_name' : prefix === '^' ? 'node_path' : 'string';
        this.tokens.push({ kind, value, raw: prefix === 'r', ...this.span(start) });
    }
    private readNodeShortcut(): void {
        const start = this.position();
        this.advance();
        const quote = this.source[this.index];
        if (quote === '"' || quote === "'") {
            const before = this.tokens.length;
            this.readString(null);
            const token = this.tokens[before];
            if (token)
                this.tokens[before] = { ...token, kind: 'get_node', line: start.line, column: start.column };
            return;
        }
        const pathStart = this.index;
        while (this.index < this.source.length) {
            const char = this.source[this.index];
            if (isIdentifierPart(char) || char === '/' || (char === '%' && isIdentifierStart(this.source[this.index + 1] ?? ''))) {
                this.advance();
                continue;
            }
            break;
        }
        const path = this.source.slice(pathStart, this.index);
        if (path.length === 0)
            this.error('Depois de "$" vem o caminho do nó (por exemplo $Jogador/Arma).', start);
        this.tokens.push({ kind: 'get_node', value: path, ...this.span(start) });
    }
    private readUniqueNode(): void {
        const start = this.position();
        this.advance();
        const nameStart = this.index;
        while (this.index < this.source.length && (isIdentifierPart(this.source[this.index]) || this.source[this.index] === '/'))
            this.advance();
        this.tokens.push({ kind: 'unique_node', value: this.source.slice(nameStart, this.index), ...this.span(start) });
    }
    private previousAllowsUnique(): boolean {
        const last = this.tokens[this.tokens.length - 1];
        if (!last)
            return true;
        switch (last.kind) {
            case 'identifier':
            case 'int':
            case 'float':
            case 'string':
            case 'string_name':
            case 'node_path':
            case 'get_node':
            case 'unique_node':
                return false;
            case 'keyword':
                return last.value !== 'self' && last.value !== 'true' && last.value !== 'false' && last.value !== 'null';
            case 'operator':
                return !CLOSERS.has(last.value);
            default:
                return true;
        }
    }
    private readAnnotation(): void {
        const start = this.position();
        this.advance();
        const nameStart = this.index;
        while (this.index < this.source.length && isIdentifierPart(this.source[this.index]))
            this.advance();
        const name = this.source.slice(nameStart, this.index);
        if (name.length === 0)
            this.error('Depois de "@" vem o nome da anotação (por exemplo @export).', start);
        this.tokens.push({ kind: 'annotation', value: name, ...this.span(start) });
    }
    private readIdentifier(): void {
        const start = this.position();
        const begin = this.index;
        while (this.index < this.source.length && isIdentifierPart(this.source[this.index]))
            this.advance();
        const text = this.source.slice(begin, this.index);
        this.tokens.push({ kind: KEYWORDS.has(text) ? 'keyword' : 'identifier', value: text, ...this.span(start) });
    }
    private readOperator(): boolean {
        for (const operator of OPERATORS) {
            if (!this.source.startsWith(operator, this.index))
                continue;
            const start = this.position();
            if (OPENERS.has(operator))
                this.depth++;
            else if (CLOSERS.has(operator) && this.depth > 0) {
                this.depth--;
                this.closeSoftBlocks(start);
            }
            this.advanceBy(operator.length);
            this.tokens.push({ kind: 'operator', value: operator, ...this.span(start) });
            return true;
        }
        return false;
    }
    private peekPastSpaces(offset: number): string | undefined {
        let index = this.index + offset;
        while (this.source[index] === ' ' || this.source[index] === '\t' || this.source[index] === '\r')
            index++;
        return this.source[index];
    }
    private position(): Position {
        return { line: this.line, column: this.column };
    }
    private span(start: Position): SourceSpan {
        return { line: start.line, column: start.column, endLine: this.line, endColumn: this.column };
    }
    private advance(): void {
        this.index++;
        this.column++;
    }
    private advanceBy(count: number): void {
        this.index += count;
        this.column += count;
    }
    private pushLayout(kind: 'newline' | 'indent' | 'dedent', at: Position, depth = this.depth): void {
        this.tokens.push({ kind, value: '', depth, line: at.line, column: at.column, endLine: at.line, endColumn: at.column });
    }
    private pushNumber(kind: 'int' | 'float', text: string, value: number, start: Position): void {
        this.tokens.push({ kind, value: text, number: value, ...this.span(start) });
    }
    private error(message: string, at: Position): void {
        this.diagnostics.push({ message, line: at.line, column: at.column, endLine: this.line, endColumn: this.column });
    }
}
export function tokenize(source: string): LexResult {
    return new Lexer(source).tokenize();
}
