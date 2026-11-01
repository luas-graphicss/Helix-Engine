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
export function sameType(a: StaticType, b: StaticType): boolean {
    if (a.kind !== b.kind)
        return false;
    switch (a.kind) {
        case 'array':
            return sameType(a.element, (b as typeof a).element);
        case 'collection': {
            const other = b as typeof a;
            return a.name === other.name && a.args.length === other.args.length && a.args.every((arg, index) => sameType(arg, other.args[index]));
        }
        case 'class':
        case 'enum':
            return a.name === (b as typeof a).name && a.script === (b as typeof a).script;
        default:
            return true;
    }
}
export function elementTypeOf(type: StaticType): StaticType | null {
    switch (type.kind) {
        case 'array':
            return type.element;
        case 'string':
            return STATIC_TYPES.char;
        case 'collection':
            if (type.name === 'Dictionary')
                return { kind: 'class', name: 'KeyValuePair', script: null, runtime: true };
            return type.args[0] ?? STATIC_TYPES.dynamic;
        default:
            return null;
    }
}
export function isDirectlyIterable(type: StaticType): boolean {
    return type.kind === 'array' || type.kind === 'string' || type.kind === 'collection';
}
interface LocalInfo {
    readonly name: string;
    readonly jsName: string;
    type: StaticType;
    readonly byRef: boolean;
}
interface FunctionContext {
    readonly cls: ClassInfo | null;
    readonly isStatic: boolean;
    readonly returnType: StaticType | null;
    usesAwait: boolean;
    usesYield: boolean;
    catchDepth: number;
}
class Scope {
    private readonly locals = new Map<string, LocalInfo>();
    constructor(readonly parent: Scope | null, readonly fn: FunctionContext) { }
    declare(name: string, type: StaticType, byRef = false): LocalInfo {
        const info: LocalInfo = { name, jsName: localJsName(name), type, byRef };
        this.locals.set(name, info);
        return info;
    }
    lookup(name: string): LocalInfo | null {
        for (let scope: Scope | null = this; scope; scope = scope.parent) {
            const found = scope.locals.get(name);
            if (found)
                return found;
        }
        return null;
    }
    lookupInFunction(name: string): LocalInfo | null {
        for (let scope: Scope | null = this; scope && scope.fn === this.fn; scope = scope.parent) {
            const found = scope.locals.get(name);
            if (found)
                return found;
        }
        return null;
    }
    names(): string[] {
        const names: string[] = [];
        for (let scope: Scope | null = this; scope; scope = scope.parent)
            names.push(...scope.locals.keys());
        return names;
    }
}
const siblingUnits = new Map<string, CompilationUnit>();
const MAX_CACHED_SIBLINGS = 96;
function siblingUnit(source: string): CompilationUnit | null {
    const cached = siblingUnits.get(source);
    if (cached)
        return cached;
    const parsed = parse(source);
    if (parsed.diagnostics.length > 0)
        return null;
    if (siblingUnits.size >= MAX_CACHED_SIBLINGS)
        siblingUnits.clear();
    siblingUnits.set(source, parsed.unit);
    return parsed.unit;
}
export function analyze(input: AnalyzeInput): AnalyzeOutput {
    return new Analyzer(input).run();
}
function bodyReturnType(declared: StaticType, isAsync: boolean): StaticType {
    if (!isAsync || declared.kind !== 'task')
        return declared;
    return declared.result ?? STATIC_TYPES.void;
}
const TYPE_LIKE_STATICS: ReadonlySet<string> = new Set(['Array', 'String', 'Double']);
function promoteTypePattern(pattern: Pattern & {
    kind: 'constant';
}): boolean {
    const e = pattern.expression;
    if (e.kind !== 'identifier' || e.typeArguments)
        return false;
    const resolution = e.resolution;
    if (!resolution)
        return false;
    const isType = resolution.kind === 'type' || resolution.kind === 'runtimeType' || (resolution.kind === 'runtimeStatic' && TYPE_LIKE_STATICS.has(resolution.name));
    if (!isType)
        return false;
    const type: TypeRef = { name: e.name, typeArguments: [], arrayRank: 0, nullable: false, tupleElements: null, span: e.span };
    const promoted = pattern as unknown as {
        kind: Pattern['kind'];
        type: TypeRef;
        expression?: Expression;
    };
    promoted.kind = 'type';
    promoted.type = type;
    delete promoted.expression;
    return true;
}
class Analyzer {
    readonly diagnostics: CompileDiagnostic[] = [];
    private readonly fileTypes = new Map<string, TypeInfo>();
    private readonly siblingTypes = new Map<string, TypeInfo>();
    private readonly interfaces = new Set<string>();
    private readonly usedSiblingTypes = new Map<string, SiblingTypeRef>();
    private readonly classes: ClassInfo[] = [];
    private readonly enums: EnumInfo[] = [];
    private main: ClassInfo | null = null;
    private errorCount = 0;
    constructor(private readonly input: AnalyzeInput) { }
    run(): AnalyzeOutput {
        const { unit, scriptName, siblings } = this.input;
        for (const sibling of siblings) {
            const siblingTree = siblingUnit(sibling.source);
            if (!siblingTree)
                continue;
            for (const declaration of siblingTree.types)
                this.collectType(declaration, sibling.name, null, this.siblingTypes);
        }
        for (const declaration of unit.types)
            this.collectType(declaration, null, null, this.fileTypes);
        for (const cls of this.allClasses())
            this.resolveBase(cls);
        for (const cls of this.allClasses())
            this.buildMembers(cls);
        this.chooseMain(scriptName);
        for (const cls of this.classes)
            this.analyzeClass(cls);
        if (this.errorCount > 0)
            return { program: null, diagnostics: this.diagnostics };
        const ordered = this.orderClasses();
        const siblingRefs = Array.from(this.usedSiblingTypes.values());
        const dependencies = Array.from(new Set(siblingRefs.map((ref) => ref.script)));
        return {
            program: { main: this.main, classes: ordered, enums: this.enums, dependencies, siblingTypes: siblingRefs },
            diagnostics: this.diagnostics,
        };
    }
    private error(span: SourceSpan, message: string): void {
        this.errorCount++;
        this.diagnostics.push({ severity: 'error', message, ...spanOf(span), code: 'semantic', source: 'C#' });
    }
    private warn(span: SourceSpan, message: string): void {
        this.diagnostics.push({ severity: 'warning', message, ...spanOf(span), code: 'semantic', source: 'C#' });
    }
    private allClasses(): ClassInfo[] {
        const all: ClassInfo[] = [];
        const visit = (types: Iterable<TypeInfo>) => {
            for (const type of types) {
                if (type.kind !== 'class')
                    continue;
                all.push(type);
                visit(type.nested.values());
            }
        };
        visit(this.fileTypes.values());
        visit(this.siblingTypes.values());
        return all;
    }
    private collectType(declaration: TypeDeclaration, script: string | null, outer: ClassInfo | null, into: Map<string, TypeInfo>): void {
        const local = script === null;
        switch (declaration.kind) {
            case 'class': {
                const existing = into.get(declaration.name);
                if (existing?.kind === 'class' && existing.decl.modifiers.includes('partial') && declaration.modifiers.includes('partial')) {
                    ;
                    (existing.decl.members as Member[]).push(...declaration.members);
                    return;
                }
                if (existing && local) {
                    this.error(declaration.nameSpan, `O tipo "${declaration.name}" já foi declarado neste arquivo.`);
                    return;
                }
                if (existing)
                    return;
                const cls: ClassInfo = {
                    kind: 'class',
                    name: declaration.name,
                    jsName: classJsName(declaration.name, outer),
                    decl: declaration,
                    script,
                    outer,
                    flavor: declaration.flavor,
                    isStatic: declaration.modifiers.includes('static'),
                    typeParameters: new Set(declaration.typeParameters),
                    members: new Map(),
                    ctors: [],
                    nested: new Map(),
                    base: null,
                    baseRuntime: null,
                    isMain: false,
                    isActor: false,
                    recordFields: declaration.recordParameters ? declaration.recordParameters.map((parameter) => parameter.name) : null,
                    hasIndexer: declaration.members.some((member) => member.kind === 'indexer'),
                    hasStaticConstructor: declaration.members.some((member) => member.kind === 'constructor' && member.modifiers.includes('static')),
                };
                into.set(declaration.name, cls);
                if (local)
                    this.classes.push(cls);
                for (const member of declaration.members) {
                    if (member.kind === 'class' || member.kind === 'enum' || member.kind === 'interface' || member.kind === 'delegate')
                        this.collectType(member, script, cls, cls.nested);
                }
                return;
            }
            case 'enum': {
                if (into.has(declaration.name)) {
                    if (local)
                        this.error(declaration.nameSpan, `O tipo "${declaration.name}" já foi declarado neste arquivo.`);
                    return;
                }
                const info: EnumInfo = { kind: 'enum', name: declaration.name, jsName: classJsName(declaration.name, outer), decl: declaration, script, outer, values: this.enumValues(declaration, local) };
                into.set(declaration.name, info);
                if (local)
                    this.enums.push(info);
                return;
            }
            case 'interface':
            case 'delegate':
                this.interfaces.add(declaration.name);
                return;
        }
    }
    private enumValues(declaration: EnumDeclaration, report: boolean): Map<string, number> {
        const values = new Map<string, number>();
        let next = 0;
        for (const member of declaration.members) {
            let value = next;
            if (member.value) {
                const constant = this.constantInt(member.value, values);
                if (constant === null) {
                    if (report)
                        this.error(member.value.span, `O valor de "${declaration.name}.${member.name}" precisa ser uma constante inteira.`);
                }
                else
                    value = constant;
            }
            values.set(member.name, value);
            next = value + 1;
        }
        return values;
    }
}
