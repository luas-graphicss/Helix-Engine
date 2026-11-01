import { Dictionary, HashSet, List, Queue, Stack } from '../../runtime/collections';
import type { StaticType, TypeTest } from '../ast';
import { q, type EmitContext } from './context';
const COLLECTION_PROTOTYPES: ReadonlyMap<string, object> = new Map<string, object>([
    ['List', List.prototype],
    ['Dictionary', Dictionary.prototype],
    ['HashSet', HashSet.prototype],
    ['Queue', Queue.prototype],
    ['Stack', Stack.prototype],
]);
export function isNumeric(type: StaticType | undefined): boolean {
    return type !== undefined && (type.kind === 'int' || type.kind === 'float' || type.kind === 'char' || type.kind === 'enum');
}
export function isIntegral(type: StaticType | undefined): boolean {
    return type !== undefined && (type.kind === 'int' || type.kind === 'char' || type.kind === 'enum');
}
export function isPrimitiveComparable(type: StaticType | undefined): boolean {
    return type !== undefined && (isNumeric(type) || type.kind === 'bool' || type.kind === 'string' || type.kind === 'null');
}
export function concatenatesNatively(type: StaticType | undefined): boolean {
    return type !== undefined && (type.kind === 'string' || type.kind === 'int' || type.kind === 'float' || type.kind === 'char');
}
export function isCollectionMethod(collection: string, member: string): boolean {
    const prototype = COLLECTION_PROTOTYPES.get(collection);
    if (!prototype)
        return false;
    for (let current: object | null = prototype; current && current !== Object.prototype; current = Object.getPrototypeOf(current) as object | null) {
        const descriptor = Object.getOwnPropertyDescriptor(current, member);
        if (descriptor)
            return typeof descriptor.value === 'function';
    }
    return false;
}
export function typeOperand(ctx: EmitContext, type: StaticType | undefined): string {
    if (!type)
        return q('object');
    switch (type.kind) {
        case 'int':
            return q('int');
        case 'float':
            return q('double');
        case 'bool':
            return q('bool');
        case 'string':
            return q('string');
        case 'char':
            return q('char');
        case 'array':
            return q('array');
        case 'delegate':
            return q('delegate');
        case 'collection':
            return `$.${type.name}`;
        case 'class':
            if (type.runtime)
                return `$.${type.name}`;
            return scriptTypeReference(ctx, type.name, type.jsName, type.script);
        case 'enum':
            return scriptTypeReference(ctx, type.name, type.jsName, type.script);
        default:
            return q('object');
    }
}
function scriptTypeReference(ctx: EmitContext, name: string, jsName: string | undefined, sibling: string | null): string {
    if (jsName)
        return ctx.typeReference(jsName, sibling);
    const local = sibling === null ? (ctx.program.classes.find((cls) => cls.name === name)?.jsName ?? ctx.program.enums.find((info) => info.name === name)?.jsName) : undefined;
    return ctx.typeReference(local ?? name, sibling);
}
export function typeTestExpression(ctx: EmitContext, test: TypeTest | undefined, value: string): string {
    switch (test?.kind) {
        case 'primitive':
            return `$.is(${value}, ${q(test.name)})`;
        case 'runtime':
            return `$.is(${value}, $.${test.name})`;
        case 'script':
            return `$.is(${value}, ${ctx.typeReference(test.jsName, test.sibling)})`;
        case 'array':
            return `Array.isArray(${value})`;
        default:
            return `(${value} != null)`;
    }
}
export function defaultValue(ctx: EmitContext, type: StaticType | undefined): string {
    switch (type?.kind) {
        case 'int':
        case 'float':
        case 'enum':
            return '0';
        case 'bool':
            return 'false';
        case 'char':
            return q('\u0000');
        case 'class': {
            const cls = ctx.classOfType(type);
            return cls && cls.flavor === 'struct' ? `new ${ctx.typeReference(cls.jsName, cls.script)}().$ctor()` : 'null';
        }
        default:
            return 'null';
    }
}
