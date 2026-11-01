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
    private constantInt(expression: Expression, known: ReadonlyMap<string, number>): number | null {
        switch (expression.kind) {
            case 'literal':
                return typeof expression.value === 'number' && Number.isInteger(expression.value) ? expression.value : null;
            case 'identifier':
                return known.get(expression.name) ?? null;
            case 'member':
                return expression.target.kind === 'identifier' ? (known.get(expression.name) ?? null) : null;
            case 'unary': {
                const operand = this.constantInt(expression.operand, known);
                if (operand === null)
                    return null;
                return expression.operator === '-' ? -operand : expression.operator === '~' ? ~operand : expression.operator === '+' ? operand : null;
            }
            case 'binary': {
                const left = this.constantInt(expression.left, known);
                const right = this.constantInt(expression.right, known);
                if (left === null || right === null)
                    return null;
                switch (expression.operator) {
                    case '+': return left + right;
                    case '-': return left - right;
                    case '*': return left * right;
                    case '/': return right === 0 ? null : Math.trunc(left / right);
                    case '%': return right === 0 ? null : left % right;
                    case '&': return left & right;
                    case '|': return left | right;
                    case '^': return left ^ right;
                    case '<<': return left << right;
                    case '>>': return left >> right;
                    default: return null;
                }
            }
            case 'cast':
                return this.constantInt(expression.expression, known);
            default:
                return null;
        }
    }
    private resolveBase(cls: ClassInfo): void {
        const local = cls.script === null;
        for (const base of cls.decl.bases) {
            if (base.name === 'ActorScript' || base.name === 'MonoBehaviour') {
                cls.baseRuntime = 'ActorScript';
                cls.isActor = true;
                continue;
            }
            const found = this.lookupType(base.name, cls, cls.script);
            if (found?.kind === 'class') {
                if (cls.base) {
                    if (local)
                        this.error(base.span, `"${cls.name}" só pode ter uma classe base; "${base.name}" é a segunda.`);
                    continue;
                }
                cls.base = found;
                continue;
            }
            if (found?.kind === 'enum') {
                if (local)
                    this.error(base.span, `"${base.name}" é um enum e não pode ser classe base.`);
                continue;
            }
            if (RUNTIME_CLASSES.has(base.name)) {
                cls.baseRuntime = base.name;
                continue;
            }
            if (this.interfaces.has(base.name) || /^I[A-Z]/.test(base.name) || COLLECTION_ALIASES.has(base.name) || DELEGATE_TYPE_NAMES.has(base.name))
                continue;
            if (local)
                this.error(base.span, `Classe base desconhecida: "${base.name}".${hint(base.name, this.typeNames())}`);
        }
        if (cls.base) {
            for (let ancestor: ClassInfo | null = cls.base; ancestor; ancestor = ancestor.base) {
                if (ancestor === cls) {
                    if (local)
                        this.error(cls.decl.nameSpan, `"${cls.name}" herda de si mesma (ciclo de herança).`);
                    cls.base = null;
                    break;
                }
            }
        }
    }
    private typeNames(): string[] {
        return [...this.fileTypes.keys(), ...this.siblingTypes.keys(), ...RUNTIME_CLASSES.keys(), ...COLLECTION_ALIASES.keys(), 'ActorScript'];
    }
    private lookupType(name: string, from: ClassInfo | null, script: string | null): TypeInfo | null {
        for (let cls: ClassInfo | null = from; cls; cls = cls.outer) {
            const nested = cls.nested.get(name);
            if (nested)
                return nested;
            for (let ancestor = cls.base; ancestor; ancestor = ancestor.base) {
                const inherited = ancestor.nested.get(name);
                if (inherited)
                    return inherited;
            }
        }
        const scopeTypes = script === null ? this.fileTypes : this.siblingTypes;
        const own = scopeTypes.get(name);
        if (own && (script === null || own.script === script))
            return own;
        return this.fileTypes.get(name) ?? this.siblingTypes.get(name) ?? null;
    }
    private useType(type: TypeInfo): void {
        if (type.script === null)
            return;
        const root = this.rootOf(type);
        const key = `${type.script}\u0000${root.name}`;
        if (!this.usedSiblingTypes.has(key))
            this.usedSiblingTypes.set(key, { script: type.script, type: root.name, alias: siblingAlias(type.script, root.name) });
    }
    private rootOf(type: TypeInfo): TypeInfo {
        let current: TypeInfo = type;
        while (current.outer)
            current = current.outer;
        return current;
    }
    private isActorClass(cls: ClassInfo): boolean {
        for (let current: ClassInfo | null = cls; current; current = current.base)
            if (current.isActor || current.baseRuntime === 'ActorScript')
                return true;
        return false;
    }
    private buildMembers(cls: ClassInfo): void {
        const local = cls.script === null;
        const groups = new Map<string, MethodMember[]>();
        for (const member of cls.decl.members) {
            switch (member.kind) {
                case 'field':
                case 'event':
                    for (const declarator of member.declarators)
                        this.addMember(cls, declarator.name, member.kind === 'event' ? 'event' : member.modifiers.includes('const') ? 'const' : 'field', member.modifiers.includes('static') || member.modifiers.includes('const') || cls.isStatic, this.typeFromRef(member.type, cls), [], false, member, declarator.span);
                    break;
                case 'property':
                    this.addMember(cls, member.name, 'property', member.modifiers.includes('static') || cls.isStatic, this.typeFromRef(member.type, cls), [], false, member, member.nameSpan);
                    break;
                case 'method': {
                    const list = groups.get(member.name) ?? [];
                    list.push(member);
                    groups.set(member.name, list);
                    break;
                }
                case 'constructor':
                    break;
                default:
                    break;
            }
        }
        if (cls.recordFields && cls.decl.recordParameters) {
            for (const parameter of cls.decl.recordParameters) {
                if (!cls.members.has(parameter.name))
                    this.addMember(cls, parameter.name, 'property', false, parameter.type ? this.typeFromRef(parameter.type, cls) : STATIC_TYPES.dynamic, [], false, cls.decl, parameter.span);
            }
        }
        for (const [name, methods] of groups) {
            const overloaded = methods.length > 1;
            const seen = new Map<string, number>();
            for (const method of methods) {
                const isStatic = method.modifiers.includes('static') || cls.isStatic;
                const params = method.parameters.map((parameter) => this.paramInfo(parameter, cls));
                let jsName = memberJsName(name);
                if (overloaded) {
                    const arity = `${jsName}$${method.parameters.length}`;
                    const count = seen.get(arity) ?? 0;
                    seen.set(arity, count + 1);
                    jsName = count === 0 ? arity : `${arity}$${count}`;
                    if (count > 0 && local)
                        this.warn(method.nameSpan, `"${name}" tem mais de uma sobrecarga com ${method.parameters.length} parâmetros; a escolha entre elas é pela ordem de declaração, não pelos tipos.`);
                }
                method.jsName = jsName;
                const returnType = this.typeFromRef(method.returnType, cls);
                const isAsync = method.modifiers.includes('async');
                const type = isAsync && returnType.kind !== 'task' ? ({ kind: 'task', result: returnType.kind === 'void' ? null : returnType } as StaticType) : returnType;
                const info: MemberInfo = { name, jsName, kind: 'method', isStatic, type, params, isAsync, owner: cls, decl: method };
                const list = cls.members.get(name) ?? [];
                if (list.some((entry) => entry.kind !== 'method')) {
                    if (local)
                        this.error(method.nameSpan, `"${name}" já é um campo ou propriedade de "${cls.name}".`);
                    continue;
                }
                list.push(info);
                cls.members.set(name, list);
                if (local && RESERVED_MEMBER_NAMES.has(name))
                    this.warn(method.nameSpan, `"${name}" colide com um nome interno do runtime; no JavaScript gerado o membro se chama "${jsName}".`);
            }
        }
        const ctors = cls.decl.members.filter((member): member is ConstructorMember => member.kind === 'constructor' && !member.modifiers.includes('static'));
        for (const [index, ctor] of ctors.entries()) {
            const jsName = ctors.length > 1 ? `$ctor$${ctor.parameters.length}${ctors.filter((other, otherIndex) => otherIndex < index && other.parameters.length === ctor.parameters.length).length > 0 ? `$${index}` : ''}` : '$ctor';
            ctor.jsName = jsName;
            cls.ctors.push({ jsName, params: ctor.parameters.map((parameter) => this.paramInfo(parameter, cls)), decl: ctor });
        }
        if (cls.recordFields && cls.decl.recordParameters && cls.ctors.length === 0) {
            cls.ctors.push({ jsName: '$ctor', params: cls.decl.recordParameters.map((parameter) => this.paramInfo(parameter, cls)), decl: null });
        }
    }
    private addMember(cls: ClassInfo, name: string, kind: MemberKind, isStatic: boolean, type: StaticType, params: readonly ParamInfo[], isAsync: boolean, decl: Member, span: SourceSpan): void {
        if (cls.members.has(name)) {
            if (cls.script === null)
                this.error(span, `"${cls.name}" já tem um membro chamado "${name}".`);
            return;
        }
        const jsName = memberJsName(name);
        cls.members.set(name, [{ name, jsName, kind, isStatic, type, params, isAsync, owner: cls, decl }]);
        if (cls.script === null && RESERVED_MEMBER_NAMES.has(name))
            this.warn(span, `"${name}" colide com um nome interno do runtime; no JavaScript gerado o membro se chama "${jsName}".`);
    }
    private paramInfo(parameter: Parameter, cls: ClassInfo | null): ParamInfo {
        parameter.jsName = localJsName(parameter.name);
        const declared = parameter.type ? this.typeFromRef(parameter.type, cls) : STATIC_TYPES.dynamic;
        const type = parameter.modifier === 'params' && declared.kind !== 'array' ? ({ kind: 'array', element: declared } as StaticType) : declared;
        return { name: parameter.name, jsName: parameter.jsName, type, modifier: parameter.modifier, hasDefault: parameter.defaultValue !== null, decl: parameter };
    }
    findMember(cls: ClassInfo, name: string, arity: number | null = null): MemberInfo | null {
        let current: ClassInfo | null = cls;
        while (current) {
            const list = current.members.get(name);
            if (list && list.length > 0) {
                if (list.length === 1 || arity === null)
                    return list[0];
                const exact = list.find((member) => member.params.length === arity);
                if (exact)
                    return exact;
                const flexible = list.find((member) => {
                    const required = member.params.filter((parameter) => !parameter.hasDefault && parameter.modifier !== 'params').length;
                    return arity >= required && (arity <= member.params.length || member.params.some((parameter) => parameter.modifier === 'params'));
                });
                return flexible ?? list[0];
            }
            current = current.base;
        }
        return null;
    }
    private memberNames(cls: ClassInfo): string[] {
        const names = new Set<string>();
        for (let current: ClassInfo | null = cls; current; current = current.base)
            for (const name of current.members.keys())
                names.add(name);
        if (this.isActorClass(cls))
            for (const name of ACTOR_SCRIPT_MEMBERS.keys())
                names.add(name);
        return Array.from(names);
    }
    private chooseMain(scriptName: string): void {
        const top = this.classes.filter((cls) => cls.outer === null);
        const byName = top.find((cls) => cls.name === scriptName);
        const actor = top.find((cls) => this.isActorClass(cls));
        const candidate = byName ?? actor ?? (top.length === 1 && !top[0].isStatic ? top[0] : null);
        if (!candidate)
            return;
        if (candidate.isStatic) {
            const declaresHooks = Array.from(candidate.members.keys()).some((member) => HOOK_METHOD_NAMES.has(member));
            if (byName && declaresHooks)
                this.warn(candidate.decl.nameSpan, `"${candidate.name}" é estática: o script expõe os métodos dela para os outros scripts, mas os hooks de ator declarados nela não serão chamados. Remova "static" para a engine instanciá-la por ator.`);
            return;
        }
        candidate.isMain = true;
        if (!this.isActorClass(candidate) && !candidate.base && !candidate.baseRuntime) {
            candidate.baseRuntime = 'ActorScript';
            candidate.isActor = true;
        }
        if (this.isActorClass(candidate) && candidate.ctors.length > 0 && !candidate.ctors.some((ctor) => ctor.params.every((parameter) => parameter.hasDefault))) {
            this.error(candidate.decl.nameSpan, `"${candidate.name}" é a classe do ator e precisa de um construtor sem parâmetros: a engine cria a instância sem argumentos.`);
        }
        this.main = candidate;
    }
    private orderClasses(): ClassInfo[] {
        const ordered: ClassInfo[] = [];
        const seen = new Set<ClassInfo>();
        const visit = (cls: ClassInfo) => {
            if (seen.has(cls))
                return;
            seen.add(cls);
            if (cls.base && cls.base.script === null)
                visit(cls.base);
            ordered.push(cls);
        };
        for (const cls of this.classes)
            visit(cls);
        return ordered;
    }
    typeFromRef(ref: TypeRef, cls: ClassInfo | null): StaticType {
        if (ref.tupleElements) {
            const elements = ref.tupleElements.map((element) => ({ name: null, type: this.typeFromRef(element, cls) }));
            return ref.arrayRank > 0 ? this.wrapArray({ kind: 'tuple', elements }, ref.arrayRank) : { kind: 'tuple', elements };
        }
        let base: StaticType;
        const primitive = PRIMITIVE_TYPE_KEYWORDS.get(ref.name);
        if (primitive) {
            switch (primitive) {
                case 'int':
                    base = STATIC_TYPES.int;
                    break;
                case 'float':
                    base = STATIC_TYPES.float;
                    break;
                case 'bool':
                    base = STATIC_TYPES.bool;
                    break;
                case 'string':
                    base = STATIC_TYPES.string;
                    break;
                case 'char':
                    base = STATIC_TYPES.char;
                    break;
                case 'void':
                    base = STATIC_TYPES.void;
                    break;
                default: base = STATIC_TYPES.dynamic;
            }
        }
        else
            base = this.namedType(ref, cls);
        return ref.arrayRank > 0 ? this.wrapArray(base, ref.arrayRank) : base;
    }
    private wrapArray(element: StaticType, rank: number): StaticType {
        let type = element;
        for (let level = 0; level < rank; level++)
            type = { kind: 'array', element: type };
        return type;
    }
    private namedType(ref: TypeRef, cls: ClassInfo | null): StaticType {
        const { name } = ref;
        const args = ref.typeArguments.map((argument) => this.typeFromRef(argument, cls));
        switch (name) {
            case 'var':
            case 'dynamic':
            case 'object':
            case 'Object':
                return STATIC_TYPES.dynamic;
            case 'Int32':
            case 'Int64':
            case 'Int16':
            case 'Byte':
            case 'UInt32':
            case 'UInt64':
                return STATIC_TYPES.int;
            case 'Single':
            case 'Double':
                return STATIC_TYPES.float;
            case 'Boolean':
                return STATIC_TYPES.bool;
            case 'String':
                return STATIC_TYPES.string;
            case 'Char':
                return STATIC_TYPES.char;
            case 'Task':
            case 'ValueTask':
                return { kind: 'task', result: args[0] ?? null };
            case 'Action':
                return { kind: 'delegate', params: args, returns: STATIC_TYPES.void };
            case 'Func':
                return { kind: 'delegate', params: args.slice(0, -1), returns: args[args.length - 1] ?? null };
            case 'Predicate':
                return { kind: 'delegate', params: args, returns: STATIC_TYPES.bool };
            case 'Comparison':
                return { kind: 'delegate', params: [args[0] ?? STATIC_TYPES.dynamic, args[0] ?? STATIC_TYPES.dynamic], returns: STATIC_TYPES.int };
            case 'Delegate':
            case 'EventHandler':
                return STATIC_TYPES.delegate;
            case 'KeyValuePair':
                return { kind: 'class', name: 'KeyValuePair', script: null, runtime: true };
            case 'ActorScript':
            case 'MonoBehaviour':
                return STATIC_TYPES.dynamic;
            default:
                break;
        }
        const collection = COLLECTION_ALIASES.get(name);
        if (collection)
            return { kind: 'collection', name: collection, args };
        if (cls?.typeParameters.has(name))
            return STATIC_TYPES.dynamic;
        for (let outer = cls?.outer ?? null; outer; outer = outer.outer)
            if (outer.typeParameters.has(name))
                return STATIC_TYPES.dynamic;
        const found = this.lookupType(name, cls, cls?.script ?? null);
        if (found) {
            this.useType(found);
            return this.typeRefOf(found);
        }
        if (RUNTIME_CLASSES.has(name))
            return { kind: 'class', name, script: null, runtime: true };
        if (this.interfaces.has(name) || this.fileDelegates().has(name))
            return name.startsWith('I') ? STATIC_TYPES.dynamic : STATIC_TYPES.delegate;
        return STATIC_TYPES.dynamic;
    }
    private fileDelegates(): Set<string> {
        const names = new Set<string>();
        for (const declaration of this.input.unit.types)
            if (declaration.kind === 'delegate')
                names.add(declaration.name);
        return names;
    }
    private classOf(type: StaticType | undefined): ClassInfo | null {
        if (!type || type.kind !== 'class' || type.runtime)
            return null;
        const found = type.script === null ? this.fileTypes.get(type.name) ?? this.nestedByName(type.name, this.fileTypes) : this.siblingTypes.get(type.name) ?? this.nestedByName(type.name, this.siblingTypes);
        return found?.kind === 'class' ? found : null;
    }
    private nestedByName(name: string, roots: Map<string, TypeInfo>): TypeInfo | null {
        for (const root of roots.values()) {
            if (root.kind !== 'class')
                continue;
            const found = this.searchNested(root, name);
            if (found)
                return found;
        }
        return null;
    }
    private searchNested(cls: ClassInfo, name: string): TypeInfo | null {
        const direct = cls.nested.get(name);
        if (direct)
            return direct;
        for (const nested of cls.nested.values()) {
            if (nested.kind !== 'class')
                continue;
            const found = this.searchNested(nested, name);
            if (found)
                return found;
        }
        return null;
    }
    private enumOf(type: StaticType | undefined): EnumInfo | null {
        if (!type || type.kind !== 'enum')
            return null;
        const found = type.script === null ? this.fileTypes.get(type.name) ?? this.nestedByName(type.name, this.fileTypes) : this.siblingTypes.get(type.name) ?? this.nestedByName(type.name, this.siblingTypes);
        return found?.kind === 'enum' ? found : null;
    }
    private typeRefOf(info: TypeInfo): StaticType {
        return info.kind === 'class' ? { kind: 'class', name: info.name, script: info.script, jsName: info.jsName } : { kind: 'enum', name: info.name, script: info.script, jsName: info.jsName };
    }
    private typeTestOf(ref: TypeRef, cls: ClassInfo | null): TypeTest {
        if (ref.arrayRank > 0)
            return { kind: 'array' };
        const primitive = PRIMITIVE_TYPE_KEYWORDS.get(ref.name);
        if (primitive)
            return primitive === 'object' ? { kind: 'any' } : { kind: 'primitive', name: ref.name };
        switch (ref.name) {
            case 'Int32': return { kind: 'primitive', name: 'int' };
            case 'Double': return { kind: 'primitive', name: 'double' };
            case 'Single': return { kind: 'primitive', name: 'float' };
            case 'Boolean': return { kind: 'primitive', name: 'bool' };
            case 'String': return { kind: 'primitive', name: 'string' };
            case 'Char': return { kind: 'primitive', name: 'char' };
            case 'Array': return { kind: 'array' };
            case 'Object':
            case 'dynamic':
                return { kind: 'any' };
            default:
                break;
        }
        const collection = COLLECTION_ALIASES.get(ref.name);
        if (collection)
            return { kind: 'runtime', name: collection };
        const found = this.lookupType(ref.name, cls, cls?.script ?? null);
        if (found) {
            this.useType(found);
            return { kind: 'script', name: found.name, jsName: found.jsName, sibling: found.script };
        }
        if (RUNTIME_CLASSES.has(ref.name))
            return { kind: 'runtime', name: ref.name };
        if (cls?.typeParameters.has(ref.name))
            return { kind: 'any' };
        this.error(ref.span, `Tipo desconhecido no padrão: "${ref.name}".${hint(ref.name, this.typeNames())}`);
        return { kind: 'any' };
    }
    private typeOfTest(test: TypeTest, ref: TypeRef, cls: ClassInfo | null): StaticType {
        return test.kind === 'any' ? STATIC_TYPES.dynamic : this.typeFromRef(ref, cls);
    }
    private analyzeClass(cls: ClassInfo): void {
        const staticContext: FunctionContext = { cls, isStatic: true, returnType: null, usesAwait: false, usesYield: false, catchDepth: 0 };
        const instanceContext: FunctionContext = { cls, isStatic: false, returnType: null, usesAwait: false, usesYield: false, catchDepth: 0 };
        if (cls.isStatic) {
            for (const member of cls.decl.members) {
                if ((member.kind === 'field' || member.kind === 'property' || member.kind === 'method' || member.kind === 'event') && !member.modifiers.includes('static') && !member.modifiers.includes('const')) {
                    this.error(member.span, `"${cls.name}" é uma classe estática: todos os membros precisam ser static.`);
                }
            }
        }
        for (const member of cls.decl.members) {
            switch (member.kind) {
                case 'field':
                case 'event': {
                    const isStatic = member.modifiers.includes('static') || member.modifiers.includes('const') || cls.isStatic;
                    const type = this.typeFromRef(member.type, cls);
                    for (const declarator of member.declarators) {
                        declarator.jsName = memberJsName(declarator.name);
                        declarator.staticType = type;
                        if (declarator.initializer)
                            this.expression(declarator.initializer, new Scope(null, isStatic ? staticContext : instanceContext), type);
                    }
                    break;
                }
                case 'property': {
                    const isStatic = member.modifiers.includes('static') || cls.isStatic;
                    const type = this.typeFromRef(member.type, cls);
                    const context = isStatic ? staticContext : instanceContext;
                    if (member.initializer)
                        this.expression(member.initializer, new Scope(null, context), type);
                    if (member.expressionBody)
                        this.functionBody(null, member.expressionBody, [], { cls, isStatic, returnType: type, usesAwait: false, usesYield: false, catchDepth: 0 });
                    if (member.getter?.body || member.getter?.expressionBody)
                        this.functionBody(member.getter.body, member.getter.expressionBody, [], { cls, isStatic, returnType: type, usesAwait: false, usesYield: false, catchDepth: 0 });
                    if (member.setter?.body || member.setter?.expressionBody) {
                        const fn: FunctionContext = { cls, isStatic, returnType: STATIC_TYPES.void, usesAwait: false, usesYield: false, catchDepth: 0 };
                        const scope = new Scope(null, fn);
                        scope.declare('value', type);
                        this.functionBody(member.setter.body, member.setter.expressionBody, [], fn, scope);
                    }
                    break;
                }
                case 'indexer': {
                    const type = this.typeFromRef(member.type, cls);
                    const params = member.parameters.map((parameter) => this.paramInfo(parameter, cls));
                    if (member.expressionBody)
                        this.functionBody(null, member.expressionBody, params, { cls, isStatic: false, returnType: type, usesAwait: false, usesYield: false, catchDepth: 0 });
                    if (member.getter?.body || member.getter?.expressionBody)
                        this.functionBody(member.getter.body, member.getter.expressionBody, params, { cls, isStatic: false, returnType: type, usesAwait: false, usesYield: false, catchDepth: 0 });
                    if (member.setter?.body || member.setter?.expressionBody) {
                        const fn: FunctionContext = { cls, isStatic: false, returnType: STATIC_TYPES.void, usesAwait: false, usesYield: false, catchDepth: 0 };
                        const scope = new Scope(null, fn);
                        scope.declare('value', type);
                        this.functionBody(member.setter.body, member.setter.expressionBody, params, fn, scope);
                    }
                    break;
                }
                case 'method':
                    this.analyzeMethod(member, cls);
                    break;
                case 'constructor':
                    this.analyzeConstructor(member, cls);
                    break;
                default:
                    break;
            }
        }
    }
    private analyzeMethod(method: MethodMember, cls: ClassInfo | null): void {
        const isStatic = method.modifiers.includes('static') || (cls?.isStatic ?? false);
        const declaredReturn = this.typeFromRef(method.returnType, cls);
        const info = cls ? this.findMember(cls, method.name, method.parameters.length) : null;
        const params = info?.decl === method ? info.params : method.parameters.map((parameter) => this.paramInfo(parameter, cls));
        const fn: FunctionContext = { cls, isStatic, returnType: bodyReturnType(declaredReturn, method.modifiers.includes('async')), usesAwait: false, usesYield: false, catchDepth: 0 };
        this.functionBody(method.body, method.expressionBody, params, fn);
        method.isIterator = fn.usesYield;
        method.isAsync = method.modifiers.includes('async') || fn.usesAwait;
        if (fn.usesAwait && !method.modifiers.includes('async'))
            this.warn(method.nameSpan, `"${method.name}" usa await sem o modificador async; a engine o trata como async mesmo assim.`);
        if (cls && !isStatic && HOOK_METHOD_NAMES.has(method.name) && !this.isActorClass(cls) && cls.script === null) {
            this.warn(method.nameSpan, `"${method.name}" só é chamado pela engine em classes de ator (: ActorScript); em "${cls.name}" é um método comum.`);
        }
    }
    private analyzeConstructor(ctor: ConstructorMember, cls: ClassInfo): void {
        const isStatic = ctor.modifiers.includes('static');
        const info = cls.ctors.find((entry) => entry.decl === ctor);
        const params = info?.params ?? ctor.parameters.map((parameter) => this.paramInfo(parameter, cls));
        const fn: FunctionContext = { cls, isStatic, returnType: STATIC_TYPES.void, usesAwait: false, usesYield: false, catchDepth: 0 };
        const scope = new Scope(null, fn);
        for (const parameter of params)
            this.declareParam(scope, parameter);
        if (ctor.initializer) {
            for (const argument of ctor.initializer.arguments)
                this.expression(argument.expression, scope, null);
            if (ctor.initializer.kind === 'base' && !cls.base && !cls.baseRuntime)
                this.error(ctor.initializer.span, `"${cls.name}" não tem classe base para base(…) chamar.`);
        }
        this.functionBody(ctor.body, ctor.expressionBody, params, fn, scope, true);
        if (fn.usesAwait)
            this.error(ctor.span, 'Construtores não podem usar await; mova o trabalho assíncrono para OnStart ou um método async.');
    }
    private declareParam(scope: Scope, parameter: ParamInfo): void {
        const byRef = parameter.modifier === 'ref' || parameter.modifier === 'out';
        scope.declare(parameter.name, parameter.type, byRef);
    }
    private functionBody(body: Block | null, expressionBody: Expression | null, params: readonly ParamInfo[], fn: FunctionContext, scope: Scope = new Scope(null, fn), paramsDeclared = false): void {
        if (!paramsDeclared)
            for (const parameter of params)
                this.declareParam(scope, parameter);
        for (const parameter of params) {
            if (parameter.decl.defaultValue)
                this.expression(parameter.decl.defaultValue, scope, parameter.type);
        }
        if (body)
            this.block(body, scope);
        else if (expressionBody)
            this.expression(expressionBody, scope, fn.returnType && fn.returnType.kind !== 'void' ? fn.returnType : null);
    }
    private block(block: Block, parent: Scope): void {
        const scope = new Scope(parent, parent.fn);
        this.statements(block.statements, scope);
    }
    private statements(statements: readonly Statement[], scope: Scope): void {
        for (const statement of statements) {
            if (statement.kind !== 'localFunction')
                continue;
            const method = statement.method;
            const returnType = this.typeFromRef(method.returnType, scope.fn.cls);
            const params = method.parameters.map((parameter) => this.paramInfo(parameter, scope.fn.cls));
            const isAsync = method.modifiers.includes('async');
            const type: StaticType = { kind: 'delegate', params: params.map((parameter) => parameter.type), returns: isAsync && returnType.kind !== 'task' ? { kind: 'task', result: returnType.kind === 'void' ? null : returnType } : returnType };
            method.jsName = localJsName(method.name);
            scope.declare(method.name, type);
        }
        for (const statement of statements)
            this.statement(statement, scope);
    }
    private statement(statement: Statement, scope: Scope): void {
        switch (statement.kind) {
            case 'block':
                this.block(statement, scope);
                return;
            case 'empty':
            case 'break':
            case 'continue':
                return;
            case 'local':
                this.localDeclaration(statement, scope);
                return;
            case 'localFunction': {
                const method = statement.method;
                const local = scope.lookup(method.name);
                const declared = local?.type.kind === 'delegate' ? local.type : null;
                const params = method.parameters.map((parameter) => this.paramInfo(parameter, scope.fn.cls));
                const returnType = declared?.returns ?? this.typeFromRef(method.returnType, scope.fn.cls);
                const fn: FunctionContext = { cls: scope.fn.cls, isStatic: scope.fn.isStatic, returnType: bodyReturnType(returnType, method.modifiers.includes('async')), usesAwait: false, usesYield: false, catchDepth: 0 };
                this.functionBody(method.body, method.expressionBody, params, fn, new Scope(scope, fn));
                method.isIterator = fn.usesYield;
                method.isAsync = method.modifiers.includes('async') || fn.usesAwait;
                return;
            }
            case 'expression':
                this.expression(statement.expression, scope, null);
                return;
            case 'if':
                this.condition(statement.condition, scope);
                this.statement(statement.then, new Scope(scope, scope.fn));
                if (statement.else)
                    this.statement(statement.else, new Scope(scope, scope.fn));
                return;
            case 'while': {
                const inner = new Scope(scope, scope.fn);
                this.condition(statement.condition, inner);
                this.statement(statement.body, inner);
                return;
            }
            case 'do': {
                const inner = new Scope(scope, scope.fn);
                this.statement(statement.body, inner);
                this.condition(statement.condition, inner);
                return;
            }
            case 'for': {
                const inner = new Scope(scope, scope.fn);
                if (statement.declaration)
                    this.localDeclaration(statement.declaration, inner);
                for (const initializer of statement.initializers)
                    this.expression(initializer, inner, null);
                if (statement.condition)
                    this.condition(statement.condition, inner);
                for (const update of statement.updates)
                    this.expression(update, inner, null);
                this.statement(statement.body, inner);
                return;
            }
            case 'foreach': {
                const iterableType = this.expression(statement.iterable, scope, null);
                const inner = new Scope(scope, scope.fn);
                const element = elementTypeOf(iterableType);
                statement.directIterable = isDirectlyIterable(iterableType);
                if (statement.isAwait)
                    scope.fn.usesAwait = true;
                if (statement.name) {
                    const declared = statement.type && statement.type.name !== 'var' ? this.typeFromRef(statement.type, scope.fn.cls) : (element ?? STATIC_TYPES.dynamic);
                    statement.jsName = inner.declare(statement.name, declared).jsName;
                }
                if (statement.deconstruction) {
                    const parts = element?.kind === 'tuple' ? element.elements.map((entry) => entry.type) : element?.kind === 'class' && element.name === 'KeyValuePair' && iterableType.kind === 'collection' ? [iterableType.args[0] ?? STATIC_TYPES.dynamic, iterableType.args[1] ?? STATIC_TYPES.dynamic] : [];
                    statement.deconstructionJsNames = statement.deconstruction.map((name, index) => (name === '_' ? `$_${index}` : inner.declare(name, parts[index] ?? STATIC_TYPES.dynamic).jsName));
                }
                this.statement(statement.body, inner);
                return;
            }
            case 'switch': {
                const valueType = this.expression(statement.value, scope, null);
                for (const section of statement.sections) {
                    const inner = new Scope(scope, scope.fn);
                    for (const label of section.labels) {
                        if (label.kind !== 'case')
                            continue;
                        this.pattern(label.pattern, valueType, inner);
                        if (label.guard)
                            this.condition(label.guard, inner);
                    }
                    this.statements(section.statements, inner);
                }
                return;
            }
            case 'return': {
                const expected = scope.fn.returnType;
                if (statement.expression) {
                    const type = this.expression(statement.expression, scope, expected && expected.kind !== 'void' ? expected : null);
                    if (expected?.kind === 'void' && !scope.fn.usesYield)
                        this.warn(statement.span, 'return com valor num método void; o valor é ignorado.');
                    void type;
                }
                return;
            }
            case 'throw':
                if (statement.expression)
                    this.expression(statement.expression, scope, null);
                else if (scope.fn.catchDepth === 0)
                    this.error(statement.span, '"throw;" sem valor só vale dentro de um catch.');
                return;
            case 'try': {
                this.block(statement.block, scope);
                for (const clause of statement.catches)
                    this.catchClause(clause, scope);
                if (statement.finallyBlock)
                    this.block(statement.finallyBlock, scope);
                return;
            }
            case 'using': {
                const inner = statement.body ? new Scope(scope, scope.fn) : scope;
                if (statement.declaration)
                    this.localDeclaration(statement.declaration, inner);
                if (statement.expression)
                    this.expression(statement.expression, inner, null);
                if (statement.body)
                    this.statement(statement.body, inner);
                return;
            }
            case 'lock':
                this.expression(statement.expression, scope, null);
                this.statement(statement.body, new Scope(scope, scope.fn));
                return;
            case 'yield':
                scope.fn.usesYield = true;
                if (statement.expression)
                    this.expression(statement.expression, scope, null);
                return;
        }
    }
    private catchClause(clause: CatchClause, scope: Scope): void {
        const inner = new Scope(scope, scope.fn);
        if (clause.type) {
            const test = this.typeTestOf(clause.type, scope.fn.cls);
            clause.typeTest = test.kind === 'runtime' || test.kind === 'script' ? test : null;
            if (test.kind === 'primitive' || test.kind === 'array')
                this.error(clause.type.span, `catch precisa de um tipo de exceção, não "${clause.type.name}".`);
        }
        else
            clause.typeTest = null;
        if (clause.name) {
            const type: StaticType = clause.type ? this.typeFromRef(clause.type, scope.fn.cls) : { kind: 'class', name: 'Exception', script: null, runtime: true };
            clause.jsName = inner.declare(clause.name, type.kind === 'dynamic' ? { kind: 'class', name: 'Exception', script: null, runtime: true } : type).jsName;
        }
        if (clause.filter)
            this.condition(clause.filter, inner);
        scope.fn.catchDepth++;
        this.block(clause.block, inner);
        scope.fn.catchDepth--;
    }
    private localDeclaration(declaration: Statement & {
        kind: 'local';
    }, scope: Scope): void {
        if (declaration.deconstruction) {
            const type = this.expression(declaration.deconstruction.initializer, scope, null);
            const parts = type.kind === 'tuple' ? type.elements.map((entry) => entry.type) : [];
            declaration.deconstruction.jsNames = declaration.deconstruction.names.map((name, index) => (name === '_' ? `$_${index}` : scope.declare(name, parts[index] ?? STATIC_TYPES.dynamic).jsName));
            return;
        }
        const isVar = declaration.type.name === 'var' && declaration.type.typeArguments.length === 0 && declaration.type.arrayRank === 0;
        const declared = isVar ? null : this.typeFromRef(declaration.type, scope.fn.cls);
        for (const declarator of declaration.declarators) {
            let type = declared ?? STATIC_TYPES.dynamic;
            if (declarator.initializer) {
                const inferred = this.expression(declarator.initializer, scope, declared);
                if (isVar)
                    type = inferred.kind === 'null' || inferred.kind === 'void' ? STATIC_TYPES.dynamic : inferred;
            }
            else if (isVar)
                this.error(declarator.span, `"var ${declarator.name}" precisa de um valor inicial para o tipo ser inferido.`);
            if (scope.lookupInFunction(declarator.name))
                this.error(declarator.span, `A variável "${declarator.name}" já foi declarada neste escopo.`);
            declarator.staticType = type;
            declarator.jsName = scope.declare(declarator.name, type).jsName;
        }
    }
    private condition(expression: Expression, scope: Scope): void {
        const type = this.expression(expression, scope, STATIC_TYPES.bool);
        if (isNumericType(type) || type.kind === 'string' || type.kind === 'char')
            this.error(expression.span, `A condição precisa ser bool, mas é ${describeType(type)}.`);
    }
}
