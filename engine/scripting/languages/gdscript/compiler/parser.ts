import type { Annotation, AssignmentOperator, BinaryOperator, Block, ClassDeclaration, ClassMember, ConstantMember, DictionaryEntry, DictionaryPatternEntry, EnumMember, Expression, FunctionMember, MatchBranch, Parameter, Pattern, PropertyAccessors, ScriptFile, SignalMember, Statement, TypeRef, VariableMember, } from './ast';
import { Lexer } from './lexer';
import { CLOSERS, describeToken, type SourceSpan, type Token } from './tokens';
export interface ParseDiagnostic extends SourceSpan {
    readonly message: string;
}
export interface ParseResult {
    readonly file: ScriptFile;
    readonly diagnostics: ParseDiagnostic[];
}
class ParseError extends Error {
    constructor(message: string, readonly span: SourceSpan) {
        super(message);
    }
}
const ASSIGNMENT_OPERATORS: ReadonlySet<string> = new Set(['=', '+=', '-=', '*=', '/=', '%=', '**=', '&=', '|=', '^=', '<<=', '>>=']);
const COMPARISON_OPERATORS: ReadonlySet<string> = new Set(['==', '!=', '<', '>', '<=', '>=']);
const SCRIPT_ANNOTATIONS: ReadonlySet<string> = new Set(['tool', 'icon', 'static_unload']);
const MEMBER_ANNOTATIONS: ReadonlySet<string> = new Set([
    'export',
    'export_range',
    'export_enum',
    'export_file',
    'export_dir',
    'export_global_file',
    'export_global_dir',
    'export_multiline',
    'export_placeholder',
    'export_flags',
    'export_flags_2d_physics',
    'export_flags_2d_render',
    'export_flags_2d_navigation',
    'export_flags_3d_physics',
    'export_flags_3d_render',
    'export_flags_3d_navigation',
    'export_flags_avoidance',
    'export_color_no_alpha',
    'export_node_path',
    'export_exp_easing',
    'export_group',
    'export_subgroup',
    'export_category',
    'export_custom',
    'export_storage',
    'export_tool_button',
    'onready',
    'warning_ignore',
    'warning_ignore_start',
    'warning_ignore_restore',
    'rpc',
    'abstract',
]);
function span(start: SourceSpan, end: SourceSpan): SourceSpan {
    return { line: start.line, column: start.column, endLine: end.endLine, endColumn: end.endColumn };
}
export class Parser {
    private readonly tokens: Token[];
    private index = 0;
    private readonly significant: number[] = [0];
    private readonly diagnostics: ParseDiagnostic[] = [];
    private previous: Token | null = null;
    private readonly previousDepth = (): number => this.significant[this.significant.length - 1];
    constructor(source: string) {
        const lexed = new Lexer(source).tokenize();
        this.tokens = lexed.tokens;
        for (const diagnostic of lexed.diagnostics)
            this.diagnostics.push(diagnostic);
    }
    parse(): ParseResult {
        const file = this.parseScript();
        return { file, diagnostics: this.diagnostics };
    }
    private isSignificant(token: Token): boolean {
        if (token.kind !== 'newline' && token.kind !== 'indent' && token.kind !== 'dedent')
            return true;
        return (token.depth ?? 0) === this.previousDepth();
    }
    private peek(offset = 0): Token {
        let index = this.index;
        let remaining = offset;
        for (;;) {
            const token = this.tokens[index];
            if (!token)
                return this.tokens[this.tokens.length - 1];
            if (!this.isSignificant(token)) {
                index++;
                continue;
            }
            if (remaining === 0)
                return token;
            remaining--;
            index++;
        }
    }
    private peekRaw(): Token {
        return this.tokens[this.index] ?? this.tokens[this.tokens.length - 1];
    }
    private next(): Token {
        const token = this.peek();
        while (this.tokens[this.index] !== token && this.index < this.tokens.length)
            this.index++;
        if (this.index < this.tokens.length - 1)
            this.index++;
        this.previous = token;
        return token;
    }
    private endedWithBlock(): boolean {
        return this.previous?.kind === 'dedent';
    }
    private check(kind: Token['kind'], value?: string, offset = 0): boolean {
        const token = this.peek(offset);
        return token.kind === kind && (value === undefined || token.value === value);
    }
    private checkOperator(value: string, offset = 0): boolean {
        return this.check('operator', value, offset);
    }
    private checkKeyword(value: string, offset = 0): boolean {
        return this.check('keyword', value, offset);
    }
    private match(kind: Token['kind'], value?: string): Token | null {
        return this.check(kind, value) ? this.next() : null;
    }
    private matchOperator(value: string): Token | null {
        return this.match('operator', value);
    }
    private matchKeyword(value: string): Token | null {
        return this.match('keyword', value);
    }
    private expect(kind: Token['kind'], value: string | undefined, what: string): Token {
        const token = this.peek();
        if (token.kind === kind && (value === undefined || token.value === value))
            return this.next();
        throw this.failure(`Esperava ${what}, mas encontrou ${describeToken(token)}.`, token);
    }
    private expectOperator(value: string, what = `"${value}"`): Token {
        return this.expect('operator', value, what);
    }
    private expectIdentifier(what: string): Token {
        const token = this.peek();
        if (token.kind === 'identifier')
            return this.next();
        if (token.kind === 'keyword')
            throw this.failure(`"${token.value}" é uma palavra reservada e não pode ser ${what}.`, token);
        throw this.failure(`Esperava ${what}, mas encontrou ${describeToken(token)}.`, token);
    }
    private failure(message: string, at: SourceSpan): ParseError {
        return new ParseError(message, { line: at.line, column: at.column, endLine: at.endLine, endColumn: at.endColumn });
    }
    private report(error: unknown): void {
        if (error instanceof ParseError) {
            this.diagnostics.push({ message: error.message, ...error.span });
            return;
        }
        throw error;
    }
    private synchronize(): void {
        for (;;) {
            const token = this.peek();
            if (token.kind === 'eof' || token.kind === 'dedent')
                return;
            this.next();
            if (token.kind === 'newline') {
                if (this.check('indent'))
                    this.skipBlock();
                return;
            }
        }
    }
    private skipBlock(): void {
        this.expect('indent', undefined, 'um bloco');
        let depth = 1;
        while (depth > 0) {
            const token = this.next();
            if (token.kind === 'eof')
                return;
            if (token.kind === 'indent')
                depth++;
            else if (token.kind === 'dedent')
                depth--;
        }
    }
    private skipNewlines(): void {
        while (this.check('newline'))
            this.next();
    }
    private endStatement(): void {
        if (this.matchOperator(';')) {
            this.skipNewlines();
            return;
        }
        if (this.check('newline')) {
            this.next();
            return;
        }
        if (this.check('eof') || this.check('dedent') || this.endedWithBlock())
            return;
        throw this.failure(`Fim de instrução esperado, mas encontrou ${describeToken(this.peek())}.`, this.peek());
    }
}
