import type { Accessor, Argument, AssignmentOperator, BinaryOperator, Block, CatchClause, ClassDeclaration, ClassFlavor, CompilationUnit, ConstructorMember, Declarator, EnumDeclaration, EnumMember, Expression, Initializer, InterpolatedPart, LambdaExpression, LocalDeclaration, Member, MethodMember, ObjectInitializerEntry, Parameter, ParameterModifier, Pattern, PropertyMember, Statement, SwitchArm, SwitchLabel, SwitchSection, TypeDeclaration, TypeRef, } from './ast';
import { lex, type LexOrigin } from './lexer';
import { MODIFIERS, PRIMITIVE_TYPE_KEYWORDS, spanBetween, type InterpolationPart, type SourceSpan, type Token } from './tokens';
export interface ParseDiagnostic {
    readonly message: string;
    readonly span: SourceSpan;
}
export interface ParseResult {
    readonly unit: CompilationUnit;
    readonly diagnostics: readonly ParseDiagnostic[];
}
class ParseError extends Error {
    constructor(message: string, readonly span: SourceSpan) {
        super(message);
    }
}
const MAX_DIAGNOSTICS = 12;
const AFTER_TYPE_ARGUMENTS: ReadonlySet<string> = new Set(['(', ')', ']', '}', ':', ';', ',', '.', '?', '==', '!=', '|', '^', '&&', '||', '&', '[']);
const CAST_FOLLOWERS: ReadonlySet<string> = new Set(['(', '!', '~', 'new', 'this', 'base', 'typeof', 'default', 'nameof', 'sizeof', 'checked', 'unchecked', 'true', 'false', 'null', 'await', 'delegate']);
const ASSIGNMENT_OPERATORS: ReadonlySet<string> = new Set(['=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '??=']);
export function parse(source: string): ParseResult {
    const lexed = lex(source);
    const parser = new Parser(lexed.tokens, source);
    const unit = parser.compilationUnit();
    const diagnostics: ParseDiagnostic[] = [...lexed.diagnostics, ...parser.diagnostics];
    return { unit, diagnostics: diagnostics.slice(0, MAX_DIAGNOSTICS) };
}
function parseEmbeddedExpression(source: string, origin: LexOrigin, diagnostics: ParseDiagnostic[]): Expression {
    const lexed = lex(source, origin);
    diagnostics.push(...lexed.diagnostics);
    const parser = new Parser(lexed.tokens, source);
    let expression: Expression;
    try {
        expression = parser.expression();
        if (parser.current.kind !== 'eof')
            parser.fail(`Interpolação com sobra depois da expressão: "${parser.current.text}".`);
    }
    catch (error) {
        if (!(error instanceof ParseError))
            throw error;
        parser.diagnostics.push({ message: error.message, span: error.span });
        expression = { kind: 'literal', value: null, literalType: 'null', span: error.span };
    }
    diagnostics.push(...parser.diagnostics);
    return expression;
}
class Parser {
    private index = 0;
    readonly diagnostics: ParseDiagnostic[] = [];
    private className: string | null = null;
    constructor(private readonly tokens: Token[], private readonly source: string) { }
    get current(): Token {
        return this.tokens[this.index];
    }
    private atEnd(): boolean {
        return this.tokens[this.index].kind === 'eof';
    }
    private peek(offset = 1): Token {
        return this.tokens[Math.min(this.index + offset, this.tokens.length - 1)];
    }
    private previous(): Token {
        return this.tokens[Math.max(0, this.index - 1)];
    }
    private at(text: string, token: Token = this.current): boolean {
        return (token.kind === 'punct' || token.kind === 'keyword') && token.text === text;
    }
    private atIdentifier(text?: string, token: Token = this.current): boolean {
        return token.kind === 'identifier' && (text === undefined || token.value === text);
    }
    private advance(): Token {
        const token = this.current;
        if (this.index < this.tokens.length - 1)
            this.index++;
        return token;
    }
    private match(text: string): boolean {
        if (this.at(text)) {
            this.advance();
            return true;
        }
        return false;
    }
    private matchIdentifier(text: string): boolean {
        if (this.atIdentifier(text)) {
            this.advance();
            return true;
        }
        return false;
    }
    private expect(text: string, context?: string): Token {
        if (this.at(text))
            return this.advance();
        this.fail(`Esperado "${text}"${context ? ` ${context}` : ''}, encontrado ${this.describe(this.current)}.`);
    }
    private expectIdentifier(context: string): Token {
        if (this.current.kind === 'identifier')
            return this.advance();
        this.fail(`Esperado um nome ${context}, encontrado ${this.describe(this.current)}.`);
    }
    private describe(token: Token): string {
        if (token.kind === 'eof')
            return 'o fim do arquivo';
        if (token.kind === 'string' || token.kind === 'interpolated')
            return 'uma string';
        if (token.kind === 'number')
            return `o número ${token.text}`;
        return `"${token.text}"`;
    }
    fail(message: string, span: SourceSpan = this.current.span): never {
        throw new ParseError(message, span);
    }
    private report(message: string, span: SourceSpan): void {
        this.diagnostics.push({ message, span });
    }
    private mark(): number {
        return this.index;
    }
    private reset(mark: number): void {
        this.index = mark;
    }
    private attempt<T>(produce: () => T): T | null {
        const mark = this.mark();
        const diagnostics = this.diagnostics.length;
        try {
            return produce();
        }
        catch (error) {
            if (!(error instanceof ParseError))
                throw error;
            this.reset(mark);
            this.diagnostics.length = diagnostics;
            return null;
        }
    }
    private spanFrom(start: Token): SourceSpan {
        return spanBetween(start.span, this.previous().span);
    }
    private recover(): void {
        let depth = 0;
        while (!this.atEnd()) {
            if (this.at('{') || this.at('(') || this.at('['))
                depth++;
            else if (this.at('}') || this.at(')') || this.at(']')) {
                if (depth === 0)
                    return;
                depth--;
            }
            else if (this.at(';') && depth === 0) {
                this.advance();
                return;
            }
            this.advance();
        }
    }
    private skipAttributes(): void {
        while (this.at('[') && this.looksLikeAttribute()) {
            let depth = 0;
            do {
                if (this.at('['))
                    depth++;
                else if (this.at(']'))
                    depth--;
                this.advance();
            } while (depth > 0 && !this.atEnd());
        }
    }
    private looksLikeAttribute(): boolean {
        const next = this.peek();
        if (next.kind !== 'identifier')
            return false;
        const after = this.peek(2);
        return this.at(']', after) || this.at('(', after) || this.at(':', after) || this.at('.', after) || this.at(',', after);
    }
    private modifiers(): string[] {
        const modifiers: string[] = [];
        while (true) {
            const token = this.current;
            const text = token.kind === 'keyword' ? token.text : token.kind === 'identifier' ? String(token.value) : '';
            if (!MODIFIERS.has(text))
                break;
            if (token.kind === 'identifier') {
                const next = this.peek();
                const nextIsDeclarationStart = next.kind === 'keyword' || next.kind === 'identifier' || this.at('(', next) || this.at('[', next);
                if (!nextIsDeclarationStart || this.at('=>', next) || this.at('=', next))
                    break;
                if (text === 'async' && (this.at('(', next) || (next.kind === 'identifier' && this.at('=>', this.peek(2)))))
                    break;
            }
            modifiers.push(text);
            this.advance();
        }
        return modifiers;
    }
    compilationUnit(): CompilationUnit {
        const types: TypeDeclaration[] = [];
        const usings: string[] = [];
        while (!this.atEnd()) {
            try {
                if (this.at('using')) {
                    usings.push(this.usingDirective());
                    continue;
                }
                if (this.at('namespace')) {
                    this.advance();
                    this.qualifiedName('do namespace');
                    if (this.match(';'))
                        continue;
                    this.expect('{', 'depois do nome do namespace');
                    while (!this.at('}') && !this.atEnd()) {
                        if (this.at('using')) {
                            usings.push(this.usingDirective());
                            continue;
                        }
                        types.push(this.typeDeclaration());
                    }
                    this.expect('}');
                    continue;
                }
                if (this.match(';'))
                    continue;
                types.push(this.typeDeclaration());
            }
            catch (error) {
                if (!(error instanceof ParseError))
                    throw error;
                this.report(error.message, error.span);
                if (this.diagnostics.length >= MAX_DIAGNOSTICS)
                    break;
                this.recover();
            }
        }
        return { types, usings };
    }
    private usingDirective(): string {
        this.expect('using');
        this.matchIdentifier('static');
        if (this.atIdentifier('global'))
            this.advance();
        let name = this.qualifiedName('do using');
        if (this.match('='))
            name = this.qualifiedName('do using');
        this.skipTypeArgumentsIfAny();
        this.expect(';', 'depois do using');
        return name;
    }
    private skipTypeArgumentsIfAny(): void {
        if (this.at('<'))
            this.attempt(() => this.typeArguments());
    }
    private qualifiedName(context: string): string {
        const parts = [String(this.expectIdentifier(context).value)];
        while (this.at('.') && this.peek().kind === 'identifier') {
            this.advance();
            parts.push(String(this.advance().value));
        }
        return parts.join('.');
    }
    private typeDeclaration(): TypeDeclaration {
        this.skipAttributes();
        const start = this.current;
        const modifiers = this.modifiers();
        if (this.at('class') || this.at('struct') || this.atIdentifier('record'))
            return this.classDeclaration(start, modifiers);
        if (this.at('enum'))
            return this.enumDeclaration(start, modifiers);
        if (this.at('interface'))
            return this.interfaceDeclaration(start);
        if (this.at('delegate'))
            return this.delegateDeclaration(start);
        if (this.current.kind === 'identifier' || this.current.kind === 'keyword') {
            this.fail('Instruções e membros soltos não são aceitos no nível do arquivo: coloque o código dentro de uma classe (public class Nome : ActorScript { … }).');
        }
        this.fail(`Esperada a declaração de um tipo (class, struct, record, enum), encontrado ${this.describe(this.current)}.`);
    }
}
