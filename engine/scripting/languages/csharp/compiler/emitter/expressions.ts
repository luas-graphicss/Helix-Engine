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
function call(ctx: EmitContext, e: CallExpression): string {
    const mark = ctx.mark(e.span);
    const { target } = e;
    const args = () => argumentList(ctx, e.arguments, e.argumentOrder, e.spreadLast);
    if (target.kind === 'member') {
        const receiver = target.target;
        const receiverType = receiver.staticType;
        if (target.name === 'ToString' && e.arguments.length === 0 && receiverType?.kind === 'enum')
            return `${mark}$.enumStr(${typeOperand(ctx, receiverType)}, ${expression(ctx, receiver)})`;
        const resolution = target.resolution;
        const optional = target.nullConditional ? ', true' : '';
        if (resolution?.kind === 'member')
            return `${mark}${ctx.typeReference(resolution.owner, resolution.ownerIsSibling)}.${resolution.jsName}(${args()})`;
        if (resolution?.kind === 'direct') {
            if (receiver.kind === 'base')
                return `${mark}super.${resolution.jsName}(${args()})`;
            if (receiverType?.kind === 'collection' && !isCollectionMethod(receiverType.name, resolution.jsName)) {
                return `${mark}$.call(${expression(ctx, receiver)}, ${q(resolution.jsName)}, [${args()}]${optional})`;
            }
            return `${mark}${expression(ctx, receiver)}${target.nullConditional ? '?.' : '.'}${resolution.jsName}(${args()})`;
        }
        return `${mark}$.call(${expression(ctx, receiver)}, ${q(target.name)}, [${args()}]${optional})`;
    }
    if (target.kind === 'identifier') {
        const resolution = target.resolution;
        if (resolution?.kind === 'member') {
            const callee = resolution.isStatic ? `${ctx.typeReference(resolution.owner, resolution.ownerIsSibling)}.${resolution.jsName}` : `this.${resolution.jsName}`;
            return resolution.memberKind === 'method' ? `${mark}${callee}(${args()})` : `${mark}$.invoke(${callee}, [${args()}])`;
        }
        if (resolution?.kind === 'local') {
            const callee = resolution.byRef ? `${resolution.jsName}.v` : resolution.jsName;
            return target.staticType?.kind === 'delegate' ? `${mark}${callee}(${args()})` : `${mark}$.invoke(${callee}, [${args()}])`;
        }
        return `${mark}$.invoke(${identifier(ctx, target)}, [${args()}])`;
    }
    const callee = expression(ctx, target);
    return target.staticType?.kind === 'delegate' ? `${mark}(${callee})(${args()})` : `${mark}$.invoke(${callee}, [${args()}])`;
}
function construction(ctx: EmitContext, e: NewExpression): string {
    const mark = ctx.mark(e.span);
    const construction$ = e.construction;
    if (construction$?.kind === 'options' && e.initializer)
        return `${mark}${optionsValue(ctx, e.initializer)}`;
    const args = argumentList(ctx, e.arguments);
    let created: string;
    switch (construction$?.kind) {
        case 'script':
            created = `new ${ctx.typeReference(construction$.name, construction$.sibling)}().${construction$.ctorJsName}(${args})`;
            break;
        case 'runtime':
            created = RUNTIME_FACTORIES.has(construction$.name) ? `$.${construction$.name}(${args})` : `new $.${construction$.name}(${args})`;
            break;
        default:
            created = `$.construct(${q(construction$?.kind === 'dynamic' ? construction$.name : (e.type?.name ?? '?'))}, [${args}])`;
    }
    if (!e.initializer)
        return `${mark}${created}`;
    const items = e.initializer.kind === 'collection' ? e.initializer.elements : null;
    if (construction$?.kind === 'runtime' && ITEM_COLLECTIONS.has(construction$.name) && items && e.arguments.length === 0 && items.every((item) => !Array.isArray(item))) {
        return `${mark}new $.${construction$.name}([${items.map((item) => expression(ctx, item as Expression)).join(', ')}])`;
    }
    const target = ctx.nextTemp('o');
    const lines = initializerLines(ctx, target, e.initializer, e.staticType);
    return `${mark}((${target}) => {\n${indent([...lines, `return ${target};`]).join('\n')}\n})(${created})`;
}
function initializerLines(ctx: EmitContext, target: string, initializer: Initializer, type: StaticType | undefined): string[] {
    if (initializer.kind === 'collection') {
        return initializer.elements.map((element) => {
            const items = (Array.isArray(element) ? (element as readonly Expression[]) : [element as Expression]).map((item) => expression(ctx, item)).join(', ');
            return type?.kind === 'collection' ? `${target}.Add(${items});` : `$.call(${target}, "Add", [${items}]);`;
        });
    }
    const cls = ctx.classOfType(type);
    const lines: string[] = [];
    for (const entry of initializer.entries) {
        if (entry.kind === 'index') {
            lines.push(`$.setAt(${target}, [${entry.arguments.map((argument) => expression(ctx, argument.expression)).join(', ')}], ${expression(ctx, entry.value)});`);
            continue;
        }
        const member$ = cls ? findMember(cls, entry.name) : null;
        if (isInitializer(entry.value)) {
            const nested = ctx.nextTemp('o');
            const read = member$ ? `${target}.${member$.jsName}` : `$.get(${target}, ${q(entry.name)})`;
            lines.push('{', ...indent([`const ${nested} = ${read};`, ...initializerLines(ctx, nested, entry.value, member$?.type)]), '}');
            continue;
        }
        const value = expression(ctx, entry.value);
        lines.push(member$ ? `${target}.${member$.jsName} = ${value};` : `$.set(${target}, ${q(entry.name)}, ${value});`);
    }
    return lines;
}
function optionsValue(ctx: EmitContext, value: Expression | Initializer): string {
    if (!isInitializer(value))
        return expression(ctx, value);
    if (value.kind === 'collection') {
        return `[${value.elements.map((element) => (Array.isArray(element) ? `[${(element as readonly Expression[]).map((item) => expression(ctx, item)).join(', ')}]` : expression(ctx, element as Expression))).join(', ')}]`;
    }
    const entries = value.entries.map((entry) => {
        if (entry.kind === 'index')
            return `[${expression(ctx, entry.arguments[0].expression)}]: ${expression(ctx, entry.value)}`;
        return `${lowerFirst(entry.name)}: ${optionsValue(ctx, entry.value)}`;
    });
    return `({ ${entries.join(', ')} })`;
}
function array(ctx: EmitContext, e: Expression & {
    kind: 'array';
}): string {
    if (e.elements)
        return `[${e.elements.map((item) => expression(ctx, item)).join(', ')}]`;
    let element = e.staticType;
    for (let level = 0; level < e.sizes.length && element?.kind === 'array'; level++)
        element = element.element;
    return `$.newArray([${e.sizes.map((size) => expression(ctx, size)).join(', ')}], ${defaultValue(ctx, element)})`;
}
function lambda(ctx: EmitContext, e: LambdaExpression): string {
    const head = `${ctx.mark(e.span)}${e.isAsync || e.needsAsync ? 'async ' : ''}(${parameterList(ctx, e.parameters)}) => `;
    if (e.body.kind === 'block')
        return `${head}{\n${indent(blockLines(ctx, e.body)).join('\n')}\n}`;
    const hoists = unique(expressionHoists(e.body).map((hoist) => hoist.jsName));
    const body = expression(ctx, e.body);
    if (hoists.length === 0)
        return `${head}(${body})`;
    return `${head}{\n${indent([`let ${hoists.join(', ')};`, `return ${body};`]).join('\n')}\n}`;
}
function operand(ctx: EmitContext, e: Expression): Operand {
    return { text: expression(ctx, e), type: e.staticType };
}
function numericText(value: Operand): string {
    return value.type?.kind === 'char' ? `$.charCode(${value.text})` : value.text;
}
function stringPart(ctx: EmitContext, value: Operand): string {
    return value.type?.kind === 'enum' ? `$.enumStr(${typeOperand(ctx, value.type)}, ${value.text})` : value.text;
}
function arithmetic(ctx: EmitContext, operator: string, runtime: string, left: Operand, right: Operand): string {
    if (isNumeric(left.type) && isNumeric(right.type))
        return `(${numericText(left)} ${operator} ${numericText(right)})`;
    return `$.${runtime}(${left.text}, ${right.text})`;
}
export function binaryText(ctx: EmitContext, operator: BinaryOperator, left: Operand, right: Operand): string {
    switch (operator) {
        case '+':
            if (left.type?.kind === 'string' || right.type?.kind === 'string') {
                const other = left.type?.kind === 'string' ? right : left;
                if (concatenatesNatively(other.type))
                    return `(${left.text} + ${right.text})`;
                return `$.concat(${stringPart(ctx, left)}, ${stringPart(ctx, right)})`;
            }
            if (left.type?.kind === 'delegate' || right.type?.kind === 'delegate')
                return `$.combine(${left.text}, ${right.text})`;
            return arithmetic(ctx, '+', 'add', left, right);
        case '-':
            if (left.type?.kind === 'delegate' || right.type?.kind === 'delegate')
                return `$.remove(${left.text}, ${right.text})`;
            return arithmetic(ctx, '-', 'sub', left, right);
        case '*':
            return arithmetic(ctx, '*', 'mul', left, right);
        case '/':
            if (isIntegral(left.type) && isIntegral(right.type))
                return `$.idiv(${numericText(left)}, ${numericText(right)})`;
            return arithmetic(ctx, '/', 'div', left, right);
        case '%':
            if (isIntegral(left.type) && isIntegral(right.type))
                return `$.irem(${numericText(left)}, ${numericText(right)})`;
            return arithmetic(ctx, '%', 'rem', left, right);
        case '==':
        case '!=': {
            const negated = operator === '!=';
            if (left.type?.kind === 'null' || right.type?.kind === 'null')
                return `(${left.text} ${negated ? '!=' : '=='} ${right.text})`;
            if (isPrimitiveComparable(left.type) && isPrimitiveComparable(right.type))
                return `(${left.text} ${negated ? '!==' : '==='} ${right.text})`;
            return `$.${negated ? 'neq' : 'eq'}(${left.text}, ${right.text})`;
        }
        case '<':
        case '>':
        case '<=':
        case '>=':
            if (isNumeric(left.type) && isNumeric(right.type))
                return `(${numericText(left)} ${operator} ${numericText(right)})`;
            return `$.${COMPARISON[operator]}(${left.text}, ${right.text})`;
        case '&':
        case '|':
        case '^':
            if (left.type?.kind === 'bool' && right.type?.kind === 'bool')
                return `!!(${left.text} ${operator} ${right.text})`;
            return `(${numericText(left)} ${operator} ${numericText(right)})`;
        case '<<':
        case '>>':
            return `(${numericText(left)} ${operator} ${numericText(right)})`;
        case '&&':
        case '||':
            return `(${left.text} ${operator} ${right.text})`;
        case '??':
            return `(${left.text} ?? ${right.text})`;
    }
}
function binary(ctx: EmitContext, e: Expression & {
    kind: 'binary';
}): string {
    if (e.operator === '&&' || e.operator === '||')
        return `(${truthy(ctx, e.left)} ${e.operator} ${truthy(ctx, e.right)})`;
    return binaryText(ctx, e.operator, operand(ctx, e.left), operand(ctx, e.right));
}
function unary(ctx: EmitContext, e: Expression & {
    kind: 'unary';
}, discard: boolean): string {
    switch (e.operator) {
        case '!':
            return `!${truthy(ctx, e.operand)}`;
        case '-': {
            const value = operand(ctx, e.operand);
            return isNumeric(value.type) ? `(-${numericText(value)})` : `$.neg(${value.text})`;
        }
        case '+': {
            const value = operand(ctx, e.operand);
            return isNumeric(value.type) ? `(+${numericText(value)})` : value.text;
        }
        case '~':
            return `(~${numericText(operand(ctx, e.operand))})`;
        case '++':
        case '--':
            return increment(ctx, e, discard);
    }
}
function increment(ctx: EmitContext, e: Expression & {
    kind: 'unary';
}, discard: boolean): string {
    const target = lvalue(ctx, e.operand);
    const type = e.operand.staticType;
    const prefix = e.prefix || discard;
    if (target.simple && isNumeric(type) && type?.kind !== 'char')
        return target.wrap(prefix ? `${e.operator}${target.read}` : `${target.read}${e.operator}`);
    const step: BinaryOperator = e.operator === '++' ? '+' : '-';
    const one: Operand = { text: '1', type: STATIC_TYPES.int };
    const updated = (current: string) => {
        const sum = binaryText(ctx, step, { text: current, type }, one);
        return type?.kind === 'char' ? `$.toChar(${sum})` : sum;
    };
    if (prefix)
        return target.wrap(target.write(updated(target.read)));
    const previous = ctx.nextTemp('o');
    return target.wrap(`((${previous}) => (${target.write(updated(previous))}, ${previous}))(${target.read})`);
}
function plainTarget(read: string): LValue {
    return { simple: true, read, write: (value) => `${read} = ${value}`, wrap: (body) => body };
}
function withTemps(ctx: EmitContext, parts: readonly Expression[], build: (texts: string[]) => LValue): LValue {
    const texts = parts.map((part) => expression(ctx, part));
    const params: string[] = [];
    const args: string[] = [];
    const names = parts.map((part, index) => {
        if (isSimpleReference(part))
            return texts[index];
        const temp = ctx.nextTemp('t');
        params.push(temp);
        args.push(texts[index]);
        return temp;
    });
    const target = build(names);
    if (params.length === 0)
        return target;
    return { ...target, wrap: (body) => `((${params.join(', ')}) => ${body})(${args.join(', ')})` };
}
function lvalue(ctx: EmitContext, target: Expression): LValue {
    switch (target.kind) {
        case 'identifier':
            return plainTarget(identifier(ctx, target));
        case 'member': {
            const resolution = target.resolution;
            if (resolution?.kind === 'member')
                return plainTarget(`${ctx.typeReference(resolution.owner, resolution.ownerIsSibling)}.${resolution.jsName}`);
            if (resolution?.kind === 'direct') {
                if (target.target.kind === 'base')
                    return plainTarget(`super.${resolution.jsName}`);
                return withTemps(ctx, [target.target], ([object]) => plainTarget(`${object}.${resolution.jsName}`));
            }
            return withTemps(ctx, [target.target], ([object]) => ({
                simple: false,
                read: `$.get(${object}, ${q(target.name)})`,
                write: (value) => `$.set(${object}, ${q(target.name)}, ${value})`,
                wrap: (body) => body,
            }));
        }
        case 'element': {
            const keys = target.arguments.map((argument) => argument.expression);
            const fixed = keys.filter((key) => key.kind !== 'fromEnd');
            return withTemps(ctx, [target.target, ...fixed], ([object, ...names]) => {
                let next = 0;
                const keyTexts = keys.map((key) => (key.kind === 'fromEnd' ? indexKey(ctx, key, object) : names[next++]));
                return {
                    simple: false,
                    read: indexRead(target.target.staticType, object, keyTexts),
                    write: (value) => `$.setAt(${object}, [${keyTexts.join(', ')}], ${value})`,
                    wrap: (body) => body,
                };
            });
        }
        default:
            return plainTarget(expression(ctx, target));
    }
}
function nativeCompound(operator: BinaryOperator, left: StaticType | undefined, right: StaticType | undefined): boolean {
    const plainNumber = (type: StaticType | undefined) => type !== undefined && (type.kind === 'int' || type.kind === 'float' || type.kind === 'enum');
    switch (operator) {
        case '+':
            if (left?.kind === 'string')
                return concatenatesNatively(right);
            return plainNumber(left) && plainNumber(right);
        case '-':
        case '*':
            return plainNumber(left) && plainNumber(right);
        case '/':
        case '%':
            return plainNumber(left) && plainNumber(right) && (left?.kind === 'float' || right?.kind === 'float');
        case '&':
        case '|':
        case '^':
        case '<<':
        case '>>':
            return isIntegral(left) && isIntegral(right) && left?.kind !== 'char' && right?.kind !== 'char';
        default:
            return false;
    }
}
function assignment(ctx: EmitContext, e: Expression & {
    kind: 'assign';
}): string {
    if (e.target.kind === 'tuple') {
        const targets = e.target.elements.map((element) => lvalue(ctx, element.value));
        const parts = ctx.nextTemp('d');
        const writes = targets.map((target, index) => target.wrap(target.write(`${parts}[${index}]`)));
        return `((${parts}) => (${writes.join(', ')}, ${parts}))($.deconstruct(${expression(ctx, e.value)}, ${targets.length}))`;
    }
    const target = lvalue(ctx, e.target);
    const value = expression(ctx, e.value);
    if (e.operator === '=')
        return target.wrap(target.write(value));
    if (e.operator === '??=')
        return target.wrap(target.simple ? `(${target.read} ??= ${value})` : `(${target.read} ?? ${target.write(value)})`);
    const operator = e.operator.slice(0, -1) as BinaryOperator;
    const left: Operand = { text: target.read, type: e.target.staticType };
    const right: Operand = { text: value, type: e.value.staticType };
    if (target.simple && nativeCompound(operator, left.type, right.type))
        return target.wrap(`(${target.read} ${e.operator} ${value})`);
    return target.wrap(target.write(binaryText(ctx, operator, left, right)));
}
function cast(ctx: EmitContext, e: Expression & {
    kind: 'cast';
}): string {
    const target = e.staticType;
    const source = e.expression.staticType;
    const text = expression(ctx, e.expression);
    switch (target?.kind) {
        case 'int':
            if (source?.kind === 'int' || source?.kind === 'enum')
                return text;
            if (source?.kind === 'char')
                return `$.charCode(${text})`;
            return `$.toInt(${text})`;
        case 'float':
            if (source?.kind === 'int' || source?.kind === 'float' || source?.kind === 'enum')
                return text;
            return `$.toFloat(${text})`;
        case 'char':
            return source?.kind === 'char' ? text : `$.toChar(${text})`;
        case 'enum':
            return source?.kind === 'int' || source?.kind === 'enum' ? text : `$.cast(${text}, ${typeOperand(ctx, target)})`;
        case 'bool':
        case 'string':
        case 'class':
        case 'collection':
        case 'array':
            return `$.cast(${text}, ${typeOperand(ctx, target)})`;
        default:
            return text;
    }
}
function templateText(text: string): string {
    return q(text).slice(1, -1).replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
}
function interpolated(ctx: EmitContext, e: Expression & {
    kind: 'interpolated';
}): string {
    let out = '`';
    for (const part of e.parts) {
        if (part.kind === 'text') {
            out += templateText(part.value);
            continue;
        }
        const value = operand(ctx, part.expression);
        const base = value.type?.kind === 'enum' ? stringPart(ctx, value) : value.text;
        const formatted = part.format !== null || part.alignment !== null ? `$.fmt(${base}, ${part.format !== null ? q(part.format) : 'null'}, ${part.alignment ?? 'null'})` : `$.str(${base})`;
        out += '${' + formatted + '}';
    }
    return out + '`';
}
function switchExpression(ctx: EmitContext, e: Expression & {
    kind: 'switchExpression';
}): string {
    const value = ctx.nextTemp('v');
    const bindings = unique(e.arms.flatMap((arm) => patternJsNames(arm.pattern)));
    const arms = e.arms
        .map((arm) => {
        const test = patternTest(ctx, arm.pattern, value, e.value.staticType);
        const condition = arm.guard ? `(${test} && ${truthy(ctx, arm.guard)})` : test;
        return `${condition} ? ${expression(ctx, arm.result)} : `;
    })
        .join('');
    const body = `${arms}$.noMatch(${value})`;
    const params = [value, ...bindings].join(', ');
    const isAsync = e.arms.some((arm) => containsAwait(arm.result) || (arm.guard !== null && containsAwait(arm.guard)));
    const source = expression(ctx, e.value);
    return isAsync ? `(await (async (${params}) => ${body})(${source}))` : `((${params}) => ${body})(${source})`;
}
