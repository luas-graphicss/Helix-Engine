import type { CompileDiagnostic } from '../../../compiler/compile-types';
import type { ForeignSibling } from '../../language-engine';
import { HOOK_METHOD_NAMES } from '../runtime/actor-script';
import { ARRAY_METHODS, Dictionary, HashSet, KeyValuePair, LINQ, List, Queue, Stack, Tuple } from '../runtime/collections';
import { EXCEPTION_TYPES } from '../runtime/errors';
import { ARRAY, BOOL, BOOL_METHODS, BYTE, CHAR, COLOR, CONVERT, DECIMAL, DELEGATE_METHODS, DOUBLE, DateTime, ENUMERABLE, ENUM_STATICS, ENVIRONMENT, FLOAT, GUID, INT, LONG, MATH, MATHF, MIDPOINT_ROUNDING, NUMBER_METHODS, Random, SBYTE, SHORT, STRING_COMPARISON, STRING_METHODS, STRING_SPLIT_OPTIONS, STRING_STATICS, StringBuilder, TASK_METHODS, TimeSpan, UINT, ULONG, USHORT, VECTOR2, VECTOR3, createConsoleStatics, createDebugStatics, createTaskStatics, type ConsoleLike, } from '../runtime/statics';
import { STATIC_TYPES, type Argument, type Block, type CatchClause, type ClassDeclaration, type ClassFlavor, type CompilationUnit, type ConstructorMember, type Declarator, type EnumDeclaration, type Expression, type Initializer, type LambdaExpression, type Member, type MethodMember, type Parameter, type Pattern, type Resolution, type Statement, type StaticType, type TypeDeclaration, type TypeRef, type TypeTest, } from './ast';
import { parse } from './parser';
import { PRIMITIVE_TYPE_KEYWORDS, type SourceSpan } from './tokens';
export interface AnalyzeInput {
    readonly unit: CompilationUnit;
    readonly fileName: string;
    readonly scriptName: string;
    readonly siblings: readonly ForeignSibling[];
}
export interface AnalyzeOutput {
    readonly program: ProgramInfo | null;
    readonly diagnostics: CompileDiagnostic[];
}
export interface ParamInfo {
    readonly name: string;
    readonly jsName: string;
    readonly type: StaticType;
    readonly modifier: Parameter['modifier'];
    readonly hasDefault: boolean;
    readonly decl: Parameter;
}
export type MemberKind = 'field' | 'property' | 'method' | 'event' | 'const';
export interface MemberInfo {
    readonly name: string;
    readonly jsName: string;
    readonly kind: MemberKind;
    readonly isStatic: boolean;
    readonly type: StaticType;
    readonly params: readonly ParamInfo[];
    readonly isAsync: boolean;
    readonly owner: ClassInfo;
    readonly decl: Member;
}
export interface ConstructorInfo {
    readonly jsName: string;
    readonly params: readonly ParamInfo[];
    readonly decl: ConstructorMember | null;
}
export interface ClassInfo {
    readonly kind: 'class';
    readonly name: string;
    readonly jsName: string;
    readonly decl: ClassDeclaration;
    readonly script: string | null;
    readonly outer: ClassInfo | null;
    readonly flavor: ClassFlavor;
    readonly isStatic: boolean;
    readonly typeParameters: ReadonlySet<string>;
    readonly members: Map<string, MemberInfo[]>;
    readonly ctors: ConstructorInfo[];
    readonly nested: Map<string, TypeInfo>;
    base: ClassInfo | null;
    baseRuntime: string | null;
    isMain: boolean;
    isActor: boolean;
    recordFields: readonly string[] | null;
    hasIndexer: boolean;
    hasStaticConstructor: boolean;
}
export interface EnumInfo {
    readonly kind: 'enum';
    readonly name: string;
    readonly jsName: string;
    readonly decl: EnumDeclaration;
    readonly script: string | null;
    readonly outer: ClassInfo | null;
    readonly values: ReadonlyMap<string, number>;
}
export type TypeInfo = ClassInfo | EnumInfo;
export interface SiblingTypeRef {
    readonly script: string;
    readonly type: string;
    readonly alias: string;
}
export interface ProgramInfo {
    readonly main: ClassInfo | null;
    readonly classes: readonly ClassInfo[];
    readonly enums: readonly EnumInfo[];
    readonly dependencies: readonly string[];
    readonly siblingTypes: readonly SiblingTypeRef[];
}
const SILENT_CONSOLE: ConsoleLike = { log() { }, info() { }, warn() { }, error() { }, debug() { } };
const RUNTIME_STATICS: ReadonlyMap<string, object> = new Map<string, object>([
    ['Math', MATH],
    ['MathF', MATHF],
    ['Console', createConsoleStatics(SILENT_CONSOLE)],
    ['Debug', createDebugStatics(SILENT_CONSOLE)],
    ['Int', INT],
    ['Long', LONG],
    ['Short', SHORT],
    ['Byte', BYTE],
    ['SByte', SBYTE],
    ['UInt', UINT],
    ['ULong', ULONG],
    ['UShort', USHORT],
    ['Float', FLOAT],
    ['Double', DOUBLE],
    ['Decimal', DECIMAL],
    ['Bool', BOOL],
    ['Char', CHAR],
    ['String', STRING_STATICS],
    ['Convert', CONVERT],
    ['Enum', ENUM_STATICS],
    ['Array', ARRAY],
    ['Enumerable', ENUMERABLE],
    ['Environment', ENVIRONMENT],
    ['Guid', GUID],
    ['Task', createTaskStatics({})],
    ['Vector3', VECTOR3],
    ['Vector2', VECTOR2],
    ['Color', COLOR],
    ['StringComparison', STRING_COMPARISON],
    ['StringSplitOptions', STRING_SPLIT_OPTIONS],
    ['MidpointRounding', MIDPOINT_ROUNDING],
]);
const PRIMITIVE_STATICS: ReadonlyMap<string, string> = new Map([
    ['int', 'Int'],
    ['long', 'Long'],
    ['short', 'Short'],
    ['byte', 'Byte'],
    ['sbyte', 'SByte'],
    ['uint', 'UInt'],
    ['ulong', 'ULong'],
    ['ushort', 'UShort'],
    ['float', 'Float'],
    ['double', 'Double'],
    ['decimal', 'Decimal'],
    ['bool', 'Bool'],
    ['char', 'Char'],
    ['string', 'String'],
]);
export const RUNTIME_CLASSES: ReadonlyMap<string, Function> = new Map<string, Function>([
    ['StringBuilder', StringBuilder],
    ['Random', Random],
    ['DateTime', DateTime],
    ['TimeSpan', TimeSpan],
    ['KeyValuePair', KeyValuePair],
    ...Object.entries(EXCEPTION_TYPES),
]);
export const RUNTIME_FACTORIES: ReadonlySet<string> = new Set(['Vector3', 'Vector2', 'Color']);
type CollectionName = 'List' | 'Dictionary' | 'HashSet' | 'Queue' | 'Stack';
const COLLECTION_CLASSES: ReadonlyMap<CollectionName, Function> = new Map<CollectionName, Function>([
    ['List', List],
    ['Dictionary', Dictionary],
    ['HashSet', HashSet],
    ['Queue', Queue],
    ['Stack', Stack],
]);
export const COLLECTION_ALIASES: ReadonlyMap<string, CollectionName> = new Map([
    ['List', 'List'],
    ['Dictionary', 'Dictionary'],
    ['HashSet', 'HashSet'],
    ['Queue', 'Queue'],
    ['Stack', 'Stack'],
    ['SortedDictionary', 'Dictionary'],
    ['SortedSet', 'HashSet'],
]);
const DELEGATE_TYPE_NAMES: ReadonlySet<string> = new Set(['Action', 'Func', 'Predicate', 'Comparison', 'Delegate', 'EventHandler']);
const UNIVERSAL_MEMBERS: ReadonlySet<string> = new Set(['ToString', 'Equals', 'GetHashCode', 'GetType', 'GetHashKey']);
const ACTOR_SCRIPT_MEMBERS: ReadonlyMap<string, StaticType> = new Map<string, StaticType>([
    ['Helix', STATIC_TYPES.engine],
    ['helix', STATIC_TYPES.engine],
    ['Self', STATIC_TYPES.engine],
    ['self', STATIC_TYPES.engine],
    ['Actor', STATIC_TYPES.engine],
    ['actor', STATIC_TYPES.engine],
    ['Entity', STATIC_TYPES.engine],
    ['entity', STATIC_TYPES.engine],
    ['Script', STATIC_TYPES.engine],
    ['script', STATIC_TYPES.engine],
]);
const RESERVED_MEMBER_NAMES: ReadonlySet<string> = new Set(['constructor', 'prototype', '__proto__', 'helix', 'entity', 'script']);
const RESERVED_JS_NAMES: ReadonlySet<string> = new Set([
    'arguments', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default', 'delete', 'do', 'else', 'enum', 'eval',
    'export', 'extends', 'false', 'finally', 'for', 'function', 'if', 'implements', 'import', 'in', 'instanceof', 'interface', 'let', 'new', 'null',
    'package', 'private', 'protected', 'public', 'return', 'static', 'super', 'switch', 'this', 'throw', 'true', 'try', 'typeof', 'var', 'void', 'while',
    'with', 'yield', 'undefined', 'NaN', 'Infinity', 'helix', 'require', 'module', 'exports', 'console', 'value',
]);
const RESERVED_CLASS_NAMES: ReadonlySet<string> = new Set(['Object', 'Array', 'Map', 'Set', 'Promise', 'Error', 'Math', 'JSON', 'Number', 'String', 'Boolean', 'Symbol', 'Function', 'Date', 'RegExp', 'Proxy', 'Reflect']);
type Shape = 'bool' | 'int' | 'float' | 'string' | 'element' | 'self' | 'list' | 'array' | 'void' | 'dynamic';
const SEQUENCE_METHOD_SHAPES: ReadonlyMap<string, Shape> = new Map<string, Shape>([
    ['Where', 'self'], ['FindAll', 'self'], ['OrderBy', 'self'], ['OrderByDescending', 'self'], ['ThenBy', 'self'], ['ThenByDescending', 'self'],
    ['Take', 'self'], ['TakeLast', 'self'], ['TakeWhile', 'self'], ['Skip', 'self'], ['SkipLast', 'self'], ['SkipWhile', 'self'], ['Distinct', 'self'],
    ['DistinctBy', 'self'], ['Concat', 'self'], ['Append', 'self'], ['Prepend', 'self'], ['Union', 'self'], ['Intersect', 'self'], ['Except', 'self'],
    ['DefaultIfEmpty', 'self'], ['AsEnumerable', 'self'], ['GetRange', 'self'], ['AsReadOnly', 'self'],
    ['Reverse', 'void'], ['ToList', 'list'], ['ToArray', 'array'],
    ['First', 'element'], ['FirstOrDefault', 'element'], ['Last', 'element'], ['LastOrDefault', 'element'], ['Single', 'element'], ['SingleOrDefault', 'element'],
    ['ElementAt', 'element'], ['ElementAtOrDefault', 'element'], ['Find', 'element'], ['FindLast', 'element'], ['Min', 'element'], ['Max', 'element'],
    ['MinBy', 'element'], ['MaxBy', 'element'], ['Dequeue', 'element'], ['Pop', 'element'], ['Peek', 'element'],
    ['Any', 'bool'], ['All', 'bool'], ['Contains', 'bool'], ['Exists', 'bool'], ['TrueForAll', 'bool'], ['Remove', 'bool'], ['ContainsKey', 'bool'],
    ['ContainsValue', 'bool'], ['TryGetValue', 'bool'], ['TryAdd', 'bool'], ['TryDequeue', 'bool'], ['TryPeek', 'bool'], ['TryPop', 'bool'],
    ['SequenceEqual', 'bool'], ['IsSubsetOf', 'bool'], ['IsSupersetOf', 'bool'], ['Overlaps', 'bool'], ['SetEquals', 'bool'],
    ['Count', 'int'], ['LongCount', 'int'], ['IndexOf', 'int'], ['LastIndexOf', 'int'], ['FindIndex', 'int'], ['FindLastIndex', 'int'], ['RemoveAll', 'int'],
    ['RemoveWhere', 'int'], ['Average', 'float'],
    ['Add', 'void'], ['AddRange', 'void'], ['Insert', 'void'], ['InsertRange', 'void'], ['RemoveAt', 'void'], ['RemoveRange', 'void'], ['Clear', 'void'],
    ['Sort', 'void'], ['ForEach', 'void'], ['Enqueue', 'void'], ['Push', 'void'], ['CopyTo', 'void'], ['TrimExcess', 'void'], ['UnionWith', 'void'],
    ['IntersectWith', 'void'], ['ExceptWith', 'void'], ['SymmetricExceptWith', 'void'],
    ['ToString', 'string'],
]);
const STRING_METHOD_SHAPES: ReadonlyMap<string, Shape> = new Map<string, Shape>([
    ['ToUpper', 'string'], ['ToLower', 'string'], ['ToUpperInvariant', 'string'], ['ToLowerInvariant', 'string'], ['Trim', 'string'], ['TrimStart', 'string'],
    ['TrimEnd', 'string'], ['Substring', 'string'], ['Replace', 'string'], ['PadLeft', 'string'], ['PadRight', 'string'], ['Insert', 'string'],
    ['Remove', 'string'], ['Normalize', 'string'], ['ToString', 'string'],
    ['Contains', 'bool'], ['StartsWith', 'bool'], ['EndsWith', 'bool'], ['Equals', 'bool'],
    ['IndexOf', 'int'], ['LastIndexOf', 'int'], ['IndexOfAny', 'int'], ['LastIndexOfAny', 'int'], ['CompareTo', 'int'], ['GetHashCode', 'int'], ['Count', 'int'],
    ['Split', 'array'], ['ToCharArray', 'array'],
]);
function spanOf(span: SourceSpan): Pick<CompileDiagnostic, 'line' | 'column' | 'endLine' | 'endColumn'> {
    return { line: span.line, column: span.column, endLine: span.endLine, endColumn: span.endColumn };
}
function lowerFirst(name: string): string {
    return name.length > 0 ? name.charAt(0).toLowerCase() + name.slice(1) : name;
}
function levenshtein(a: string, b: string): number {
    if (a.length === 0)
        return b.length;
    if (b.length === 0)
        return a.length;
    let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
    for (let i = 1; i <= a.length; i++) {
        const current = [i];
        for (let j = 1; j <= b.length; j++)
            current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        previous = current;
    }
    return previous[b.length];
}
function similarNames(wanted: string, candidates: Iterable<string>): string[] {
    const lower = wanted.toLowerCase();
    const found: string[] = [];
    for (const candidate of candidates) {
        const other = candidate.toLowerCase();
        if (other === lower || levenshtein(lower, other) <= Math.max(1, Math.floor(wanted.length / 3)))
            found.push(candidate);
        if (found.length >= 4)
            break;
    }
    return found;
}
function hint(wanted: string, candidates: Iterable<string>): string {
    const names = similarNames(wanted, candidates);
    return names.length > 0 ? ` Você quis dizer ${names.map((name) => `"${name}"`).join(' ou ')}?` : '';
}
export function siblingAlias(script: string, type: string): string {
    return `$${script.replace(/[^A-Za-z0-9_]/g, '_')}$${type}`;
}
export function classJsName(name: string, outer: ClassInfo | null): string {
    const own = RESERVED_CLASS_NAMES.has(name) || RESERVED_JS_NAMES.has(name) ? `${name}$` : name;
    return outer ? `${outer.jsName}$${own}` : own;
}
function memberJsName(name: string): string {
    return RESERVED_MEMBER_NAMES.has(name) ? `${name}$` : name;
}
function localJsName(name: string): string {
    return RESERVED_JS_NAMES.has(name) ? `${name}$` : name;
}
export function isNumericType(type: StaticType | undefined): boolean {
    return type !== undefined && (type.kind === 'int' || type.kind === 'float' || type.kind === 'enum');
}
export function isIntegralType(type: StaticType | undefined): boolean {
    return type !== undefined && (type.kind === 'int' || type.kind === 'enum');
}
