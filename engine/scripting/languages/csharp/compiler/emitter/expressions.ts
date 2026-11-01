import { RUNTIME_FACTORIES, type ClassInfo, type MemberInfo } from '../analyzer';
import { STATIC_TYPES, type Argument, type BinaryOperator, type CallExpression, type Expression, type Initializer, type LambdaExpression, type NewExpression, type Parameter, type StaticType } from '../ast';
import { indent, q, unique, type EmitContext } from './context';
import { patternTest } from './patterns';
import { blockLines } from './statements';
import { concatenatesNatively, defaultValue, isCollectionMethod, isIntegral, isNumeric, isPrimitiveComparable, typeOperand } from './types';
import { containsAwait, expressionHoists, isInitializer, patternJsNames } from './walk';
interface Operand {
    readonly text: string;
    readonly type: StaticType | undefined;
}
interface LValue {
    readonly simple: boolean;
    readonly read: string;
    write(value: string): string;
    wrap(body: string): string;
}
const COMPARISON: Readonly<Record<string, string>> = { '<': 'lt', '>': 'gt', '<=': 'le', '>=': 'ge' };
const ITEM_COLLECTIONS: ReadonlySet<string> = new Set(['List', 'HashSet', 'Queue', 'Stack']);
function lowerFirst(name: string): string {
    return name.length > 0 ? name.charAt(0).toLowerCase() + name.slice(1) : name;
}
function numberText(value: number): string {
    if (Number.isNaN(value))
        return 'NaN';
    if (!Number.isFinite(value))
        return value > 0 ? 'Infinity' : '-Infinity';
    return Object.is(value, -0) ? '-0' : String(value);
}
export function findMember(cls: ClassInfo, name: string): MemberInfo | null {
    for (let current: ClassInfo | null = cls; current; current = current.base) {
        const list = current.members.get(name);
        if (list && list.length > 0)
            return list[0];
    }
    return null;
}
export function expression(ctx: EmitContext, e: Expression): string {
    switch (e.kind) {
        case 'literal':
            switch (e.literalType) {
                case 'null':
                    return 'null';
                case 'bool':
                    return e.value ? 'true' : 'false';
                case 'string':
                case 'char':
                    return q(String(e.value));
                default:
                    return numberText(e.value as number);
            }
        case 'identifier':
            return identifier(ctx, e);
        case 'this':
            return 'this';
        case 'base':
            return 'super';
        case 'member':
            return member(ctx, e);
        case 'element':
            return element(ctx, e);
        case 'call':
            return call(ctx, e);
        case 'new':
            return construction(ctx, e);
        case 'anonymous':
            return `({ ${e.members.map((entry) => `${entry.name}: ${expression(ctx, entry.value)}`).join(', ')} })`;
        case 'array':
            return array(ctx, e);
        case 'lambda':
            return lambda(ctx, e);
        case 'unary':
            return unary(ctx, e, false);
        case 'binary':
            return binary(ctx, e);
        case 'assign':
            return assignment(ctx, e);
        case 'conditional':
            return `(${truthy(ctx, e.condition)} ? ${expression(ctx, e.whenTrue)} : ${expression(ctx, e.whenFalse)})`;
        case 'cast':
            return cast(ctx, e);
        case 'is':
            return withValue(ctx, e.expression, (value) => patternTest(ctx, e.pattern, value, e.expression.staticType));
        case 'as':
            return `$.as(${expression(ctx, e.expression)}, ${typeOperand(ctx, e.staticType)})`;
        case 'typeof':
            return `$.typeOf(${typeOperand(ctx, e.operandType)})`;
        case 'nameof':
            return q(e.name);
        case 'default':
            return defaultValue(ctx, e.staticType);
        case 'await':
            return `(await ${expression(ctx, e.expression)})`;
        case 'throwExpression':
            return `$.throwValue(${expression(ctx, e.expression)})`;
        case 'interpolated':
            return interpolated(ctx, e);
        case 'tuple': {
            const names = e.elements.map((element) => element.name);
            const values = e.elements.map((element) => expression(ctx, element.value)).join(', ');
            return names.some(Boolean) ? `$.tuple([${values}], [${names.map((name) => (name ? q(name) : 'null')).join(', ')}])` : `$.tuple([${values}])`;
        }
        case 'switchExpression':
            return switchExpression(ctx, e);
        case 'range':
            return `({ Start: ${e.start ? expression(ctx, e.start) : '0'}, End: ${e.end ? expression(ctx, e.end) : 'null'} })`;
        case 'fromEnd':
            return `({ FromEnd: true, Value: ${expression(ctx, e.operand)} })`;
    }
}
export function statementExpression(ctx: EmitContext, e: Expression): string {
    if (e.kind === 'unary' && (e.operator === '++' || e.operator === '--'))
        return unary(ctx, e, true);
    const text = expression(ctx, e);
    if (e.kind === 'call') {
        const kind = e.staticType?.kind;
        if (kind === 'task' || kind === 'dynamic' || kind === 'engine')
            return `$.detach(${text})`;
    }
    return text;
}
export function truthy(ctx: EmitContext, e: Expression): string {
    const text = expression(ctx, e);
    return e.staticType?.kind === 'bool' ? text : `$.truthy(${text})`;
}
export function parameterList(ctx: EmitContext, parameters: readonly Parameter[]): string {
    return parameters
        .map((parameter) => {
        const name = parameter.jsName ?? parameter.name;
        if (parameter.modifier === 'params')
            return `...${name}`;
        return parameter.defaultValue ? `${name} = ${expression(ctx, parameter.defaultValue)}` : name;
    })
        .join(', ');
}
export function expressionBodyLines(ctx: EmitContext, e: Expression, isVoid: boolean): string[] {
    const hoists = unique(expressionHoists(e).map((hoist) => hoist.jsName));
    const lines = hoists.length > 0 ? [`let ${hoists.join(', ')};`] : [];
    lines.push(isVoid ? `${statementExpression(ctx, e)};` : `return ${expression(ctx, e)};`);
    return lines;
}
function isSimpleReference(e: Expression): boolean {
    switch (e.kind) {
        case 'this':
        case 'literal':
            return true;
        case 'identifier':
            return e.resolution?.kind === 'local' ? !e.resolution.byRef : e.resolution?.kind === 'member';
        case 'member':
            return e.resolution?.kind === 'direct' && !e.nullConditional && !e.bindThis && isSimpleReference(e.target);
        default:
            return false;
    }
}
function withValue(ctx: EmitContext, e: Expression, build: (value: string) => string): string {
    if (isSimpleReference(e))
        return build(expression(ctx, e));
    const temp = ctx.nextTemp('t');
    return `((${temp}) => ${build(temp)})(${expression(ctx, e)})`;
}
function identifier(ctx: EmitContext, e: Expression & {
    kind: 'identifier';
}): string {
    const resolution = e.resolution;
    switch (resolution?.kind) {
        case 'local':
            return resolution.byRef ? `${resolution.jsName}.v` : resolution.jsName;
        case 'member':
            if (resolution.isStatic)
                return `${ctx.typeReference(resolution.owner, resolution.ownerIsSibling)}.${resolution.jsName}`;
            return e.bindThis ? `$.bound(this, ${q(resolution.jsName)})` : `this.${resolution.jsName}`;
        case 'type':
            return ctx.typeReference(resolution.jsName, resolution.sibling);
        case 'runtimeType':
        case 'runtimeStatic':
            return `$.${resolution.name}`;
        case 'engine':
            return 'helix';
        case 'direct':
            return resolution.jsName;
        default:
            return e.name;
    }
}
function member(ctx: EmitContext, e: Expression & {
    kind: 'member';
}): string {
    const resolution = e.resolution;
    switch (resolution?.kind) {
        case 'member':
            return `${ctx.typeReference(resolution.owner, resolution.ownerIsSibling)}.${resolution.jsName}`;
        case 'type':
            return ctx.typeReference(resolution.jsName, resolution.sibling);
        case 'enumMember':
            return `${ctx.typeReference(resolution.enumName, resolution.sibling)}.${e.name}`;
        case 'direct': {
            if (e.target.kind === 'base')
                return `super.${resolution.jsName}`;
            const target = expression(ctx, e.target);
            if (e.bindThis)
                return `$.bound(${target}, ${q(resolution.jsName)})`;
            return `${target}${e.nullConditional ? '?.' : '.'}${resolution.jsName}`;
        }
        default:
            return `$.get(${expression(ctx, e.target)}, ${q(e.name)}${e.nullConditional ? ', true' : ''})`;
    }
}
function indexKey(ctx: EmitContext, key: Expression, target: string): string {
    return key.kind === 'fromEnd' ? `$.fromEnd(${target}, ${expression(ctx, key.operand)})` : expression(ctx, key);
}
function indexRead(targetType: StaticType | undefined, target: string, keys: readonly string[]): string {
    if (targetType?.kind === 'collection')
        return `${target}.$at(${keys.join(', ')})`;
    return `$.at(${target}, ${keys.join(', ')})`;
}
function element(ctx: EmitContext, e: Expression & {
    kind: 'element';
}): string {
    const keys = e.arguments.map((argument) => argument.expression);
    const range = keys.length === 1 && keys[0].kind === 'range' ? keys[0] : null;
    if (range) {
        return withValue(ctx, e.target, (target) => `$.slice(${target}, ${range.start ? indexKey(ctx, range.start, target) : 'null'}, ${range.end ? indexKey(ctx, range.end, target) : 'null'})`);
    }
    const needsTarget = e.nullConditional || keys.some((key) => key.kind === 'fromEnd');
    const build = (target: string) => {
        const read = indexRead(e.target.staticType, target, keys.map((key) => indexKey(ctx, key, target)));
        return e.nullConditional ? `(${target} == null ? null : ${read})` : read;
    };
    return needsTarget ? withValue(ctx, e.target, build) : build(expression(ctx, e.target));
}
function argumentText(ctx: EmitContext, argument: Argument, spread: boolean): string {
    if (argument.modifier === 'out' || argument.modifier === 'ref')
        return refArgument(ctx, argument.expression);
    const text = expression(ctx, argument.expression);
    return spread ? `...${text}` : text;
}
function argumentList(ctx: EmitContext, args: readonly Argument[], order?: readonly number[], spreadLast?: boolean): string {
    const texts = args.map((argument, index) => argumentText(ctx, argument, Boolean(spreadLast) && index === args.length - 1));
    if (!order)
        return texts.join(', ');
    const slots: string[] = [];
    order.forEach((slot, index) => {
        slots[slot] = texts[index];
    });
    for (let index = 0; index < slots.length; index++)
        if (slots[index] === undefined)
            slots[index] = 'undefined';
    return slots.join(', ');
}
function refArgument(ctx: EmitContext, target: Expression): string {
    if (target.kind === 'identifier' && target.resolution?.kind === 'local' && target.resolution.byRef)
        return target.resolution.jsName;
    const target$ = lvalue(ctx, target);
    const value = ctx.nextTemp('v');
    return target$.wrap(`$.ref(() => ${target$.read}, (${value}) => ${target$.write(value)})`);
}
