import type { Expression, Hoist, Initializer, Pattern, Statement } from '../ast';
import { unique } from './context';
export function childExpressions(e: Expression): Expression[] {
    switch (e.kind) {
        case 'literal':
        case 'identifier':
        case 'this':
        case 'base':
        case 'nameof':
        case 'typeof':
        case 'default':
        case 'lambda':
            return [];
        case 'member':
            return [e.target];
        case 'element':
        case 'call':
            return [e.target, ...e.arguments.map((argument) => argument.expression)];
        case 'new':
            return [...e.arguments.map((argument) => argument.expression), ...(e.initializer ? initializerExpressions(e.initializer) : [])];
        case 'anonymous':
            return e.members.map((member) => member.value);
        case 'array':
            return [...e.sizes, ...(e.elements ?? [])];
        case 'unary':
            return [e.operand];
        case 'binary':
            return [e.left, e.right];
        case 'assign':
            return [e.target, e.value];
        case 'conditional':
            return [e.condition, e.whenTrue, e.whenFalse];
        case 'cast':
        case 'as':
        case 'await':
        case 'throwExpression':
            return [e.expression];
        case 'is':
            return [e.expression, ...patternExpressions(e.pattern)];
        case 'interpolated':
            return e.parts.flatMap((part) => (part.kind === 'expression' ? [part.expression] : []));
        case 'tuple':
            return e.elements.map((element) => element.value);
        case 'switchExpression':
            return [e.value, ...e.arms.flatMap((arm) => [...patternExpressions(arm.pattern), ...(arm.guard ? [arm.guard] : []), arm.result])];
        case 'range':
            return [...(e.start ? [e.start] : []), ...(e.end ? [e.end] : [])];
        case 'fromEnd':
            return [e.operand];
    }
}
export function patternExpressions(pattern: Pattern): Expression[] {
    switch (pattern.kind) {
        case 'constant':
        case 'relational':
            return [pattern.expression];
        case 'not':
            return patternExpressions(pattern.pattern);
        case 'and':
        case 'or':
            return [...patternExpressions(pattern.left), ...patternExpressions(pattern.right)];
        case 'property':
            return pattern.properties.flatMap((property) => patternExpressions(property.pattern));
        case 'positional':
            return pattern.elements.flatMap(patternExpressions);
        default:
            return [];
    }
}
export function initializerExpressions(initializer: Initializer): Expression[] {
    if (initializer.kind === 'collection')
        return initializer.elements.flatMap((element) => (Array.isArray(element) ? (element as readonly Expression[]) : [element as Expression]));
    return initializer.entries.flatMap((entry) => {
        if (entry.kind === 'index')
            return [...entry.arguments.map((argument) => argument.expression), entry.value];
        return isInitializer(entry.value) ? initializerExpressions(entry.value) : [entry.value];
    });
}
export function isInitializer(value: Expression | Initializer): value is Initializer {
    return value.kind === 'object' || value.kind === 'collection';
}
export function statementExpressions(statement: Statement): Expression[] {
    switch (statement.kind) {
        case 'local':
            return statement.deconstruction ? [statement.deconstruction.initializer] : statement.declarators.flatMap((declarator) => (declarator.initializer ? [declarator.initializer] : []));
        case 'expression':
            return [statement.expression];
        case 'if': {
            const conditions: Expression[] = [statement.condition];
            for (let branch = statement.else; branch && branch.kind === 'if'; branch = branch.else)
                conditions.push(branch.condition);
            return conditions;
        }
        case 'while':
        case 'do':
            return [statement.condition];
        case 'for':
            return [...(statement.declaration ? statementExpressions(statement.declaration) : []), ...statement.initializers, ...(statement.condition ? [statement.condition] : []), ...statement.updates];
        case 'foreach':
            return [statement.iterable];
        case 'switch':
            return [statement.value];
        case 'return':
        case 'throw':
        case 'yield':
            return statement.expression ? [statement.expression] : [];
        case 'using':
            return [...(statement.declaration ? statementExpressions(statement.declaration) : []), ...(statement.expression ? [statement.expression] : [])];
        case 'lock':
            return [statement.expression];
        default:
            return [];
    }
}
export function patternJsNames(pattern: Pattern, out: string[] = []): string[] {
    switch (pattern.kind) {
        case 'declaration':
            if (pattern.jsName)
                out.push(pattern.jsName);
            break;
        case 'var':
            if (pattern.jsName)
                out.push(pattern.jsName);
            if (pattern.jsNames)
                out.push(...pattern.jsNames);
            break;
        case 'not':
            patternJsNames(pattern.pattern, out);
            break;
        case 'and':
        case 'or':
            patternJsNames(pattern.left, out);
            patternJsNames(pattern.right, out);
            break;
        case 'property':
            for (const property of pattern.properties)
                patternJsNames(property.pattern, out);
            if (pattern.jsName)
                out.push(pattern.jsName);
            break;
        case 'positional':
            for (const element of pattern.elements)
                patternJsNames(element, out);
            if (pattern.jsName)
                out.push(pattern.jsName);
            break;
        default:
            break;
    }
    return out;
}
export function expressionHoists(e: Expression, out: Hoist[] = []): Hoist[] {
    if (e.kind === 'is') {
        for (const jsName of patternJsNames(e.pattern))
            out.push({ name: jsName, jsName });
    }
    if (e.kind === 'call' || e.kind === 'element' || e.kind === 'new') {
        for (const argument of e.arguments) {
            if (argument.declaration && argument.expression.kind === 'identifier' && argument.expression.resolution?.kind === 'local') {
                out.push({ name: argument.declaration.name, jsName: argument.expression.resolution.jsName });
            }
        }
    }
    for (const child of childExpressions(e))
        expressionHoists(child, out);
    return out;
}
export function statementHoists(statement: Statement): string[] {
    return unique(statementExpressions(statement).flatMap((e) => expressionHoists(e).map((hoist) => hoist.jsName)));
}
export function containsAwait(e: Expression): boolean {
    if (e.kind === 'await')
        return true;
    return childExpressions(e).some(containsAwait);
}
