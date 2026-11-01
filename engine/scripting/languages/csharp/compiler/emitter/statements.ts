import { EXCEPTION_TYPES } from '../../runtime/errors';
import type { Block, Expression, LocalDeclaration, MethodMember, Statement, StaticType, SwitchLabel, SwitchSection, UsingStatement } from '../ast';
import { indent, unique, type EmitContext } from './context';
import { expression, expressionBodyLines, parameterList, statementExpression, truthy } from './expressions';
import { patternTest } from './patterns';
import { defaultValue, typeTestExpression } from './types';
import { patternJsNames, statementHoists } from './walk';
export function blockLines(ctx: EmitContext, block: Block): string[] {
    return statementsLines(ctx, block.statements);
}
export function statementsLines(ctx: EmitContext, statements: readonly Statement[]): string[] {
    const lines: string[] = [];
    for (let index = 0; index < statements.length; index++) {
        const statement = statements[index];
        if (statement.kind === 'using' && statement.body === null) {
            lines.push(...usingDeclarationLines(ctx, statement, statements.slice(index + 1)));
            return lines;
        }
        lines.push(...statementLines(ctx, statement));
    }
    return lines;
}
export function statementLines(ctx: EmitContext, statement: Statement): string[] {
    const hoists = statementHoists(statement);
    const body = emitStatement(ctx, statement);
    if (hoists.length === 0)
        return body;
    const declaration = `let ${hoists.join(', ')};`;
    if (statement.kind === 'expression' || statement.kind === 'local')
        return [declaration, ...body];
    return ['{', ...indent([declaration, ...body]), '}'];
}
function bodyLines(ctx: EmitContext, statement: Statement): string[] {
    return statement.kind === 'block' ? blockLines(ctx, statement) : statementLines(ctx, statement);
}
function loopBodyLines(ctx: EmitContext, statement: Statement): string[] {
    return ctx.withBreakTarget({ kind: 'loop' }, () => bodyLines(ctx, statement));
}
function emitStatement(ctx: EmitContext, statement: Statement): string[] {
    const at = ctx.mark(statement.span);
    switch (statement.kind) {
        case 'block':
            return ['{', ...indent(blockLines(ctx, statement)), '}'];
        case 'empty':
            return [];
        case 'expression':
            return [`${at}${statementExpression(ctx, statement.expression)};`];
        case 'local':
            return [`${at}${localText(ctx, statement)};`];
        case 'localFunction':
            return localFunctionLines(ctx, statement.method, at);
        case 'if':
            return ifLines(ctx, statement, at);
        case 'while':
            return [`${at}while (${truthy(ctx, statement.condition)}) {`, ...indent(loopBodyLines(ctx, statement.body)), '}'];
        case 'do':
            return [`${at}do {`, ...indent(loopBodyLines(ctx, statement.body)), `} while (${truthy(ctx, statement.condition)});`];
        case 'for': {
            const initializer = statement.declaration ? localText(ctx, statement.declaration) : statement.initializers.map((e) => statementExpression(ctx, e)).join(', ');
            const condition = statement.condition ? truthy(ctx, statement.condition) : '';
            const updates = statement.updates.map((e) => statementExpression(ctx, e)).join(', ');
            return [`${at}for (${initializer}; ${condition}; ${updates}) {`, ...indent(loopBodyLines(ctx, statement.body)), '}'];
        }
        case 'foreach': {
            const iterable = statement.directIterable ? expression(ctx, statement.iterable) : `$.iter(${expression(ctx, statement.iterable)})`;
            const keyword = statement.isAwait ? 'for await' : 'for';
            if (statement.deconstruction) {
                const item = ctx.nextTemp('e');
                const names = statement.deconstructionJsNames ?? statement.deconstruction;
                return [`${at}${keyword} (const ${item} of ${iterable}) {`, ...indent([`const [${names.join(', ')}] = $.deconstruct(${item}, ${names.length});`, ...loopBodyLines(ctx, statement.body)]), '}'];
            }
            return [`${at}${keyword} (const ${statement.jsName ?? statement.name} of ${iterable}) {`, ...indent(loopBodyLines(ctx, statement.body)), '}'];
        }
        case 'switch':
            return switchLines(ctx, statement.value, statement.sections, at);
        case 'break':
            return [`${at}${ctx.breakStatement()}`];
        case 'continue':
            return [`${at}continue;`];
        case 'return':
            if (ctx.fn.isConstructor)
                return [`${at}return this;`];
            return [statement.expression ? `${at}return ${expression(ctx, statement.expression)};` : `${at}return;`];
        case 'throw': {
            if (!statement.expression)
                return [`${at}throw ${ctx.currentCatchVariable() ?? 'undefined'};`];
            const type = statement.expression.staticType;
            const text = expression(ctx, statement.expression);
            const isException = type?.kind === 'class' && type.runtime === true && type.name in EXCEPTION_TYPES;
            return [isException ? `${at}throw ${text};` : `${at}$.throwValue(${text});`];
        }
        case 'try':
            return tryLines(ctx, statement, at);
        case 'using':
            return usingLines(ctx, statement, at);
        case 'lock':
            return ['{', ...indent(bodyLines(ctx, statement.body)), '}'];
        case 'yield':
            return [statement.expression ? `${at}yield ${expression(ctx, statement.expression)};` : `${at}return;`];
    }
}
function localText(ctx: EmitContext, declaration: LocalDeclaration): string {
    if (declaration.deconstruction) {
        const names = declaration.deconstruction.jsNames ?? declaration.deconstruction.names;
        return `let [${names.join(', ')}] = $.deconstruct(${expression(ctx, declaration.deconstruction.initializer)}, ${names.length})`;
    }
    const keyword = declaration.isConst ? 'const' : 'let';
    const parts = declaration.declarators.map((declarator) => `${declarator.jsName ?? declarator.name} = ${declarator.initializer ? expression(ctx, declarator.initializer) : defaultValue(ctx, declarator.staticType)}`);
    return `${keyword} ${parts.join(', ')}`;
}
function localFunctionLines(ctx: EmitContext, method: MethodMember, at: string): string[] {
    const head = `${at}${method.isAsync ? 'async ' : ''}function${method.isIterator ? '*' : ''} ${method.jsName ?? method.name}(${parameterList(ctx, method.parameters)}) {`;
    const body = method.body ? blockLines(ctx, method.body) : method.expressionBody ? expressionBodyLines(ctx, method.expressionBody, method.returnType.name === 'void') : [];
    return [head, ...indent(body), '}'];
}
function ifLines(ctx: EmitContext, statement: Statement & {
    kind: 'if';
}, at: string): string[] {
    const lines = [`${at}if (${truthy(ctx, statement.condition)}) {`, ...indent(bodyLines(ctx, statement.then))];
    let branch = statement.else;
    while (branch) {
        if (branch.kind === 'if') {
            lines.push(`} else ${ctx.mark(branch.span)}if (${truthy(ctx, branch.condition)}) {`, ...indent(bodyLines(ctx, branch.then)));
            branch = branch.else;
            continue;
        }
        lines.push('} else {', ...indent(bodyLines(ctx, branch)));
        break;
    }
    lines.push('}');
    return lines;
}
function hasDefault(section: SwitchSection): boolean {
    return section.labels.some((label) => label.kind === 'default');
}
function endsWithJump(statements: readonly Statement[]): boolean {
    const last = statements[statements.length - 1];
    return last?.kind === 'break' || last?.kind === 'return' || last?.kind === 'throw' || last?.kind === 'continue';
}
function caseTest(ctx: EmitContext, label: SwitchLabel & {
    kind: 'case';
}, value: string, valueType: StaticType | undefined): string {
    const test = patternTest(ctx, label.pattern, value, valueType);
    return label.guard ? `(${test} && ${truthy(ctx, label.guard)})` : test;
}
function switchLines(ctx: EmitContext, value: Expression, sections: readonly SwitchSection[], at: string): string[] {
    const holder = ctx.nextTemp('v');
    const label = ctx.nextTemp('sw');
    const bindings = unique(sections.flatMap((section) => section.labels.flatMap((entry) => (entry.kind === 'case' ? patternJsNames(entry.pattern) : []))));
    const ordered = [...sections].sort((a, b) => Number(hasDefault(a)) - Number(hasDefault(b)));
    const body: string[] = [];
    ctx.withBreakTarget({ kind: 'switch', label }, () => {
        for (const section of ordered) {
            const statements = statementsLines(ctx, section.statements);
            const content = endsWithJump(section.statements) ? statements : [...statements, `break ${label};`];
            if (hasDefault(section)) {
                body.push(...content);
                continue;
            }
            const tests = section.labels.flatMap((entry) => (entry.kind === 'case' ? [caseTest(ctx, entry, holder, value.staticType)] : []));
            body.push(`${ctx.mark(section.labels[0].span)}if (${tests.join(' || ')}) {`, ...indent(content), '}');
        }
    });
    const inner = [`const ${holder} = ${expression(ctx, value)};`];
    if (bindings.length > 0)
        inner.push(`let ${bindings.join(', ')};`);
    inner.push(`${label}: {`, ...indent(body), '}');
    return [`${at}{`, ...indent(inner), '}'];
}
function tryLines(ctx: EmitContext, statement: Statement & {
    kind: 'try';
}, at: string): string[] {
    const lines = [`${at}try {`, ...indent(blockLines(ctx, statement.block))];
    if (statement.catches.length > 0) {
        const thrown = ctx.nextTemp('e');
        const wrapped = ctx.nextTemp('ex');
        const inner = [`const ${wrapped} = $.wrap(${thrown});`];
        const names = unique(statement.catches.flatMap((clause) => (clause.jsName ? [clause.jsName] : [])));
        if (names.length > 0)
            inner.push(`let ${names.join(', ')};`);
        const catchesAll = statement.catches.length === 1 && !statement.catches[0].typeTest && !statement.catches[0].filter;
        if (catchesAll) {
            const clause = statement.catches[0];
            if (clause.jsName)
                inner.push(`${clause.jsName} = ${wrapped};`);
            inner.push(...ctx.withCatchVariable(wrapped, () => blockLines(ctx, clause.block)));
        }
        else {
            statement.catches.forEach((clause, index) => {
                const conditions: string[] = [];
                if (clause.typeTest)
                    conditions.push(typeTestExpression(ctx, clause.typeTest, wrapped));
                if (clause.jsName)
                    conditions.push(`(${clause.jsName} = ${wrapped}, true)`);
                if (clause.filter)
                    conditions.push(truthy(ctx, clause.filter));
                inner.push(`${index === 0 ? '' : '} else '}${ctx.mark(clause.span)}if (${conditions.length > 0 ? conditions.join(' && ') : 'true'}) {`);
                inner.push(...indent(ctx.withCatchVariable(wrapped, () => blockLines(ctx, clause.block))));
            });
            inner.push('} else {', ...indent([`throw ${wrapped};`]), '}');
        }
        lines.push(`} catch (${thrown}) {`, ...indent(inner));
    }
    if (statement.finallyBlock)
        lines.push('} finally {', ...indent(blockLines(ctx, statement.finallyBlock)));
    lines.push('}');
    return lines;
}
interface UsingResources {
    readonly lines: string[];
    readonly names: string[];
}
function usingResources(ctx: EmitContext, statement: UsingStatement): UsingResources {
    const at = ctx.mark(statement.span);
    if (statement.declaration)
        return { lines: [`${at}${localText(ctx, statement.declaration)};`], names: statement.declaration.declarators.map((declarator) => declarator.jsName ?? declarator.name) };
    const resource = ctx.nextTemp('u');
    return { lines: [`${at}const ${resource} = ${statement.expression ? expression(ctx, statement.expression) : 'null'};`], names: [resource] };
}
function disposeLines(names: readonly string[]): string[] {
    return [...names].reverse().map((name) => `$.dispose(${name});`);
}
function usingLines(ctx: EmitContext, statement: UsingStatement, at: string): string[] {
    const { lines, names } = usingResources(ctx, statement);
    const body = statement.body ? bodyLines(ctx, statement.body) : [];
    return [`${at}{`, ...indent([...lines, 'try {', ...indent(body), '} finally {', ...indent(disposeLines(names)), '}']), '}'];
}
function usingDeclarationLines(ctx: EmitContext, statement: UsingStatement, rest: readonly Statement[]): string[] {
    const { lines, names } = usingResources(ctx, statement);
    return [...lines, 'try {', ...indent(statementsLines(ctx, rest)), '} finally {', ...indent(disposeLines(names)), '}'];
}
