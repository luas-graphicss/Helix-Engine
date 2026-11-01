import { KEYWORDS, PUNCTUATION, type InterpolationPart, type SourceSpan, type Token, type TokenKind } from './tokens';
export interface LexDiagnostic {
    readonly message: string;
    readonly span: SourceSpan;
}
export interface LexResult {
    readonly tokens: Token[];
    readonly diagnostics: LexDiagnostic[];
}
export interface LexOrigin {
    readonly line: number;
    readonly column: number;
}
const IDENTIFIER_START = /[\p{L}_]/u;
const IDENTIFIER_PART = /[\p{L}\p{Nd}\p{Mn}\p{Mc}\p{Pc}]/u;
export function lex(source: string, origin: LexOrigin = { line: 1, column: 1 }): LexResult {
    return new Lexer(source, origin).run();
}
class Lexer {
    private index = 0;
    private line: number;
    private column: number;
    private readonly tokens: Token[] = [];
    private readonly diagnostics: LexDiagnostic[] = [];
    private lastEnd = -1;
    constructor(private readonly source: string, origin: LexOrigin) {
        this.line = origin.line;
        this.column = origin.column;
    }
    run(): LexResult {
        while (true) {
            this.skipTrivia();
            if (this.index >= this.source.length)
                break;
            const start = this.position();
            const startIndex = this.index;
            const char = this.source[this.index];
            const next = this.source[this.index + 1] ?? '';
            if (char === '@' && (next === '"' || (next === '$' && this.source[this.index + 2] === '"'))) {
                this.index += next === '"' ? 1 : 2;
                this.column += next === '"' ? 1 : 2;
                if (next === '"')
                    this.verbatimString(start, startIndex);
                else
                    this.interpolatedString(start, startIndex, true);
            }
            else if (char === '$' && next === '"') {
                this.index++;
                this.column++;
                this.interpolatedString(start, startIndex, false);
            }
            else if (char === '$' && next === '@' && this.source[this.index + 2] === '"') {
                this.index += 2;
                this.column += 2;
                this.interpolatedString(start, startIndex, true);
            }
            else if (char === '"') {
                if (next === '"' && this.source[this.index + 2] === '"')
                    this.rawString(start, startIndex);
                else
                    this.regularString(start, startIndex);
            }
            else if (char === "'") {
                this.charLiteral(start, startIndex);
            }
            else if (/[0-9]/.test(char) || (char === '.' && /[0-9]/.test(next))) {
                this.number(start, startIndex);
            }
            else if (char === '@' && IDENTIFIER_START.test(next)) {
                this.index++;
                this.column++;
                this.identifier(start, startIndex, true);
            }
            else if (IDENTIFIER_START.test(char)) {
                this.identifier(start, startIndex, false);
            }
            else {
                this.punctuation(start, startIndex);
            }
        }
        const end = this.position();
        this.tokens.push({ kind: 'eof', text: '', value: null, span: { line: end.line, column: end.column, endLine: end.line, endColumn: end.column }, adjacent: false });
        return { tokens: this.tokens, diagnostics: this.diagnostics };
    }
    private position(): {
        line: number;
        column: number;
    } {
        return { line: this.line, column: this.column };
    }
    private advance(count = 1): void {
        for (let step = 0; step < count && this.index < this.source.length; step++) {
            if (this.source[this.index] === '\n') {
                this.line++;
                this.column = 1;
            }
            else {
                this.column++;
            }
            this.index++;
        }
    }
    private push(kind: TokenKind, text: string, value: Token['value'], start: {
        line: number;
        column: number;
    }, startIndex: number, extra: Partial<Token> = {}): void {
        const span: SourceSpan = { line: start.line, column: start.column, endLine: this.line, endColumn: this.column };
        this.tokens.push({ kind, text, value, span, adjacent: this.lastEnd === startIndex, ...extra });
        this.lastEnd = this.index;
    }
    private error(message: string, start: {
        line: number;
        column: number;
    }): void {
        this.diagnostics.push({ message, span: { line: start.line, column: start.column, endLine: this.line, endColumn: this.column } });
    }
    private skipTrivia(): void {
        while (this.index < this.source.length) {
            const char = this.source[this.index];
            if (char === ' ' || char === '\t' || char === '\r' || char === '\n' || char === '\f' || char === '\v' || char === '\u00a0' || char === '\ufeff') {
                this.advance();
            }
            else if (char === '/' && this.source[this.index + 1] === '/') {
                while (this.index < this.source.length && this.source[this.index] !== '\n')
                    this.advance();
            }
            else if (char === '/' && this.source[this.index + 1] === '*') {
                const start = this.position();
                this.advance(2);
                while (this.index < this.source.length && !(this.source[this.index] === '*' && this.source[this.index + 1] === '/'))
                    this.advance();
                if (this.index >= this.source.length)
                    this.error('Comentário de bloco sem fechamento (*/).', start);
                else
                    this.advance(2);
            }
            else if (char === '#' && this.atLineStart()) {
                while (this.index < this.source.length && this.source[this.index] !== '\n')
                    this.advance();
            }
            else {
                break;
            }
        }
    }
    private atLineStart(): boolean {
        for (let back = this.index - 1; back >= 0; back--) {
            const char = this.source[back];
            if (char === '\n')
                return true;
            if (char !== ' ' && char !== '\t')
                return false;
        }
        return true;
    }
    private identifier(start: {
        line: number;
        column: number;
    }, startIndex: number, verbatim: boolean): void {
        const nameStart = this.index;
        while (this.index < this.source.length && IDENTIFIER_PART.test(this.source[this.index]))
            this.advance();
        const name = this.source.slice(nameStart, this.index);
        const text = this.source.slice(startIndex, this.index);
        if (!verbatim && KEYWORDS.has(name))
            this.push('keyword', name, null, start, startIndex);
        else
            this.push('identifier', text, name, start, startIndex);
    }
    private number(start: {
        line: number;
        column: number;
    }, startIndex: number): void {
        const source = this.source;
        let integer = true;
        if (source[this.index] === '0' && /[xX]/.test(source[this.index + 1] ?? '')) {
            this.advance(2);
            const digitsStart = this.index;
            while (/[0-9a-fA-F_]/.test(source[this.index] ?? ''))
                this.advance();
            const digits = source.slice(digitsStart, this.index).replace(/_/g, '');
            this.integerSuffix();
            const value = digits.length > 0 ? Number.parseInt(digits, 16) : Number.NaN;
            if (Number.isNaN(value))
                this.error('Literal hexadecimal inválido.', start);
            this.push('number', source.slice(startIndex, this.index), value, start, startIndex, { integer: true });
            return;
        }
        if (source[this.index] === '0' && /[bB]/.test(source[this.index + 1] ?? '')) {
            this.advance(2);
            const digitsStart = this.index;
            while (/[01_]/.test(source[this.index] ?? ''))
                this.advance();
            const digits = source.slice(digitsStart, this.index).replace(/_/g, '');
            this.integerSuffix();
            const value = digits.length > 0 ? Number.parseInt(digits, 2) : Number.NaN;
            if (Number.isNaN(value))
                this.error('Literal binário inválido.', start);
            this.push('number', source.slice(startIndex, this.index), value, start, startIndex, { integer: true });
            return;
        }
        while (/[0-9_]/.test(source[this.index] ?? ''))
            this.advance();
        if (source[this.index] === '.' && /[0-9]/.test(source[this.index + 1] ?? '')) {
            integer = false;
            this.advance();
            while (/[0-9_]/.test(source[this.index] ?? ''))
                this.advance();
        }
        if (/[eE]/.test(source[this.index] ?? '') && /[0-9+-]/.test(source[this.index + 1] ?? '')) {
            integer = false;
            this.advance();
            if (/[+-]/.test(source[this.index] ?? ''))
                this.advance();
            while (/[0-9_]/.test(source[this.index] ?? ''))
                this.advance();
        }
        const bodyEnd = this.index;
        const suffix = source[this.index] ?? '';
        if (/[fFdDmM]/.test(suffix)) {
            integer = false;
            this.advance();
        }
        else {
            this.integerSuffix();
        }
        const body = source.slice(startIndex, bodyEnd).replace(/_/g, '');
        const value = Number(body);
        if (!Number.isFinite(value))
            this.error('Literal numérico inválido.', start);
        this.push('number', source.slice(startIndex, this.index), value, start, startIndex, { integer });
    }
    private integerSuffix(): void {
        const first = this.source[this.index] ?? '';
        const second = this.source[this.index + 1] ?? '';
        if (/[uU]/.test(first) && /[lL]/.test(second))
            this.advance(2);
        else if (/[lL]/.test(first) && /[uU]/.test(second))
            this.advance(2);
        else if (/[uUlL]/.test(first))
            this.advance();
    }
    private charLiteral(start: {
        line: number;
        column: number;
    }, startIndex: number): void {
        this.advance();
        let value = '';
        if (this.source[this.index] === '\\')
            value = this.escape(start);
        else if (this.index < this.source.length && this.source[this.index] !== "'" && this.source[this.index] !== '\n') {
            value = this.source[this.index];
            this.advance();
        }
        if (this.source[this.index] === "'")
            this.advance();
        else
            this.error("Literal de char sem fechamento ('). Para texto use aspas duplas.", start);
        if (value.length === 0)
            this.error('Literal de char vazio.', start);
        this.push('char', this.source.slice(startIndex, this.index), value, start, startIndex);
    }
}
