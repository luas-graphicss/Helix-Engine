import type { Pattern, StaticType } from '../ast';
import { q, type EmitContext } from './context';
import { expression } from './expressions';
import { isNumeric, isPrimitiveComparable, typeTestExpression } from './types';
const RELATIONAL: Readonly<Record<string, string>> = { '<': 'lt', '>': 'gt', '<=': 'le', '>=': 'ge' };
export function patternTest(ctx: EmitContext, pattern: Pattern, value: string, valueType: StaticType | undefined): string {
    switch (pattern.kind) {
        case 'discard':
            return 'true';
        case 'constant': {
            const constant = pattern.expression;
            if (constant.kind === 'literal' && constant.literalType === 'null')
                return `(${value} == null)`;
            const text = expression(ctx, constant);
            return isPrimitiveComparable(constant.staticType) && isPrimitiveComparable(valueType) ? `(${value} === ${text})` : `$.eq(${value}, ${text})`;
        }
        case 'relational': {
            const text = expression(ctx, pattern.expression);
            if (isNumeric(valueType) && isNumeric(pattern.expression.staticType))
                return `(${value} ${pattern.operator} ${text})`;
            return `$.${RELATIONAL[pattern.operator]}(${value}, ${text})`;
        }
        case 'type':
            return typeTestExpression(ctx, pattern.typeTest, value);
        case 'declaration': {
            const test = typeTestExpression(ctx, pattern.typeTest, value);
            return pattern.jsName ? `(${test} && (${pattern.jsName} = ${value}, true))` : test;
        }
        case 'var':
            if (pattern.jsNames)
                return `([${pattern.jsNames.join(', ')}] = $.deconstruct(${value}, ${pattern.jsNames.length}), true)`;
            return pattern.jsName ? `(${pattern.jsName} = ${value}, true)` : 'true';
        case 'not':
            return `!${patternTest(ctx, pattern.pattern, value, valueType)}`;
        case 'and':
            return `(${patternTest(ctx, pattern.left, value, valueType)} && ${patternTest(ctx, pattern.right, value, valueType)})`;
        case 'or':
            return `(${patternTest(ctx, pattern.left, value, valueType)} || ${patternTest(ctx, pattern.right, value, valueType)})`;
        case 'property': {
            const parts = [pattern.typeTest ? typeTestExpression(ctx, pattern.typeTest, value) : `(${value} != null)`];
            for (const property of pattern.properties)
                parts.push(nestedTest(ctx, property.pattern, `$.get(${value}, ${q(property.name)})`));
            if (pattern.jsName)
                parts.push(`(${pattern.jsName} = ${value}, true)`);
            return `(${parts.join(' && ')})`;
        }
        case 'positional': {
            const parts = [pattern.typeTest ? typeTestExpression(ctx, pattern.typeTest, value) : `(${value} != null)`];
            const parts$ = ctx.nextTemp('d');
            const elements = pattern.elements.map((element, index) => nestedTest(ctx, element, `${parts$}[${index}]`));
            parts.push(`((${parts$}) => ${elements.length > 0 ? elements.join(' && ') : 'true'})($.deconstruct(${value}, ${pattern.elements.length}))`);
            if (pattern.jsName)
                parts.push(`(${pattern.jsName} = ${value}, true)`);
            return `(${parts.join(' && ')})`;
        }
    }
}
function nestedTest(ctx: EmitContext, pattern: Pattern, valueExpression: string): string {
    const singleRead = pattern.kind === 'discard' || pattern.kind === 'constant' || pattern.kind === 'relational' || pattern.kind === 'type';
    if (singleRead)
        return patternTest(ctx, pattern, valueExpression, undefined);
    const temp = ctx.nextTemp('p');
    return `((${temp}) => ${patternTest(ctx, pattern, temp, undefined)})(${valueExpression})`;
}
