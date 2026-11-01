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
    private parseScript(): ScriptFile {
        const first = this.peek();
        let className: string | null = null;
        let classNameSpan: SourceSpan | null = null;
        let extendsType: TypeRef | null = null;
        let extendsPath: string | null = null;
        let isTool = false;
        let icon: string | null = null;
        const members: ClassMember[] = [];
        const scriptAnnotations: Annotation[] = [];
        let sawMember = false;
        while (!this.check('eof')) {
            while (this.check('newline') || this.check('dedent'))
                this.next();
            if (this.check('eof'))
                break;
            try {
                const annotations = this.parseAnnotations();
                const token = this.peek();
                if (annotations.length > 0 && annotations.every((annotation) => SCRIPT_ANNOTATIONS.has(annotation.name)) && (token.kind === 'newline' || token.kind === 'eof' || (token.kind === 'keyword' && (token.value === 'class_name' || token.value === 'extends')))) {
                    for (const annotation of annotations) {
                        if (annotation.name === 'tool')
                            isTool = true;
                        else if (annotation.name === 'icon') {
                            const arg = annotation.args[0];
                            if (!arg || arg.kind !== 'string')
                                throw this.failure('@icon precisa do caminho da imagem entre aspas.', annotation.span);
                            icon = arg.value;
                        }
                        scriptAnnotations.push(annotation);
                    }
                    if (token.kind === 'newline')
                        this.next();
                    continue;
                }
                if (this.checkKeyword('class_name')) {
                    const keyword = this.next();
                    if (annotations.length > 0)
                        throw this.failure('Anotações não se aplicam a class_name.', annotations[0].span);
                    if (className !== null)
                        throw this.failure('class_name só pode aparecer uma vez.', keyword);
                    if (sawMember)
                        throw this.failure('class_name precisa vir antes dos membros da classe.', keyword);
                    const name = this.expectIdentifier('o nome da classe');
                    className = name.value;
                    classNameSpan = name;
                    if (this.matchKeyword('extends')) {
                        const parsed = this.parseExtends();
                        extendsType = parsed.type;
                        extendsPath = parsed.path;
                    }
                    this.endStatement();
                    continue;
                }
                if (this.checkKeyword('extends')) {
                    const keyword = this.next();
                    if (annotations.length > 0)
                        throw this.failure('Anotações não se aplicam a extends.', annotations[0].span);
                    if (extendsType || extendsPath)
                        throw this.failure('extends só pode aparecer uma vez.', keyword);
                    if (sawMember)
                        throw this.failure('extends precisa vir antes dos membros da classe.', keyword);
                    const parsed = this.parseExtends();
                    extendsType = parsed.type;
                    extendsPath = parsed.path;
                    this.endStatement();
                    continue;
                }
                const member = this.parseMember(annotations);
                if (member) {
                    members.push(member);
                    sawMember = true;
                }
            }
            catch (error) {
                this.report(error);
                this.synchronize();
            }
        }
        const last = this.tokens[this.tokens.length - 1];
        return { span: span(first, last), className, classNameSpan, extendsType, extendsPath, isTool, icon, members, annotations: scriptAnnotations };
    }
    private parseExtends(): {
        type: TypeRef | null;
        path: string | null;
    } {
        const token = this.peek();
        if (token.kind === 'string') {
            this.next();
            return { type: null, path: token.value };
        }
        return { type: this.parseType('a classe base'), path: null };
    }
    private parseAnnotations(): Annotation[] {
        const annotations: Annotation[] = [];
        while (this.check('annotation')) {
            const token = this.next();
            const args: Expression[] = [];
            let end: SourceSpan = token;
            if (this.checkOperator('(')) {
                this.next();
                if (!this.checkOperator(')')) {
                    do
                        args.push(this.parseExpression());
                    while (this.matchOperator(',') && !this.checkOperator(')'));
                }
                end = this.expectOperator(')');
            }
            if (!SCRIPT_ANNOTATIONS.has(token.value) && !MEMBER_ANNOTATIONS.has(token.value)) {
                throw this.failure(`A anotação @${token.value} não existe no GDScript.`, token);
            }
            annotations.push({ span: span(token, end), name: token.value, args });
            if (MEMBER_ANNOTATIONS.has(token.value) && this.check('newline') && (this.check('annotation', undefined, 1) || this.isMemberStart(this.peek(1))))
                this.next();
        }
        return annotations;
    }
    private isMemberStart(token: Token): boolean {
        return token.kind === 'keyword' && ['var', 'const', 'func', 'static', 'signal', 'enum', 'class'].includes(token.value);
    }
    private parseMember(annotations: Annotation[]): ClassMember | null {
        const token = this.peek();
        if (token.kind === 'keyword') {
            switch (token.value) {
                case 'static': {
                    this.next();
                    if (this.checkKeyword('var'))
                        return this.parseVariableMember(annotations, true, token);
                    if (this.checkKeyword('func'))
                        return this.parseFunctionMember(annotations, true, token);
                    throw this.failure('Depois de "static" vem "var" ou "func".', this.peek());
                }
                case 'var':
                    return this.parseVariableMember(annotations, false, token);
                case 'const':
                    return this.parseConstantMember(annotations);
                case 'func':
                    return this.parseFunctionMember(annotations, false, token);
                case 'signal':
                    return this.parseSignalMember(annotations);
                case 'enum':
                    return this.parseEnumMember(annotations);
                case 'class':
                    return this.parseClassDeclaration(annotations);
                case 'pass':
                    this.next();
                    this.endStatement();
                    return null;
                case 'yield':
                    throw this.failure('"yield" foi removido no GDScript 2: use "await".', token);
                default:
                    break;
            }
        }
        if (annotations.length > 0)
            throw this.failure(`A anotação @${annotations[annotations.length - 1].name} precisa vir antes de um membro (var, func…).`, annotations[annotations.length - 1].span);
        if (token.kind === 'identifier' || token.kind === 'keyword') {
            throw this.failure(`"${token.value}" não pode ficar solto no corpo da classe: instruções só dentro de func.`, token);
        }
        if (token.kind === 'indent')
            throw this.failure('Indentação inesperada: este bloco não pertence a nenhuma declaração.', token);
        throw this.failure(`Esperava uma declaração (var, func, signal…), mas encontrou ${describeToken(token)}.`, token);
    }
    private rejectAnnotations(annotations: Annotation[], allowed: readonly string[], what: string): void {
        for (const annotation of annotations) {
            if (!allowed.includes(annotation.name))
                throw this.failure(`@${annotation.name} não se aplica a ${what}.`, annotation.span);
        }
    }
    private parseVariableMember(annotations: Annotation[], isStatic: boolean, start: Token): VariableMember {
        this.expect('keyword', 'var', '"var"');
        const name = this.expectIdentifier('o nome da variável');
        const exported = annotations.some((annotation) => annotation.name.startsWith('export'));
        const onReady = annotations.some((annotation) => annotation.name === 'onready');
        this.rejectAnnotations(annotations, Array.from(MEMBER_ANNOTATIONS).filter((entry) => entry !== 'rpc' && entry !== 'abstract'), 'uma variável');
        if (isStatic && onReady)
            throw this.failure('@onready não se aplica a variáveis estáticas.', name);
        if (isStatic && exported)
            throw this.failure('@export não se aplica a variáveis estáticas.', name);
        let type: TypeRef | null = null;
        let inferred = false;
        let value: Expression | null = null;
        let accessors: PropertyAccessors | null = null;
        if (this.matchOperator(':=')) {
            inferred = true;
            value = this.parseExpression();
        }
        else if (this.matchOperator(':')) {
            if (this.check('newline') && this.check('indent', undefined, 1))
                accessors = this.parseAccessors();
            else {
                type = this.parseType('o tipo da variável');
                if (this.matchOperator('='))
                    value = this.parseExpression();
            }
        }
        else if (this.matchOperator('='))
            value = this.parseExpression();
        let end: SourceSpan = value?.span ?? type?.span ?? name;
        if (accessors === null && this.matchOperator(':')) {
            accessors = this.parseAccessors();
            end = accessors.getter?.span ?? accessors.setter?.span ?? end;
        }
        else if (accessors === null)
            this.endStatement();
        if (exported && onReady)
            throw this.failure('Uma variável não pode ser @export e @onready ao mesmo tempo.', name);
        return { kind: 'variable', span: span(start, end), name: name.value, nameSpan: name, type, inferred, value, isStatic, annotations, accessors, onReady, exported };
    }
    private parseAccessors(): PropertyAccessors {
        let setter: PropertyAccessors['setter'] = null;
        let getter: PropertyAccessors['getter'] = null;
        const assignNamed = (which: Token): void => {
            this.expectOperator('=');
            const target = this.expectIdentifier('o nome do método');
            if (which.value === 'set') {
                if (setter)
                    throw this.failure('A propriedade já tem um setter.', which);
                setter = { kind: 'named', name: target.value, span: span(which, target) };
            }
            else {
                if (getter)
                    throw this.failure('A propriedade já tem um getter.', which);
                getter = { kind: 'named', name: target.value, span: span(which, target) };
            }
            if (this.matchOperator(',')) {
                const next = this.peek();
                if (next.kind !== 'identifier' || (next.value !== 'set' && next.value !== 'get'))
                    throw this.failure('Esperava "set = nome" ou "get = nome" depois da vírgula.', next);
                this.next();
                assignNamed(next);
            }
        };
        if (!this.check('newline')) {
            const which = this.peek();
            if (which.kind !== 'identifier' || (which.value !== 'set' && which.value !== 'get'))
                throw this.failure('Esperava "set = nome" ou "get = nome".', which);
            this.next();
            assignNamed(which);
            this.endStatement();
            return { setter, getter };
        }
        this.next();
        this.expect('indent', undefined, 'o bloco com set/get da propriedade');
        while (!this.check('dedent') && !this.check('eof')) {
            this.skipNewlines();
            if (this.check('dedent'))
                break;
            const which = this.peek();
            if (which.kind !== 'identifier' || (which.value !== 'set' && which.value !== 'get'))
                throw this.failure('No bloco da propriedade só cabem "set(valor):", "get:" e "set = nome, get = nome".', which);
            this.next();
            if (this.checkOperator('=')) {
                assignNamed(which);
                this.endStatement();
                continue;
            }
            if (which.value === 'set') {
                if (setter)
                    throw this.failure('A propriedade já tem um setter.', which);
                this.expectOperator('(');
                const param = this.expectIdentifier('o nome do parâmetro do setter');
                this.expectOperator(')');
                this.expectOperator(':');
                const body = this.parseBlock();
                setter = { kind: 'inline', param: param.value, body, span: span(which, body.span) };
            }
            else {
                if (getter)
                    throw this.failure('A propriedade já tem um getter.', which);
                this.expectOperator(':');
                const body = this.parseBlock();
                getter = { kind: 'inline', body, span: span(which, body.span) };
            }
        }
        this.expect('dedent', undefined, 'o fim do bloco da propriedade');
        return { setter, getter };
    }
    private parseConstantMember(annotations: Annotation[]): ConstantMember {
        const start = this.expect('keyword', 'const', '"const"');
        this.rejectAnnotations(annotations, ['warning_ignore'], 'uma constante');
        const name = this.expectIdentifier('o nome da constante');
        let type: TypeRef | null = null;
        if (this.matchOperator(':=')) {
            const value = this.parseExpression();
            this.endStatement();
            return { kind: 'constant', span: span(start, value.span), name: name.value, nameSpan: name, type: null, value, annotations };
        }
        if (this.matchOperator(':'))
            type = this.parseType('o tipo da constante');
        if (!this.matchOperator('='))
            throw this.failure(`A constante "${name.value}" precisa de um valor: const ${name.value} = …`, this.peek());
        const value = this.parseExpression();
        this.endStatement();
        return { kind: 'constant', span: span(start, value.span), name: name.value, nameSpan: name, type, value, annotations };
    }
    private parseSignalMember(annotations: Annotation[]): SignalMember {
        const start = this.expect('keyword', 'signal', '"signal"');
        this.rejectAnnotations(annotations, ['warning_ignore'], 'um sinal');
        const name = this.expectIdentifier('o nome do sinal');
        let params: Parameter[] = [];
        let end: SourceSpan = name;
        if (this.checkOperator('(')) {
            this.next();
            params = this.parseParameters(')');
            end = this.expectOperator(')');
        }
        this.endStatement();
        return { kind: 'signal', span: span(start, end), name: name.value, params };
    }
    private parseEnumMember(annotations: Annotation[]): EnumMember {
        const start = this.expect('keyword', 'enum', '"enum"');
        this.rejectAnnotations(annotations, ['warning_ignore'], 'um enum');
        const name = this.check('identifier') ? this.next() : null;
        this.expectOperator('{', '"{" com os valores do enum');
        const values: {
            name: string;
            span: SourceSpan;
            value: Expression | null;
        }[] = [];
        while (!this.checkOperator('}')) {
            const entry = this.expectIdentifier('o nome de um valor do enum');
            let value: Expression | null = null;
            if (this.matchOperator('='))
                value = this.parseExpression();
            if (values.some((existing) => existing.name === entry.value))
                throw this.failure(`O valor "${entry.value}" aparece duas vezes no enum.`, entry);
            values.push({ name: entry.value, span: entry, value });
            if (!this.matchOperator(','))
                break;
        }
        const end = this.expectOperator('}');
        this.endStatement();
        return { kind: 'enum', span: span(start, end), name: name?.value ?? null, values };
    }
    private parseFunctionMember(annotations: Annotation[], isStatic: boolean, start: Token): FunctionMember {
        this.expect('keyword', 'func', '"func"');
        this.rejectAnnotations(annotations, ['rpc', 'warning_ignore', 'abstract'], 'uma função');
        const name = this.expectIdentifier('o nome da função');
        this.expectOperator('(', '"(" com os parâmetros');
        const params = this.parseParameters(')');
        this.expectOperator(')');
        let returnType: TypeRef | null = null;
        if (this.matchOperator('->'))
            returnType = this.parseType('o tipo de retorno', true);
        this.expectOperator(':', '":" antes do corpo da função');
        const body = this.parseBlock();
        return { kind: 'function', span: span(start, body.span), name: name.value, nameSpan: name, params, returnType, body, isStatic, annotations };
    }
    private parseParameters(closer: string): Parameter[] {
        const params: Parameter[] = [];
        while (!this.checkOperator(closer)) {
            const name = this.expectIdentifier('o nome do parâmetro');
            let type: TypeRef | null = null;
            let defaultValue: Expression | null = null;
            if (this.matchOperator(':='))
                defaultValue = this.parseExpression();
            else {
                if (this.matchOperator(':'))
                    type = this.parseType('o tipo do parâmetro');
                if (this.matchOperator('='))
                    defaultValue = this.parseExpression();
            }
            if (params.some((existing) => existing.name === name.value))
                throw this.failure(`O parâmetro "${name.value}" está repetido.`, name);
            if (defaultValue === null && params.length > 0 && params[params.length - 1].defaultValue !== null) {
                throw this.failure(`O parâmetro "${name.value}" precisa de valor padrão: ele vem depois de um parâmetro com padrão.`, name);
            }
            params.push({ span: span(name, defaultValue?.span ?? type?.span ?? name), name: name.value, type, defaultValue });
            if (!this.matchOperator(','))
                break;
        }
        return params;
    }
    private parseClassDeclaration(annotations: Annotation[]): ClassDeclaration {
        const start = this.expect('keyword', 'class', '"class"');
        this.rejectAnnotations(annotations, ['warning_ignore', 'abstract'], 'uma classe interna');
        const name = this.expectIdentifier('o nome da classe');
        let extendsType: TypeRef | null = null;
        let extendsPath: string | null = null;
        if (this.matchKeyword('extends')) {
            const parsed = this.parseExtends();
            extendsType = parsed.type;
            extendsPath = parsed.path;
        }
        this.expectOperator(':', '":" depois do nome da classe');
        this.expect('newline', undefined, 'uma quebra de linha depois de ":"');
        this.expect('indent', undefined, 'o corpo indentado da classe');
        const members: ClassMember[] = [];
        while (!this.check('dedent') && !this.check('eof')) {
            this.skipNewlines();
            if (this.check('dedent') || this.check('eof'))
                break;
            try {
                const memberAnnotations = this.parseAnnotations();
                if (this.checkKeyword('extends')) {
                    const keyword = this.next();
                    if (members.length > 0 || extendsType || extendsPath)
                        throw this.failure('extends precisa vir logo depois do nome da classe interna.', keyword);
                    const parsed = this.parseExtends();
                    extendsType = parsed.type;
                    extendsPath = parsed.path;
                    this.endStatement();
                    continue;
                }
                const member = this.parseMember(memberAnnotations);
                if (member)
                    members.push(member);
            }
            catch (error) {
                this.report(error);
                this.synchronize();
            }
        }
        const end = this.expect('dedent', undefined, 'o fim da classe');
        return { kind: 'class', span: span(start, end), name: name.value, nameSpan: name, extendsType, extendsPath, members, annotations };
    }
    private parseType(what: string, allowVoid = false): TypeRef {
        const first = this.peek();
        if (first.kind === 'keyword' && first.value === 'void') {
            if (!allowVoid)
                throw this.failure('"void" só vale como tipo de retorno.', first);
            this.next();
            return { span: first, name: 'void', args: [] };
        }
        if (first.kind === 'keyword' && first.value === 'null') {
            this.next();
            return { span: first, name: 'null', args: [] };
        }
        const head = this.expectIdentifier(what);
        let name = head.value;
        let end: SourceSpan = head;
        while (this.checkOperator('.') && this.check('identifier', undefined, 1)) {
            this.next();
            const part = this.next();
            name += `.${part.value}`;
            end = part;
        }
        const args: TypeRef[] = [];
        if (this.checkOperator('[')) {
            this.next();
            do
                args.push(this.parseType('o tipo do elemento'));
            while (this.matchOperator(','));
            end = this.expectOperator(']');
        }
        return { span: span(head, end), name, args };
    }
    private parseBlock(inlineLambda = false): Block {
        const first = this.peek();
        if (first.kind !== 'newline') {
            const statements = this.parseStatementLine(inlineLambda);
            return { span: span(first, statements[statements.length - 1]?.span ?? first), statements };
        }
        this.next();
        if (!this.check('indent'))
            throw this.failure('Esperava um bloco indentado nesta linha (ou "pass" para um corpo vazio).', this.peek());
        const indent = this.next();
        const statements: Statement[] = [];
        while (!this.check('dedent') && !this.check('eof')) {
            this.skipNewlines();
            if (this.check('dedent') || this.check('eof'))
                break;
            try {
                statements.push(...this.parseStatementLine());
            }
            catch (error) {
                this.report(error);
                this.synchronize();
            }
        }
        const end = this.check('dedent') ? this.next() : this.peek();
        return { span: span(indent, statements[statements.length - 1]?.span ?? end), statements };
    }
    private parseStatementLine(inlineLambda = false): Statement[] {
        const statements: Statement[] = [];
        const atTerminator = (): boolean => {
            const token = this.peek();
            if (token.kind === 'eof' || token.kind === 'dedent')
                return true;
            return inlineLambda && token.kind === 'operator' && (CLOSERS.has(token.value) || token.value === ',');
        };
        for (;;) {
            statements.push(this.parseStatement());
            if (this.check('newline')) {
                this.next();
                break;
            }
            if (atTerminator() || this.endedWithBlock())
                break;
            if (this.matchOperator(';')) {
                if (this.check('newline')) {
                    this.next();
                    break;
                }
                if (atTerminator())
                    break;
                continue;
            }
            throw this.failure(`Fim de instrução esperado, mas encontrou ${describeToken(this.peek())}.`, this.peek());
        }
        return statements;
    }
}
