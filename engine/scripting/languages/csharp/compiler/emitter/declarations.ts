import { EXCEPTION_TYPES } from '../../runtime/errors';
import type { ClassInfo, EnumInfo } from '../analyzer';
import type { Accessor, ConstructorMember, IndexerMember, Member, MethodMember, PropertyMember } from '../ast';
import { CONSTRUCTOR_SCOPE, INSTANCE_SCOPE, STATIC_SCOPE, indent, q, type EmitContext, type FunctionScope } from './context';
import { expression, expressionBodyLines, findMember, parameterList, statementExpression } from './expressions';
import { blockLines } from './statements';
import { defaultValue } from './types';
export function enumLines(ctx: EmitContext, info: EnumInfo): string[] {
    const entries = Array.from(info.values, ([name, value]) => `${q(name)}: ${value}`);
    return [`${ctx.mark(info.decl.span)}const ${info.jsName} = $.enum(${q(info.name)}, { ${entries.join(', ')} }${isFlagsEnum(info) ? ', true' : ''});`];
}
function isFlagsEnum(info: EnumInfo): boolean {
    if (info.decl.members.length < 2 || info.decl.members.some((member) => member.value === null))
        return false;
    const values = Array.from(info.values.values());
    return values.every((value) => value === 0 || (value > 0 && (value & (value - 1)) === 0)) && new Set(values).size === values.length && values.some((value) => value >= 2);
}
export function classLines(ctx: EmitContext, cls: ClassInfo): string[] {
    return ctx.withClass(cls, () => {
        const base = baseReference(ctx, cls);
        const body = [...javascriptConstructorLines(ctx, cls, base), ...constructorLines(ctx, cls)];
        for (const member of cls.decl.members)
            body.push(...memberLines(ctx, cls, member));
        return [`${ctx.mark(cls.decl.span)}class ${cls.jsName}${base ? ` extends ${base}` : ''} {`, ...indent(body), '}', `$.defineClass(${cls.jsName}, ${classInfoLiteral(cls)});`];
    });
}
function baseReference(ctx: EmitContext, cls: ClassInfo): string | null {
    if (cls.base)
        return ctx.typeReference(cls.base.jsName, cls.base.script);
    return cls.baseRuntime ? `$.${cls.baseRuntime}` : null;
}
function isActorClass(cls: ClassInfo): boolean {
    for (let current: ClassInfo | null = cls; current; current = current.base)
        if (current.isActor || current.baseRuntime === 'ActorScript')
            return true;
    return false;
}
function baseAcceptsInject(cls: ClassInfo): boolean {
    return cls.base !== null || cls.baseRuntime === 'ActorScript';
}
function classInfoLiteral(cls: ClassInfo): string {
    const record = cls.recordFields && cls.recordFields.length > 0 ? `[${cls.recordFields.map(q).join(', ')}]` : 'null';
    return `{ name: ${q(cls.name)}, isMain: ${cls.isMain}, isActor: ${isActorClass(cls)}, isStatic: ${cls.isStatic}, flavor: ${q(cls.flavor)}, record: ${record} }`;
}
function isStaticMember(cls: ClassInfo, modifiers: readonly string[]): boolean {
    return cls.isStatic || modifiers.includes('static') || modifiers.includes('const');
}
function hasBody(accessor: Accessor | null): boolean {
    return accessor !== null && (accessor.body !== null || accessor.expressionBody !== null);
}
function isAutoProperty(property: PropertyMember): boolean {
    return property.expressionBody === null && !hasBody(property.getter) && !hasBody(property.setter);
}
function memberJsName(cls: ClassInfo, name: string): string {
    return findMember(cls, name)?.jsName ?? name;
}
function javascriptConstructorLines(ctx: EmitContext, cls: ClassInfo, base: string | null): string[] {
    const initializers = ctx.withFunction(INSTANCE_SCOPE, () => instanceInitializerLines(ctx, cls));
    if (!base && initializers.length === 0)
        return [];
    const accepts = base !== null && baseAcceptsInject(cls);
    const body = base ? [accepts ? 'super($inject);' : 'super();', ...initializers] : initializers;
    return [`constructor(${accepts ? '$inject' : ''}) {`, ...indent(body), '}'];
}
function instanceInitializerLines(ctx: EmitContext, cls: ClassInfo): string[] {
    const lines: string[] = [];
    for (const member of cls.decl.members) {
        if ((member.kind === 'field' || member.kind === 'event') && !isStaticMember(cls, member.modifiers)) {
            for (const declarator of member.declarators) {
                const value = declarator.initializer ? expression(ctx, declarator.initializer) : member.kind === 'event' ? 'null' : defaultValue(ctx, declarator.staticType);
                lines.push(`${ctx.mark(declarator.span)}this.${declarator.jsName ?? declarator.name} = ${value};`);
            }
        }
        if (member.kind === 'property' && isAutoProperty(member) && !isStaticMember(cls, member.modifiers)) {
            const info = findMember(cls, member.name);
            const value = member.initializer ? expression(ctx, member.initializer) : defaultValue(ctx, info?.type);
            lines.push(`${ctx.mark(member.nameSpan)}this.${info?.jsName ?? member.name} = ${value};`);
        }
    }
    return lines;
}
function constructorName(cls: ClassInfo, arity: number): string {
    const exact = cls.ctors.find((ctor) => ctor.params.length === arity);
    if (exact)
        return exact.jsName;
    const flexible = cls.ctors.find((ctor) => {
        const required = ctor.params.filter((parameter) => !parameter.hasDefault && parameter.modifier !== 'params').length;
        return arity >= required && (arity <= ctor.params.length || ctor.params.some((parameter) => parameter.modifier === 'params'));
    });
    return flexible?.jsName ?? '$ctor';
}
function chainLines(ctx: EmitContext, cls: ClassInfo, initializer: ConstructorMember['initializer']): string[] {
    const args = initializer ? initializer.arguments.map((argument) => expression(ctx, argument.expression)) : [];
    if (initializer?.kind === 'this')
        return [`this.${constructorName(cls, args.length)}(${args.join(', ')});`];
    if (cls.base)
        return [`super.${constructorName(cls.base, args.length)}(${args.join(', ')});`];
    if (cls.baseRuntime === 'ActorScript')
        return ['super.$ctor();'];
    if (cls.baseRuntime && cls.baseRuntime in EXCEPTION_TYPES && args.length > 0) {
        const lines = [`this.message = $.str(${args[0]});`];
        if (args.length > 1)
            lines.push(`this.InnerException = ${args[1]};`);
        return lines;
    }
    return [];
}
function constructorLines(ctx: EmitContext, cls: ClassInfo): string[] {
    const lines: string[] = [];
    const explicit = cls.decl.members.filter((member): member is ConstructorMember => member.kind === 'constructor' && !member.modifiers.includes('static'));
    const primary = cls.recordFields && cls.decl.recordParameters ? cls.decl.recordParameters : null;
    if (primary) {
        const jsName = cls.ctors.find((ctor) => ctor.decl === null)?.jsName ?? '$ctor$record';
        const assignments = primary.map((parameter) => `this.${memberJsName(cls, parameter.name)} = ${parameter.jsName ?? parameter.name};`);
        lines.push(`${jsName}(${parameterList(ctx, primary)}) {`, ...indent([...chainLines(ctx, cls, null), ...assignments, 'return this;']), '}');
    }
    else if (explicit.length === 0) {
        lines.push('$ctor() {', ...indent([...chainLines(ctx, cls, null), 'return this;']), '}');
    }
    for (const ctor of explicit) {
        lines.push(...ctx.withFunction(CONSTRUCTOR_SCOPE, () => {
            const body = ctor.body ? blockLines(ctx, ctor.body) : ctor.expressionBody ? [`${statementExpression(ctx, ctor.expressionBody)};`] : [];
            return [`${ctx.mark(ctor.span)}${ctor.jsName ?? '$ctor'}(${parameterList(ctx, ctor.parameters)}) {`, ...indent([...chainLines(ctx, cls, ctor.initializer), ...body, 'return this;']), '}'];
        }));
    }
    return lines;
}
function memberLines(ctx: EmitContext, cls: ClassInfo, member: Member): string[] {
    switch (member.kind) {
        case 'property':
            return isAutoProperty(member) ? [] : propertyLines(ctx, cls, member);
        case 'indexer':
            return indexerLines(ctx, member);
        case 'method':
            return methodLines(ctx, cls, member);
        case 'constructor':
            return member.modifiers.includes('static') ? staticConstructorLines(ctx, member) : [];
        default:
            return [];
    }
}
function accessorBody(ctx: EmitContext, accessor: Accessor, isSetter: boolean): string[] {
    if (accessor.body)
        return blockLines(ctx, accessor.body);
    return accessor.expressionBody ? expressionBodyLines(ctx, accessor.expressionBody, isSetter) : [];
}
function propertyLines(ctx: EmitContext, cls: ClassInfo, property: PropertyMember): string[] {
    const isStatic = isStaticMember(cls, property.modifiers);
    const scope: FunctionScope = isStatic ? STATIC_SCOPE : INSTANCE_SCOPE;
    const prefix = isStatic ? 'static ' : '';
    const jsName = memberJsName(cls, property.name);
    return ctx.withFunction(scope, () => {
        const lines: string[] = [];
        if (property.expressionBody) {
            lines.push(`${ctx.mark(property.nameSpan)}${prefix}get ${jsName}() {`, ...indent(expressionBodyLines(ctx, property.expressionBody, false)), '}');
            return lines;
        }
        if (property.getter && hasBody(property.getter))
            lines.push(`${ctx.mark(property.getter.span)}${prefix}get ${jsName}() {`, ...indent(accessorBody(ctx, property.getter, false)), '}');
        if (property.setter && hasBody(property.setter))
            lines.push(`${ctx.mark(property.setter.span)}${prefix}set ${jsName}(value$) {`, ...indent(accessorBody(ctx, property.setter, true)), '}');
        return lines;
    });
}
function indexerLines(ctx: EmitContext, indexer: IndexerMember): string[] {
    const params = parameterList(ctx, indexer.parameters);
    return ctx.withFunction(INSTANCE_SCOPE, () => {
        const lines: string[] = [];
        if (indexer.expressionBody) {
            lines.push(`${ctx.mark(indexer.span)}$at(${params}) {`, ...indent(expressionBodyLines(ctx, indexer.expressionBody, false)), '}');
            return lines;
        }
        if (indexer.getter && hasBody(indexer.getter))
            lines.push(`${ctx.mark(indexer.getter.span)}$at(${params}) {`, ...indent(accessorBody(ctx, indexer.getter, false)), '}');
        if (indexer.setter && hasBody(indexer.setter))
            lines.push(`${ctx.mark(indexer.setter.span)}$set(${params}${params ? ', ' : ''}value$) {`, ...indent(accessorBody(ctx, indexer.setter, true)), '}');
        return lines;
    });
}
function methodLines(ctx: EmitContext, cls: ClassInfo, method: MethodMember): string[] {
    if (!method.body && !method.expressionBody)
        return [];
    const isStatic = isStaticMember(cls, method.modifiers);
    return ctx.withFunction(isStatic ? STATIC_SCOPE : INSTANCE_SCOPE, () => {
        const head = `${ctx.mark(method.nameSpan)}${isStatic ? 'static ' : ''}${method.isAsync ? 'async ' : ''}${method.isIterator ? '*' : ''}${method.jsName ?? method.name}(${parameterList(ctx, method.parameters)}) {`;
        const body = method.body ? blockLines(ctx, method.body) : expressionBodyLines(ctx, method.expressionBody!, method.returnType.name === 'void');
        return [head, ...indent(body), '}'];
    });
}
function staticConstructorLines(ctx: EmitContext, ctor: ConstructorMember): string[] {
    return ctx.withFunction(STATIC_SCOPE, () => {
        const body = ctor.body ? blockLines(ctx, ctor.body) : ctor.expressionBody ? [`${statementExpression(ctx, ctor.expressionBody)};`] : [];
        return [`${ctx.mark(ctor.span)}static $cctor() {`, ...indent(body), '}'];
    });
}
export function nestedTypeLines(ctx: EmitContext): string[] {
    const lines: string[] = [];
    for (const cls of ctx.program.classes)
        if (cls.outer)
            lines.push(`${cls.outer.jsName}.${cls.name} = ${cls.jsName};`);
    for (const info of ctx.program.enums)
        if (info.outer)
            lines.push(`${info.outer.jsName}.${info.name} = ${info.jsName};`);
    return lines;
}
export function staticInitializerLines(ctx: EmitContext): string[] {
    const lines: string[] = [];
    for (const cls of ctx.program.classes) {
        ctx.withClass(cls, () => ctx.withFunction(STATIC_SCOPE, () => {
            for (const member of cls.decl.members) {
                if ((member.kind === 'field' || member.kind === 'event') && isStaticMember(cls, member.modifiers)) {
                    for (const declarator of member.declarators) {
                        const value = declarator.initializer ? expression(ctx, declarator.initializer) : member.kind === 'event' ? 'null' : defaultValue(ctx, declarator.staticType);
                        lines.push(`${ctx.mark(declarator.span)}${cls.jsName}.${declarator.jsName ?? declarator.name} = ${value};`);
                    }
                }
                if (member.kind === 'property' && isAutoProperty(member) && isStaticMember(cls, member.modifiers)) {
                    const info = findMember(cls, member.name);
                    const value = member.initializer ? expression(ctx, member.initializer) : defaultValue(ctx, info?.type);
                    lines.push(`${ctx.mark(member.nameSpan)}${cls.jsName}.${info?.jsName ?? member.name} = ${value};`);
                }
            }
        }));
    }
    for (const cls of ctx.program.classes)
        if (cls.hasStaticConstructor)
            lines.push(`${cls.jsName}.$cctor();`);
    return lines;
}
