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
    private classDeclaration(start: Token, modifiers: readonly string[]): ClassDeclaration {
        let flavor: ClassFlavor;
        if (this.matchIdentifier('record')) {
            flavor = 'record';
            if (this.at('class') || this.at('struct'))
                this.advance();
        }
        else {
            flavor = this.advance().text === 'struct' ? 'struct' : 'class';
        }
        const nameToken = this.expectIdentifier(`do ${flavor}`);
        const name = String(nameToken.value);
        const typeParameters = this.typeParametersIfAny();
        let recordParameters: Parameter[] | null = null;
        if (this.at('('))
            recordParameters = this.parameterList();
        const bases: TypeRef[] = [];
        if (this.match(':')) {
            do
                bases.push(this.type());
            while (this.match(','));
        }
        this.skipConstraints();
        const members: Member[] = [];
        if (this.match(';')) {
            if (!recordParameters)
                this.fail('Esperado "{" com os membros do tipo.', this.previous().span);
        }
        else {
            this.expect('{', `depois do nome de ${name}`);
            const outerClass = this.className;
            this.className = name;
            while (!this.at('}') && !this.atEnd()) {
                try {
                    const member = this.member();
                    if (member)
                        members.push(member);
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
            this.className = outerClass;
            this.expect('}', `fechando ${name}`);
        }
        return { kind: 'class', flavor, name, nameSpan: nameToken.span, modifiers, typeParameters, bases, recordParameters, members, span: this.spanFrom(start) };
    }
    private typeParametersIfAny(): string[] {
        const names: string[] = [];
        if (!this.at('<'))
            return names;
        this.advance();
        do {
            this.skipAttributes();
            if (this.atIdentifier('in') || this.atIdentifier('out') || this.at('in') || this.at('out'))
                this.advance();
            names.push(String(this.expectIdentifier('do parâmetro de tipo').value));
        } while (this.match(','));
        this.expect('>', 'fechando os parâmetros de tipo');
        return names;
    }
    private skipConstraints(): void {
        while (this.atIdentifier('where')) {
            while (!this.at('{') && !this.at('=>') && !this.at(';') && !this.atIdentifier('where') && !this.atEnd())
                this.advance();
        }
    }
    private enumDeclaration(start: Token, modifiers: readonly string[]): EnumDeclaration {
        this.expect('enum');
        const nameToken = this.expectIdentifier('do enum');
        if (this.match(':'))
            this.type();
        this.expect('{', 'depois do nome do enum');
        const members: EnumMember[] = [];
        while (!this.at('}') && !this.atEnd()) {
            this.skipAttributes();
            const memberToken = this.expectIdentifier('do membro do enum');
            const value = this.match('=') ? this.expression() : null;
            members.push({ name: String(memberToken.value), value, span: this.spanFrom(memberToken) });
            if (!this.match(','))
                break;
        }
        this.expect('}', 'fechando o enum');
        this.match(';');
        return { kind: 'enum', name: String(nameToken.value), nameSpan: nameToken.span, modifiers, members, span: this.spanFrom(start) };
    }
    private interfaceDeclaration(start: Token): TypeDeclaration {
        this.expect('interface');
        const nameToken = this.expectIdentifier('da interface');
        this.typeParametersIfAny();
        if (this.match(':')) {
            do
                this.type();
            while (this.match(','));
        }
        this.skipConstraints();
        this.expect('{');
        this.skipBalanced('{', '}');
        return { kind: 'interface', name: String(nameToken.value), span: this.spanFrom(start) };
    }
    private delegateDeclaration(start: Token): TypeDeclaration {
        this.expect('delegate');
        this.type();
        const nameToken = this.expectIdentifier('do delegate');
        this.typeParametersIfAny();
        this.parameterList();
        this.skipConstraints();
        this.expect(';', 'depois do delegate');
        return { kind: 'delegate', name: String(nameToken.value), span: this.spanFrom(start) };
    }
    private skipBalanced(open: string, close: string): void {
        let depth = 1;
        while (depth > 0 && !this.atEnd()) {
            if (this.at(open))
                depth++;
            else if (this.at(close))
                depth--;
            this.advance();
        }
    }
    private member(): Member | null {
        this.skipAttributes();
        if (this.match(';'))
            return null;
        const start = this.current;
        const modifiers = this.modifiers();
        if (this.at('class') || this.at('struct') || (this.atIdentifier('record') && (this.peek().kind === 'identifier' || this.at('class', this.peek()) || this.at('struct', this.peek())))) {
            return this.classDeclaration(start, modifiers);
        }
        if (this.at('enum'))
            return this.enumDeclaration(start, modifiers);
        if (this.at('interface'))
            return this.interfaceDeclaration(start);
        if (this.at('delegate') && !this.at('(', this.peek()) && !this.at('{', this.peek()))
            return this.delegateDeclaration(start);
        if (this.at('event'))
            return this.eventMember(start, modifiers);
        if (this.at('~'))
            this.fail('Finalizadores (~Nome) não existem neste runtime: libere recursos em OnDestroy.');
        if (this.atIdentifier(this.className ?? '') && this.at('(', this.peek()))
            return this.constructorMember(start, modifiers);
        if (this.at('implicit') || this.at('explicit'))
            this.fail('Conversões implícitas/explícitas definidas pelo usuário não são suportadas.');
        const type = this.type();
        if (this.at('operator'))
            this.fail('Sobrecarga de operadores não é suportada; use um método com nome (Somar, Igual…).');
        if (this.at('this'))
            return this.indexerMember(start, modifiers, type);
        const nameToken = this.expectIdentifier('do membro');
        while (this.at('.')) {
            this.advance();
            this.expectIdentifier('do membro');
        }
        const name = String(this.previous().value);
        const nameSpan = this.previous().span;
        if (this.at('(') || this.at('<'))
            return this.methodMember(start, modifiers, type, name, nameSpan);
        if (this.at('{') || this.at('=>'))
            return this.propertyMember(start, modifiers, type, name, nameSpan);
        return this.fieldMember(start, modifiers, type, nameToken);
    }
    private eventMember(start: Token, modifiers: readonly string[]): Member {
        this.expect('event');
        const type = this.type();
        const declarators = this.declarators('do evento');
        if (this.at('{')) {
            this.advance();
            this.skipBalanced('{', '}');
        }
        else {
            this.expect(';', 'depois do evento');
        }
        return { kind: 'event', modifiers, type, declarators, span: this.spanFrom(start) };
    }
    private constructorMember(start: Token, modifiers: readonly string[]): ConstructorMember {
        this.advance();
        const parameters = this.parameterList();
        let initializer: ConstructorMember['initializer'] = null;
        if (this.match(':')) {
            const keyword = this.current;
            if (!this.at('base') && !this.at('this'))
                this.fail('Esperado base(…) ou this(…) depois de ":" no construtor.');
            this.advance();
            const args = this.argumentList();
            initializer = { kind: keyword.text as 'base' | 'this', arguments: args, span: this.spanFrom(keyword) };
        }
        const { body, expressionBody } = this.bodyOrExpression('do construtor');
        return { kind: 'constructor', modifiers, parameters, initializer, body, expressionBody, span: this.spanFrom(start) };
    }
    private methodMember(start: Token, modifiers: readonly string[], returnType: TypeRef, name: string, nameSpan: SourceSpan): MethodMember {
        const typeParameters = this.typeParametersIfAny();
        const parameters = this.parameterList();
        this.skipConstraints();
        const { body, expressionBody } = this.bodyOrExpression(`do método ${name}`);
        return { kind: 'method', modifiers, returnType, name, nameSpan, typeParameters, parameters, body, expressionBody, span: this.spanFrom(start) };
    }
    private bodyOrExpression(context: string): {
        body: Block | null;
        expressionBody: Expression | null;
    } {
        if (this.at('{'))
            return { body: this.block(), expressionBody: null };
        if (this.match('=>')) {
            const expressionBody = this.expression();
            this.expect(';', `depois do corpo ${context}`);
            return { body: null, expressionBody };
        }
        if (this.match(';'))
            return { body: null, expressionBody: null };
        this.fail(`Esperado "{", "=>" ou ";" ${context}, encontrado ${this.describe(this.current)}.`);
    }
    private propertyMember(start: Token, modifiers: readonly string[], type: TypeRef, name: string, nameSpan: SourceSpan): PropertyMember {
        if (this.match('=>')) {
            const expressionBody = this.expression();
            this.expect(';', 'depois da propriedade');
            return { kind: 'property', modifiers, type, name, nameSpan, getter: null, setter: null, expressionBody, initializer: null, span: this.spanFrom(start) };
        }
        const { getter, setter } = this.accessors();
        const initializer = this.match('=') ? this.expression() : null;
        if (initializer)
            this.expect(';', 'depois do valor inicial da propriedade');
        else
            this.match(';');
        return { kind: 'property', modifiers, type, name, nameSpan, getter, setter, expressionBody: null, initializer, span: this.spanFrom(start) };
    }
    private accessors(): {
        getter: Accessor | null;
        setter: Accessor | null;
    } {
        this.expect('{', 'abrindo os acessores');
        let getter: Accessor | null = null;
        let setter: Accessor | null = null;
        while (!this.at('}') && !this.atEnd()) {
            this.skipAttributes();
            const start = this.current;
            this.modifiers();
            const kindToken = this.current;
            const kind = kindToken.kind === 'identifier' ? String(kindToken.value) : '';
            if (kind !== 'get' && kind !== 'set' && kind !== 'init')
                this.fail(`Esperado get, set ou init, encontrado ${this.describe(kindToken)}.`);
            this.advance();
            let body: Block | null = null;
            let expressionBody: Expression | null = null;
            if (this.at('{'))
                body = this.block();
            else if (this.match('=>')) {
                expressionBody = this.expression();
                this.expect(';', 'depois do acessor');
            }
            else
                this.expect(';', 'depois do acessor');
            const accessor: Accessor = { kind: kind as Accessor['kind'], body, expressionBody, span: this.spanFrom(start) };
            if (kind === 'get')
                getter = accessor;
            else
                setter = accessor;
        }
        this.expect('}', 'fechando os acessores');
        return { getter, setter };
    }
    private indexerMember(start: Token, modifiers: readonly string[], type: TypeRef): Member {
        this.expect('this');
        this.expect('[', 'depois de this no indexador');
        const parameters: Parameter[] = [];
        if (!this.at(']')) {
            do
                parameters.push(this.parameter());
            while (this.match(','));
        }
        this.expect(']', 'fechando os parâmetros do indexador');
        if (this.match('=>')) {
            const expressionBody = this.expression();
            this.expect(';');
            return { kind: 'indexer', modifiers, type, parameters, getter: null, setter: null, expressionBody, span: this.spanFrom(start) };
        }
        const { getter, setter } = this.accessors();
        return { kind: 'indexer', modifiers, type, parameters, getter, setter, expressionBody: null, span: this.spanFrom(start) };
    }
    private fieldMember(start: Token, modifiers: readonly string[], type: TypeRef, nameToken: Token): Member {
        const declarators: Declarator[] = [this.declaratorFrom(nameToken)];
        while (this.match(','))
            declarators.push(this.declarator('do campo'));
        this.expect(';', 'depois do campo');
        return { kind: 'field', modifiers, type, declarators, span: this.spanFrom(start) };
    }
    private declarators(context: string): Declarator[] {
        const declarators: Declarator[] = [this.declarator(context)];
        while (this.match(','))
            declarators.push(this.declarator(context));
        return declarators;
    }
    private declarator(context: string): Declarator {
        return this.declaratorFrom(this.expectIdentifier(context));
    }
    private declaratorFrom(nameToken: Token): Declarator {
        const initializer = this.match('=') ? this.variableInitializer() : null;
        return { name: String(nameToken.value), initializer, span: spanBetween(nameToken.span, this.previous().span) };
    }
    private variableInitializer(): Expression {
        if (this.at('{')) {
            const start = this.current;
            const elements = this.collectionElements();
            return { kind: 'array', elementType: null, sizes: [], elements: elements.map((element) => (Array.isArray(element) ? this.fail('Inicializador de array não aceita pares { a, b }.', start.span) : (element as Expression))), span: this.spanFrom(start) };
        }
        return this.expression();
    }
    private parameterList(): Parameter[] {
        this.expect('(', 'abrindo os parâmetros');
        const parameters: Parameter[] = [];
        if (!this.at(')')) {
            do
                parameters.push(this.parameter());
            while (this.match(','));
        }
        this.expect(')', 'fechando os parâmetros');
        return parameters;
    }
    private parameter(): Parameter {
        this.skipAttributes();
        const start = this.current;
        let modifier: ParameterModifier = 'none';
        if (this.at('ref') || this.at('out') || this.at('in') || this.at('params'))
            modifier = this.advance().text as ParameterModifier;
        else if (this.atIdentifier('scoped'))
            this.advance();
        if (this.at('this'))
            this.advance();
        const type = this.type();
        const nameToken = this.expectIdentifier('do parâmetro');
        const defaultValue = this.match('=') ? this.expression() : null;
        return { name: String(nameToken.value), type, modifier, defaultValue, span: this.spanFrom(start) };
    }
    private argumentList(): Argument[] {
        this.expect('(', 'abrindo os argumentos');
        const args = this.argumentsUntil(')');
        this.expect(')', 'fechando os argumentos');
        return args;
    }
    private argumentsUntil(close: string): Argument[] {
        const args: Argument[] = [];
        if (this.at(close))
            return args;
        do
            args.push(this.argument());
        while (this.match(','));
        return args;
    }
    private argument(): Argument {
        const start = this.current;
        let name: string | null = null;
        if (this.current.kind === 'identifier' && this.at(':', this.peek()) && !this.at(':', this.peek(2))) {
            name = String(this.advance().value);
            this.advance();
        }
        let modifier: Argument['modifier'] = 'none';
        if (this.at('ref') || this.at('out') || this.at('in'))
            modifier = this.advance().text as Argument['modifier'];
        if (modifier === 'out') {
            const declaration = this.attempt(() => {
                const type = this.atIdentifier('var') ? (this.advance(), null) : this.type();
                const variable = this.expectIdentifier('da variável out');
                if (!this.at(',') && !this.at(')') && !this.at(']'))
                    this.fail('Esperado o fim do argumento out.');
                return { type, name: String(variable.value), span: variable.span };
            });
            if (declaration) {
                const expression: Expression = { kind: 'identifier', name: declaration.name, typeArguments: null, span: declaration.span };
                return { name, modifier, expression, declaration: { type: declaration.type, name: declaration.name }, span: this.spanFrom(start) };
            }
        }
        const expression = this.expression();
        return { name, modifier, expression, declaration: null, span: this.spanFrom(start) };
    }
    type(allowNullable = true): TypeRef {
        const start = this.current;
        let name: string;
        let typeArguments: TypeRef[] = [];
        let tupleElements: TypeRef[] | null = null;
        if (this.at('(')) {
            this.advance();
            tupleElements = [];
            do {
                tupleElements.push(this.type());
                if (this.current.kind === 'identifier' && !this.at(',', this.peek()) && !this.at(')', this.peek()))
                    this.fail('Esperado "," ou ")" no tipo tupla.');
                if (this.current.kind === 'identifier')
                    this.advance();
            } while (this.match(','));
            this.expect(')', 'fechando o tipo tupla');
            if (tupleElements.length < 2)
                this.fail('Um tipo tupla precisa de ao menos dois elementos.', start.span);
            name = '';
        }
        else if (this.current.kind === 'keyword' && PRIMITIVE_TYPE_KEYWORDS.has(this.current.text)) {
            name = this.advance().text;
        }
        else if (this.current.kind === 'identifier') {
            if (this.atIdentifier('global') && this.at('::', this.peek())) {
                this.advance();
                this.advance();
            }
            name = String(this.advance().value);
            if (this.at('<'))
                typeArguments = this.typeArguments();
            while (this.at('.') && this.peek().kind === 'identifier') {
                this.advance();
                name = String(this.advance().value);
                typeArguments = this.at('<') ? this.typeArguments() : [];
            }
        }
        else {
            this.fail(`Esperado um tipo, encontrado ${this.describe(this.current)}.`);
        }
        let nullable = false;
        if (allowNullable && this.at('?') && this.nullableFollows()) {
            this.advance();
            nullable = true;
        }
        let arrayRank = 0;
        while (this.at('[') && (this.at(']', this.peek()) || this.at(',', this.peek()))) {
            this.advance();
            let rank = 1;
            while (this.match(','))
                rank++;
            this.expect(']', 'fechando o tipo array');
            arrayRank = Math.max(arrayRank, rank);
            if (allowNullable && this.at('?')) {
                this.advance();
                nullable = true;
            }
        }
        return { name, typeArguments, arrayRank, nullable, tupleElements, span: this.spanFrom(start) };
    }
    private nullableFollows(): boolean {
        const next = this.peek();
        return next.kind === 'identifier' || this.at(')', next) || this.at(',', next) || this.at('>', next) || this.at('[', next) || this.at('(', next) || this.at('=', next) || this.at(';', next) || this.at('{', next) || this.at('this', next) || this.at('.', next);
    }
    private typeArguments(): TypeRef[] {
        this.expect('<');
        const args: TypeRef[] = [];
        if (this.at('>')) {
            this.advance();
            return args;
        }
        do
            args.push(this.type());
        while (this.match(','));
        this.expect('>', 'fechando os argumentos de tipo');
        return args;
    }
    block(): Block {
        const start = this.expect('{', 'abrindo o bloco');
        const statements: Statement[] = [];
        while (!this.at('}') && !this.atEnd()) {
            try {
                statements.push(this.statement());
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
        this.expect('}', 'fechando o bloco');
        return { kind: 'block', statements, span: this.spanFrom(start) };
    }
    statement(): Statement {
        const start = this.current;
        if (this.at('{'))
            return this.block();
        if (this.match(';'))
            return { kind: 'empty', span: this.spanFrom(start) };
        if (this.at('if'))
            return this.ifStatement();
        if (this.at('while'))
            return this.whileStatement();
        if (this.at('do'))
            return this.doStatement();
        if (this.at('for'))
            return this.forStatement();
        if (this.at('foreach') || (this.atIdentifier('await') && this.at('foreach', this.peek())))
            return this.forEachStatement();
        if (this.at('switch'))
            return this.switchStatement();
        if (this.at('break')) {
            this.advance();
            this.expect(';', 'depois de break');
            return { kind: 'break', span: this.spanFrom(start) };
        }
        if (this.at('continue')) {
            this.advance();
            this.expect(';', 'depois de continue');
            return { kind: 'continue', span: this.spanFrom(start) };
        }
        if (this.at('return')) {
            this.advance();
            const expression = this.at(';') ? null : this.expression();
            this.expect(';', 'depois de return');
            return { kind: 'return', expression, span: this.spanFrom(start) };
        }
        if (this.at('throw')) {
            this.advance();
            const expression = this.at(';') ? null : this.expression();
            this.expect(';', 'depois de throw');
            return { kind: 'throw', expression, span: this.spanFrom(start) };
        }
        if (this.at('try'))
            return this.tryStatement();
        if (this.at('using'))
            return this.usingStatement();
        if (this.at('lock')) {
            this.advance();
            this.expect('(');
            const expression = this.expression();
            this.expect(')');
            return { kind: 'lock', expression, body: this.statement(), span: this.spanFrom(start) };
        }
        if (this.at('checked') || this.at('unchecked')) {
            if (this.at('{', this.peek())) {
                this.advance();
                return this.block();
            }
        }
        if (this.atIdentifier('yield') && (this.at('return', this.peek()) || this.at('break', this.peek()))) {
            this.advance();
            const isBreak = this.advance().text === 'break';
            const expression = isBreak ? null : this.expression();
            this.expect(';', 'depois de yield');
            return { kind: 'yield', expression, span: this.spanFrom(start) };
        }
        if (this.at('goto'))
            this.fail('goto não é suportado; use laços, break/continue ou métodos.');
        if (this.at('fixed') || this.at('unsafe') || this.at('stackalloc'))
            this.fail('Código unsafe (ponteiros, fixed, stackalloc) não existe neste runtime.');
        if (this.at('const')) {
            this.advance();
            const type = this.type();
            const declarators = this.declarators('da constante');
            this.expect(';', 'depois da constante');
            return { kind: 'local', type, isConst: true, declarators, deconstruction: null, span: this.spanFrom(start) };
        }
        if (this.current.kind === 'identifier' && this.at(':', this.peek()) && !this.at(':', this.peek(2))) {
            this.fail('Rótulos (nome:) não são suportados porque goto não existe aqui.');
        }
        const isAwaitStatement = this.atIdentifier('await') && this.awaitOperandFollows();
        const declaration = isAwaitStatement ? null : this.attempt(() => this.localDeclarationOrFunction());
        if (declaration)
            return declaration;
        const expression = this.expression();
        this.expect(';', 'depois da expressão');
        return { kind: 'expression', expression, span: this.spanFrom(start) };
    }
    private localDeclarationOrFunction(): Statement {
        const start = this.current;
        const isAsync = this.matchIdentifier('async');
        if (this.at('ref'))
            this.advance();
        if (this.atIdentifier('var') && this.at('(', this.peek())) {
            this.advance();
            const names = this.designationNames();
            this.expect('=', 'na desconstrução');
            const initializer = this.expression();
            this.expect(';', 'depois da desconstrução');
            const type: TypeRef = { name: 'var', typeArguments: [], arrayRank: 0, nullable: false, tupleElements: null, span: start.span };
            return { kind: 'local', type, isConst: false, declarators: [], deconstruction: { names, initializer }, span: this.spanFrom(start) };
        }
        const type = this.type();
        if (this.current.kind !== 'identifier')
            this.fail('não é uma declaração');
        const nameToken = this.current;
        const after = this.peek();
        if (this.at('(', after) || (this.at('<', after) && !isAsync)) {
            this.advance();
            const typeParameters = this.typeParametersIfAny();
            const parameters = this.parameterList();
            this.skipConstraints();
            if (!this.at('{') && !this.at('=>'))
                this.fail('não é uma função local');
            const { body, expressionBody } = this.bodyOrExpression('da função local');
            const modifiers = isAsync ? ['async'] : [];
            const method: MethodMember = { kind: 'method', modifiers, returnType: type, name: String(nameToken.value), nameSpan: nameToken.span, typeParameters, parameters, body, expressionBody, span: this.spanFrom(start) };
            return { kind: 'localFunction', method, span: method.span };
        }
        if (isAsync)
            this.fail('não é uma declaração');
        if (!this.at('=', after) && !this.at(';', after) && !this.at(',', after))
            this.fail('não é uma declaração');
        const declarators = this.declarators('da variável');
        this.expect(';', 'depois da declaração');
        return { kind: 'local', type, isConst: false, declarators, deconstruction: null, span: this.spanFrom(start) };
    }
    private designationNames(): string[] {
        this.expect('(', 'abrindo a desconstrução');
        const names: string[] = [];
        do {
            if (this.atIdentifier('var'))
                this.advance();
            else if (this.current.kind === 'keyword' && PRIMITIVE_TYPE_KEYWORDS.has(this.current.text))
                this.advance();
            names.push(String(this.expectIdentifier('da desconstrução').value));
        } while (this.match(','));
        this.expect(')', 'fechando a desconstrução');
        return names;
    }
    private ifStatement(): Statement {
        const start = this.expect('if');
        this.expect('(', 'depois de if');
        const condition = this.expression();
        this.expect(')', 'fechando a condição do if');
        const then = this.statement();
        const elseBranch = this.match('else') ? this.statement() : null;
        return { kind: 'if', condition, then, else: elseBranch, span: this.spanFrom(start) };
    }
    private whileStatement(): Statement {
        const start = this.expect('while');
        this.expect('(', 'depois de while');
        const condition = this.expression();
        this.expect(')', 'fechando a condição do while');
        return { kind: 'while', condition, body: this.statement(), span: this.spanFrom(start) };
    }
    private doStatement(): Statement {
        const start = this.expect('do');
        const body = this.statement();
        this.expect('while', 'depois do corpo do do');
        this.expect('(');
        const condition = this.expression();
        this.expect(')');
        this.expect(';', 'depois do do/while');
        return { kind: 'do', body, condition, span: this.spanFrom(start) };
    }
    private forStatement(): Statement {
        const start = this.expect('for');
        this.expect('(', 'depois de for');
        let declaration: LocalDeclaration | null = null;
        const initializers: Expression[] = [];
        if (!this.at(';')) {
            const local = this.attempt(() => {
                const localStart = this.current;
                const type = this.type();
                if (this.current.kind !== 'identifier')
                    this.fail('não é uma declaração');
                const declarators = this.declarators('da variável do for');
                if (!this.at(';'))
                    this.fail('não é uma declaração');
                return { kind: 'local', type, isConst: false, declarators, deconstruction: null, span: this.spanFrom(localStart) } as LocalDeclaration;
            });
            if (local)
                declaration = local;
            else {
                do
                    initializers.push(this.expression());
                while (this.match(','));
            }
        }
        this.expect(';', 'depois da inicialização do for');
        const condition = this.at(';') ? null : this.expression();
        this.expect(';', 'depois da condição do for');
        const updates: Expression[] = [];
        if (!this.at(')')) {
            do
                updates.push(this.expression());
            while (this.match(','));
        }
        this.expect(')', 'fechando o for');
        return { kind: 'for', declaration, initializers, condition, updates, body: this.statement(), span: this.spanFrom(start) };
    }
    private forEachStatement(): Statement {
        const start = this.current;
        const isAwait = this.matchIdentifier('await');
        this.expect('foreach');
        this.expect('(', 'depois de foreach');
        let type: TypeRef | null = null;
        let name: string | null = null;
        let deconstruction: string[] | null = null;
        if (this.atIdentifier('var') && this.at('(', this.peek())) {
            this.advance();
            deconstruction = this.designationNames();
        }
        else if (this.at('(')) {
            deconstruction = this.designationNames();
        }
        else {
            type = this.type();
            name = String(this.expectIdentifier('da variável do foreach').value);
        }
        if (!this.match('in'))
            this.fail(`Esperado "in" no foreach, encontrado ${this.describe(this.current)}.`);
        const iterable = this.expression();
        this.expect(')', 'fechando o foreach');
        return { kind: 'foreach', type, name, deconstruction, iterable, body: this.statement(), isAwait, span: this.spanFrom(start) };
    }
    private switchStatement(): Statement {
        const start = this.expect('switch');
        this.expect('(', 'depois de switch');
        const value = this.expression();
        this.expect(')');
        this.expect('{', 'abrindo o switch');
        const sections: SwitchSection[] = [];
        while (!this.at('}') && !this.atEnd()) {
            const labels: SwitchLabel[] = [];
            while (this.at('case') || this.at('default')) {
                const labelStart = this.advance();
                if (labelStart.text === 'default') {
                    this.expect(':', 'depois de default');
                    labels.push({ kind: 'default', span: this.spanFrom(labelStart) });
                    continue;
                }
                const pattern = this.pattern();
                const guard = this.matchIdentifier('when') ? this.expression() : null;
                this.expect(':', 'depois do case');
                labels.push({ kind: 'case', pattern, guard, span: this.spanFrom(labelStart) });
            }
            if (labels.length === 0)
                this.fail(`Esperado case ou default no switch, encontrado ${this.describe(this.current)}.`);
            const statements: Statement[] = [];
            while (!this.at('case') && !this.at('default') && !this.at('}') && !this.atEnd())
                statements.push(this.statement());
            sections.push({ labels, statements });
        }
        this.expect('}', 'fechando o switch');
        return { kind: 'switch', value, sections, span: this.spanFrom(start) };
    }
}
