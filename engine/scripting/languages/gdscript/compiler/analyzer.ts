import type { CompileDiagnostic, CompileSeverity } from '../../../compiler/compile-types';
import type { ForeignSibling } from '../../language-engine';
import type { AssignmentStatement, BinaryOperator, Block, CallExpression, ClassDeclaration, ClassMember, ConstantMember, EnumMember, Expression, FunctionMember, IdentifierExpression, LambdaExpression, MemberExpression, MemberKind, Parameter, Pattern, Resolution, ScriptFile, StaticType, Statement, TypeRef, VariableMember, } from './ast';
import { typeRefToString } from './ast';
import { parse } from './parser';
import type { SourceSpan } from './tokens';
import { CONSTANTS, GLOBAL_FUNCTIONS, IO_NAMES, KEY_CODES, TYPE_CONSTANTS } from '../runtime/globals';
import { BUILTIN_TYPE_NAMES } from '../runtime/variant';
import { ARRAY_METHODS, CALLABLE_METHODS, DICT_METHODS, STRING_METHODS, STRING_STATICS, closest } from '../runtime/methods';
import { AABB, Basis, Color, Quaternion, Rect2, Signal, Transform3D, Vector2, Vector2i, Vector3, Vector3i, Vector4 } from '../runtime/values';
import { CONSTRUCTIBLE_OBJECT_CLASSES, GLOBAL_ARITY, GLOBAL_RETURN_TYPES, GODOT_CONSTANTS, GODOT_VIRTUALS, JSON_INSTANCE_MEMBERS, NODE_METHODS, NODE_PROPERTIES, NODE_SIGNALS, SAME_TYPE_GLOBALS, SINGLETON_MEMBERS, SINGLETON_NAMES, baseMemberVisible, godotIsA, isGodotClass, isGodotNodeClass, } from '../runtime/godot-api';
export interface AnalyzeInput {
    readonly file: ScriptFile;
    readonly fileName: string;
    readonly scriptName: string;
    readonly siblings: readonly ForeignSibling[];
}
export interface AnalysisResult {
    readonly diagnostics: CompileDiagnostic[];
    readonly program: ProgramInfo | null;
}
export interface ProgramInfo {
    readonly main: ClassInfo;
    readonly classes: readonly ClassInfo[];
    readonly staticInits: readonly StaticInit[];
    readonly dependencies: readonly string[];
}
export interface StaticInit {
    readonly owner: ClassInfo;
    readonly member: MemberInfo;
}
export interface ClassInfo {
    readonly name: string;
    readonly typeName: string;
    readonly jsName: string;
    readonly decl: ScriptFile | ClassDeclaration;
    readonly isMain: boolean;
    readonly isSibling: boolean;
    readonly scriptName: string | null;
    readonly outer: ClassInfo | null;
    parent: ClassInfo | null;
    godotBase: string;
    readonly members: Map<string, MemberInfo>;
    readonly inner: Map<string, ClassInfo>;
}
export interface MemberInfo {
    readonly name: string;
    readonly kind: MemberKind;
    readonly isStatic: boolean;
    type: StaticType;
    readonly backingField: string | null;
    readonly owner: ClassInfo;
    readonly span: SourceSpan;
    readonly decl: ClassMember | null;
    readonly func: FunctionMember | null;
    readonly enumValues: Map<string, number> | null;
    readonly inner: ClassInfo | null;
    constValue?: unknown;
}
export function siblingAlias(scriptName: string): string {
    return `$sib_${scriptName.replace(/[^A-Za-z0-9_]/g, '_')}`;
}
export function siblingAccess(scriptName: string): string {
    return `${siblingAlias(scriptName)}()`;
}
const SOURCE = 'GDScript';
const JS_RESERVED: ReadonlySet<string> = new Set([
    'arguments',
    'await',
    'break',
    'case',
    'catch',
    'class',
    'const',
    'continue',
    'debugger',
    'default',
    'delete',
    'do',
    'else',
    'enum',
    'eval',
    'export',
    'extends',
    'false',
    'finally',
    'for',
    'function',
    'if',
    'implements',
    'import',
    'in',
    'instanceof',
    'interface',
    'let',
    'new',
    'null',
    'package',
    'private',
    'protected',
    'public',
    'return',
    'static',
    'super',
    'switch',
    'this',
    'throw',
    'true',
    'try',
    'typeof',
    'undefined',
    'var',
    'void',
    'while',
    'with',
    'yield',
    'NaN',
    'Infinity',
    'Object',
    'Array',
    'String',
    'Number',
    'Boolean',
    'Math',
    'JSON',
    'Promise',
    'Symbol',
    'Error',
    'Map',
    'Set',
    'helix',
    'require',
    'module',
    'exports',
    'console',
    'globalThis',
    'window',
    'self',
]);
const VECTOR_TYPES: ReadonlySet<string> = new Set(['Vector2', 'Vector2i', 'Vector3', 'Vector3i', 'Vector4']);
const VALUE_TYPES: ReadonlySet<string> = new Set([...VECTOR_TYPES, 'Quaternion', 'Basis', 'Transform3D', 'Color', 'Rect2', 'AABB']);
const STRING_TYPES: ReadonlySet<string> = new Set(['String', 'StringName', 'NodePath']);
const NON_NULLABLE: ReadonlySet<string> = new Set(['int', 'float', 'bool', ...STRING_TYPES, ...VALUE_TYPES, 'Array', 'Dictionary', 'Callable', 'Signal']);
const VALUE_CLASSES: Readonly<Record<string, {
    readonly ctor: object;
    readonly sample: object;
}>> = {
    Vector2: { ctor: Vector2, sample: new Vector2() },
    Vector2i: { ctor: Vector2i, sample: new Vector2i() },
    Vector3: { ctor: Vector3, sample: new Vector3() },
    Vector3i: { ctor: Vector3i, sample: new Vector3i() },
    Vector4: { ctor: Vector4, sample: new Vector4() },
    Quaternion: { ctor: Quaternion, sample: new Quaternion() },
    Basis: { ctor: Basis, sample: new Basis() },
    Transform3D: { ctor: Transform3D, sample: new Transform3D() },
    Color: { ctor: Color, sample: new Color() },
    Rect2: { ctor: Rect2, sample: new Rect2() },
    AABB: { ctor: AABB, sample: new AABB() },
};
const VALUE_FIELDS: Readonly<Record<string, Readonly<Record<string, StaticType>>>> = {
    Vector2: { x: 'float', y: 'float' },
    Vector2i: { x: 'int', y: 'int' },
    Vector3: { x: 'float', y: 'float', z: 'float' },
    Vector3i: { x: 'int', y: 'int', z: 'int' },
    Vector4: { x: 'float', y: 'float', z: 'float', w: 'float' },
    Quaternion: { x: 'float', y: 'float', z: 'float', w: 'float' },
    Color: { r: 'float', g: 'float', b: 'float', a: 'float', r8: 'int', g8: 'int', b8: 'int', a8: 'int', h: 'float', s: 'float', v: 'float' },
    Basis: { x: 'Vector3', y: 'Vector3', z: 'Vector3' },
    Transform3D: { basis: 'Basis', origin: 'Vector3' },
    Rect2: { position: 'Vector2', size: 'Vector2', end: 'Vector2' },
    AABB: { position: 'Vector3', size: 'Vector3', end: 'Vector3' },
};
const VECTOR_FLOAT_METHODS: ReadonlySet<string> = new Set(['length', 'length_squared', 'dot', 'distance_to', 'distance_squared_to', 'angle_to', 'signed_angle_to', 'angle', 'aspect', 'angle_to_point']);
const CONSTRUCTOR_ARITY: Readonly<Record<string, readonly number[]>> = {
    Vector2: [0, 1, 2],
    Vector2i: [0, 1, 2],
    Vector3: [0, 1, 3],
    Vector3i: [0, 1, 3],
    Vector4: [0, 1, 4],
    Quaternion: [0, 1, 2, 4],
    Color: [0, 1, 2, 3, 4],
    Basis: [0, 1, 2, 3],
    Transform3D: [0, 1, 2, 4],
    Rect2: [0, 1, 2, 4],
    AABB: [0, 1, 2],
};
const STRING_INT_METHODS: ReadonlySet<string> = new Set(['length', 'find', 'findn', 'rfind', 'rfindn', 'count', 'countn', 'to_int', 'hex_to_int', 'bin_to_int', 'get_slice_count', 'casecmp_to', 'nocasecmp_to', 'naturalnocasecmp_to', 'unicode_at', 'hash']);
const STRING_FLOAT_METHODS: ReadonlySet<string> = new Set(['to_float', 'similarity']);
const STRING_ARRAY_METHODS: ReadonlySet<string> = new Set(['split', 'rsplit', 'split_floats', 'to_ascii_buffer', 'to_utf8_buffer', 'to_utf16_buffer']);
const STRING_BOOL_METHODS: ReadonlySet<string> = new Set(['is_empty', 'begins_with', 'ends_with', 'contains', 'containsn', 'is_absolute_path', 'is_relative_path', 'match', 'matchn', 'is_subsequence_of', 'is_subsequence_ofn']);
const ARRAY_INT_METHODS: ReadonlySet<string> = new Set(['size', 'find', 'rfind', 'find_custom', 'rfind_custom', 'count', 'bsearch', 'bsearch_custom', 'hash', 'get_typed_builtin']);
const ARRAY_BOOL_METHODS: ReadonlySet<string> = new Set(['is_empty', 'has', 'any', 'all', 'is_read_only', 'is_typed', 'is_same_typed']);
const ARRAY_ELEMENT_METHODS: ReadonlySet<string> = new Set(['pop_back', 'pop_front', 'pop_at', 'front', 'back', 'get', 'pick_random', 'min', 'max']);
const ARRAY_ARRAY_METHODS: ReadonlySet<string> = new Set(['duplicate', 'slice', 'map', 'filter']);
const ARRAY_VOID_METHODS: ReadonlySet<string> = new Set(['append', 'push_back', 'push_front', 'insert', 'remove_at', 'clear', 'set', 'reverse', 'sort', 'sort_custom', 'shuffle', 'append_array', 'assign', 'fill', 'resize', 'make_read_only']);
const DICT_RETURNS: Readonly<Record<string, StaticType>> = {
    size: 'int',
    hash: 'int',
    is_empty: 'bool',
    has: 'bool',
    has_all: 'bool',
    erase: 'bool',
    is_read_only: 'bool',
    is_typed: 'bool',
    is_typed_key: 'bool',
    is_typed_value: 'bool',
    recursive_equal: 'bool',
    keys: 'Array',
    values: 'Array',
    duplicate: 'Dictionary',
    merged: 'Dictionary',
    get: 'Variant',
    get_or_add: 'Variant',
    find_key: 'Variant',
    set: 'bool',
    clear: 'void',
    merge: 'void',
    sort: 'void',
    make_read_only: 'void',
};
const CALLABLE_RETURNS: Readonly<Record<string, StaticType>> = {
    call: 'Variant',
    callv: 'Variant',
    call_deferred: 'void',
    bind: 'Callable',
    bindv: 'Callable',
    unbind: 'Callable',
    is_valid: 'bool',
    is_null: 'bool',
    is_custom: 'bool',
    is_standard: 'bool',
    get_object: 'Object',
    get_method: 'String',
    get_bound_arguments_count: 'int',
    get_bound_arguments: 'Array',
    get_argument_count: 'int',
    hash: 'int',
    rpc: 'void',
};
const SIGNAL_RETURNS: Readonly<Record<string, StaticType>> = {
    connect: 'int',
    disconnect: 'void',
    is_connected: 'bool',
    has_connections: 'bool',
    get_connections: 'Array',
    get_name: 'String',
    get_object: 'Object',
    is_null: 'bool',
    emit: 'void',
    wait: 'Variant',
};
const PACKED_ELEMENTS: Readonly<Record<string, StaticType>> = {
    PackedByteArray: 'int',
    PackedInt32Array: 'int',
    PackedInt64Array: 'int',
    PackedFloat32Array: 'float',
    PackedFloat64Array: 'float',
    PackedStringArray: 'String',
    PackedVector2Array: 'Vector2',
    PackedVector3Array: 'Vector3',
    PackedColorArray: 'Color',
};
const FLOAT_CONSTANTS: ReadonlySet<string> = new Set(['PI', 'TAU', 'INF', 'NAN']);
const SIGNAL_METHOD_NAMES: readonly string[] = Object.keys(SIGNAL_RETURNS);
function ancestorsOf(cls: ClassInfo): ClassInfo[] {
    const chain: ClassInfo[] = [];
    let current = cls.parent;
    while (current) {
        chain.push(current);
        current = current.parent;
    }
    return chain;
}
function isMeta(type: StaticType): boolean {
    return type.startsWith('@');
}
function isNumeric(type: StaticType): boolean {
    return type === 'int' || type === 'float';
}
function arrayElement(type: StaticType): StaticType {
    if (type.startsWith('Array['))
        return type.slice(6, -1);
    return PACKED_ELEMENTS[type] ?? 'Variant';
}
function isArrayType(type: StaticType): boolean {
    return type === 'Array' || type.startsWith('Array[') || type in PACKED_ELEMENTS;
}
function baseTypeName(type: StaticType): string {
    const generic = type.indexOf('[');
    return generic === -1 ? type : type.slice(0, generic);
}
function describeType(type: StaticType): string {
    if (type.startsWith('@class:'))
        return `a classe ${type.slice(7)}`;
    if (type.startsWith('@type:'))
        return `o tipo ${type.slice(6)}`;
    if (type.startsWith('@enum:'))
        return `o enum ${type.slice(6)}`;
    if (type.startsWith('@singleton:'))
        return `o singleton ${type.slice(11)}`;
    return type;
}
export function jsIdentifier(name: string): string {
    return JS_RESERVED.has(name) || name.startsWith('$') ? `${name}$` : name;
}
function spanOf(span: SourceSpan): Pick<CompileDiagnostic, 'line' | 'column' | 'endLine' | 'endColumn'> {
    return { line: span.line, column: span.column, endLine: span.endLine, endColumn: span.endColumn };
}
function containsAwait(block: Block): boolean {
    let found = false;
    const visitExpression = (e: Expression | null): void => {
        if (!e || found)
            return;
        switch (e.kind) {
            case 'await':
                found = true;
                return;
            case 'lambda':
                return;
            case 'array':
                e.elements.forEach(visitExpression);
                return;
            case 'dictionary':
                for (const entry of e.entries) {
                    visitExpression(entry.key);
                    visitExpression(entry.value);
                }
                return;
            case 'member':
                visitExpression(e.object);
                return;
            case 'index':
                visitExpression(e.object);
                visitExpression(e.index);
                return;
            case 'call':
                visitExpression(e.callee);
                e.args.forEach(visitExpression);
                return;
            case 'unary':
                visitExpression(e.operand);
                return;
            case 'binary':
                visitExpression(e.left);
                visitExpression(e.right);
                return;
            case 'ternary':
                visitExpression(e.condition);
                visitExpression(e.whenTrue);
                visitExpression(e.whenFalse);
                return;
            case 'is':
            case 'as':
                visitExpression(e.value);
                return;
            default:
                return;
        }
    };
    const visitPattern = (pattern: Pattern): void => {
        if (pattern.kind === 'value')
            visitExpression(pattern.value);
        else if (pattern.kind === 'array')
            pattern.elements.forEach(visitPattern);
        else if (pattern.kind === 'dictionary') {
            for (const entry of pattern.entries) {
                visitExpression(entry.key);
                if (entry.value)
                    visitPattern(entry.value);
            }
        }
    };
    const visitBlock = (b: Block): void => {
        for (const statement of b.statements) {
            if (found)
                return;
            switch (statement.kind) {
                case 'expression':
                    visitExpression(statement.expression);
                    break;
                case 'assignment':
                    visitExpression(statement.target);
                    visitExpression(statement.value);
                    break;
                case 'variable':
                    visitExpression(statement.value);
                    break;
                case 'constant':
                    visitExpression(statement.value);
                    break;
                case 'if':
                    visitExpression(statement.condition);
                    visitBlock(statement.then);
                    if (statement.otherwise)
                        visitBlock(statement.otherwise);
                    break;
                case 'while':
                    visitExpression(statement.condition);
                    visitBlock(statement.body);
                    break;
                case 'for':
                    visitExpression(statement.iterable);
                    visitBlock(statement.body);
                    break;
                case 'match':
                    visitExpression(statement.value);
                    for (const branch of statement.branches) {
                        branch.patterns.forEach(visitPattern);
                        visitExpression(branch.guard);
                        visitBlock(branch.body);
                    }
                    break;
                case 'return':
                    visitExpression(statement.value);
                    break;
                case 'assert':
                    visitExpression(statement.condition);
                    visitExpression(statement.message);
                    break;
                default:
                    break;
            }
        }
    };
    visitBlock(block);
    return found;
}
function collectAssigned(block: Block, into: Set<string>): void {
    const visitExpression = (e: Expression | null): void => {
        if (!e)
            return;
        switch (e.kind) {
            case 'lambda':
                collectAssigned(e.body, into);
                return;
            case 'array':
                e.elements.forEach(visitExpression);
                return;
            case 'dictionary':
                for (const entry of e.entries) {
                    visitExpression(entry.key);
                    visitExpression(entry.value);
                }
                return;
            case 'member':
                visitExpression(e.object);
                return;
            case 'index':
                visitExpression(e.object);
                visitExpression(e.index);
                return;
            case 'call':
                visitExpression(e.callee);
                e.args.forEach(visitExpression);
                return;
            case 'unary':
                visitExpression(e.operand);
                return;
            case 'binary':
                visitExpression(e.left);
                visitExpression(e.right);
                return;
            case 'ternary':
                visitExpression(e.condition);
                visitExpression(e.whenTrue);
                visitExpression(e.whenFalse);
                return;
            case 'is':
            case 'as':
            case 'await':
                visitExpression(e.value);
                return;
            default:
                return;
        }
    };
    for (const statement of block.statements) {
        switch (statement.kind) {
            case 'assignment':
                if (statement.target.kind === 'identifier')
                    into.add(statement.target.name);
                else
                    visitExpression(statement.target);
                visitExpression(statement.value);
                break;
            case 'expression':
                visitExpression(statement.expression);
                break;
            case 'variable':
                visitExpression(statement.value);
                break;
            case 'constant':
                visitExpression(statement.value);
                break;
            case 'if':
                visitExpression(statement.condition);
                collectAssigned(statement.then, into);
                if (statement.otherwise)
                    collectAssigned(statement.otherwise, into);
                break;
            case 'while':
                visitExpression(statement.condition);
                collectAssigned(statement.body, into);
                break;
            case 'for':
                visitExpression(statement.iterable);
                collectAssigned(statement.body, into);
                break;
            case 'match':
                visitExpression(statement.value);
                for (const branch of statement.branches) {
                    visitExpression(branch.guard);
                    collectAssigned(branch.body, into);
                }
                break;
            case 'return':
                visitExpression(statement.value);
                break;
            case 'assert':
                visitExpression(statement.condition);
                visitExpression(statement.message);
                break;
            default:
                break;
        }
    }
}
interface LocalInfo {
    readonly name: string;
    readonly jsName: string;
    readonly type: StaticType;
    readonly isConst: boolean;
    readonly isParam: boolean;
    readonly span: SourceSpan;
    used: boolean;
}
interface Scope {
    readonly locals: Map<string, LocalInfo>;
    readonly parent: Scope | null;
    readonly fn: FunctionContext;
}
interface FunctionContext {
    readonly cls: ClassInfo;
    readonly isStatic: boolean;
    readonly name: string | null;
    readonly returnType: StaticType | null;
    readonly isLambda: boolean;
    readonly parent: FunctionContext | null;
    readonly captures: Set<string>;
    readonly assigned: Set<string>;
    readonly accessorOf: string | null;
    readonly isInitializer: boolean;
    loopDepth: number;
    hasAwait: boolean;
}
interface MemberLookup {
    readonly type: StaticType;
    readonly callable: boolean;
    readonly min?: number;
    readonly max?: number;
    readonly resolution?: Resolution;
    readonly readonly: boolean;
    readonly func?: FunctionMember | null;
    readonly what: string;
}
const siblingParseCache = new Map<string, ScriptFile | null>();
function parseSibling(sibling: ForeignSibling): ScriptFile | null {
    const key = `${sibling.name}\u0000${sibling.source}`;
    const cached = siblingParseCache.get(key);
    if (cached !== undefined)
        return cached;
    if (siblingParseCache.size > 96)
        siblingParseCache.clear();
    let parsed: ScriptFile | null = null;
    try {
        const result = parse(sibling.source);
        parsed = result.diagnostics.length === 0 ? result.file : result.file;
    }
    catch {
        parsed = null;
    }
    siblingParseCache.set(key, parsed);
    return parsed;
}
class Analyzer {
    private readonly diagnostics: CompileDiagnostic[] = [];
    private silent = 0;
    private readonly classes: ClassInfo[] = [];
    private readonly classesByTypeName = new Map<string, ClassInfo>();
    private readonly siblingsByClassName = new Map<string, ClassInfo>();
    private readonly siblingsByScript = new Map<string, ClassInfo>();
    private readonly siblingsByFile = new Map<string, ClassInfo>();
    private readonly dependencies = new Set<string>();
    private readonly staticInits: StaticInit[] = [];
    private readonly staticState = new Map<MemberInfo, 'doing' | 'done'>();
    private readonly usedClassJsNames = new Set<string>();
    private fn: FunctionContext | null = null;
    private scope: Scope | null = null;
    private main: ClassInfo | null = null;
    constructor(private readonly input: AnalyzeInput) { }
    run(): AnalysisResult {
        this.indexSiblings();
        const main = this.collectClass(this.input.file, null, true, null);
        this.main = main;
        for (const cls of this.classes)
            this.resolveHierarchy(cls, new Set());
        for (const cls of this.classes)
            this.declareMemberTypes(cls);
        for (const cls of this.classes)
            this.checkMembersAgainstBase(cls);
        for (const cls of this.classes)
            for (const member of cls.members.values())
                if (member.isStatic && (member.kind === 'const' || member.kind === 'enum' || member.kind === 'enum_value' || member.kind === 'var'))
                    this.ensureStaticInit(member);
        for (const cls of this.classes)
            this.analyzeInstanceInitializers(cls);
        for (const cls of this.classes)
            this.analyzeFunctions(cls);
        const hasErrors = this.diagnostics.some((d) => d.severity === 'error');
        return {
            diagnostics: this.diagnostics,
            program: hasErrors ? null : { main, classes: this.classes, staticInits: this.staticInits, dependencies: [...this.dependencies] },
        };
    }
    private report(severity: CompileSeverity, span: SourceSpan, message: string): void {
        if (this.silent > 0)
            return;
        this.diagnostics.push({ severity, message, source: SOURCE, ...spanOf(span) });
    }
    private error(span: SourceSpan, message: string): void {
        this.report('error', span, message);
    }
    private warn(span: SourceSpan, message: string): void {
        this.report('warning', span, message);
    }
    private suggest(name: string, candidates: Iterable<string>): string {
        const hint = closest(name, candidates);
        return hint && hint !== name ? ` Você quis dizer "${hint}"?` : '';
    }
    private indexSiblings(): void {
        this.silent++;
        try {
            for (const sibling of this.input.siblings) {
                if (sibling.name === this.input.scriptName)
                    continue;
                const parsed = parseSibling(sibling);
                if (!parsed)
                    continue;
                const info = this.collectClass(parsed, null, false, sibling);
                this.siblingsByScript.set(sibling.name, info);
                this.siblingsByFile.set(sibling.file, info);
                if (parsed.className)
                    this.siblingsByClassName.set(parsed.className, info);
            }
            for (const info of this.siblingsByScript.values()) {
                this.resolveHierarchy(info, new Set());
                this.declareMemberTypes(info);
                for (const member of info.members.values())
                    if (member.kind === 'enum' || member.kind === 'enum_value' || member.kind === 'const')
                        this.ensureStaticInit(member);
                for (const inner of this.allInner(info)) {
                    this.resolveHierarchy(inner, new Set());
                    this.declareMemberTypes(inner);
                    for (const member of inner.members.values())
                        if (member.kind === 'enum' || member.kind === 'enum_value' || member.kind === 'const')
                            this.ensureStaticInit(member);
                }
            }
        }
        finally {
            this.silent--;
        }
    }
    private *allInner(cls: ClassInfo): Iterable<ClassInfo> {
        for (const inner of cls.inner.values()) {
            yield inner;
            yield* this.allInner(inner);
        }
    }
    private siblingByPath(path: string): ClassInfo | null {
        const clean = path.replace(/^res:\/\//, '').replace(/^user:\/\//, '');
        const file = clean.slice(clean.lastIndexOf('/') + 1);
        const direct = this.siblingsByFile.get(file);
        if (direct)
            return direct;
        const stem = file.replace(/\.(gd|gdscript)$/i, '');
        return this.siblingsByScript.get(stem) ?? null;
    }
    private useClass(cls: ClassInfo): void {
        if (this.silent === 0 && cls.isSibling && cls.scriptName)
            this.dependencies.add(cls.scriptName);
    }
    private classJsName(name: string, outer: ClassInfo | null, sibling: ForeignSibling | null): string {
        if (sibling)
            return siblingAccess(sibling.name);
        let candidate = jsIdentifier(name);
        if (this.usedClassJsNames.has(candidate) && outer)
            candidate = `${outer.jsName}_${candidate}`;
        while (this.usedClassJsNames.has(candidate))
            candidate += '_';
        this.usedClassJsNames.add(candidate);
        return candidate;
    }
    private collectClass(decl: ScriptFile | ClassDeclaration, outer: ClassInfo | null, isMain: boolean, sibling: ForeignSibling | null): ClassInfo {
        const name = 'kind' in decl ? decl.name : (decl.className ?? (sibling ? sibling.name : this.input.scriptName));
        const typeName = outer ? `${outer.typeName}.${name}` : name;
        const cls: ClassInfo = {
            name,
            typeName,
            jsName: sibling && !outer ? this.classJsName(name, null, sibling) : outer?.isSibling ? `${outer.jsName}.${name}` : this.classJsName(name, outer, null),
            decl,
            isMain,
            isSibling: sibling !== null || (outer?.isSibling ?? false),
            scriptName: sibling ? sibling.name : (outer?.scriptName ?? null),
            outer,
            parent: null,
            godotBase: 'kind' in decl ? 'RefCounted' : 'Node3D',
            members: new Map(),
            inner: new Map(),
        };
        if ('kind' in decl)
            decl.jsName = cls.jsName;
        if (!cls.isSibling) {
            if (BUILTIN_TYPE_NAMES.includes(name) || isGodotClass(name) || SINGLETON_NAMES.includes(name)) {
                this.error('kind' in decl ? decl.nameSpan : (decl.classNameSpan ?? decl.span), `"${name}" já é um tipo do Godot; escolha outro nome para a classe.`);
            }
            if (outer && this.lookupClassLexical(name, outer))
                this.warn('kind' in decl ? decl.nameSpan : decl.span, `A classe interna "${name}" esconde outra classe de mesmo nome.`);
        }
        const add = (member: MemberInfo): void => {
            const existing = cls.members.get(member.name);
            if (existing) {
                this.error(member.span, `Já existe um membro chamado "${member.name}" nesta classe (declarado na linha ${existing.span.line}).`);
                return;
            }
            if (member.name === 'constructor' || member.name === '__proto__' || (member.isStatic && member.name === 'prototype')) {
                this.error(member.span, `"${member.name}" é um nome reservado pela engine; escolha outro.`);
                return;
            }
            cls.members.set(member.name, member);
        };
        for (const member of decl.members) {
            switch (member.kind) {
                case 'variable':
                    add({
                        name: member.name,
                        kind: 'var',
                        isStatic: member.isStatic,
                        type: 'Variant',
                        backingField: member.accessors ? `${member.name}$` : null,
                        owner: cls,
                        span: member.nameSpan,
                        decl: member,
                        func: null,
                        enumValues: null,
                        inner: null,
                    });
                    break;
                case 'constant':
                    add({ name: member.name, kind: 'const', isStatic: true, type: 'Variant', backingField: null, owner: cls, span: member.nameSpan, decl: member, func: null, enumValues: null, inner: null });
                    break;
                case 'enum':
                    if (member.name) {
                        add({ name: member.name, kind: 'enum', isStatic: true, type: 'Dictionary', backingField: null, owner: cls, span: member.span, decl: member, func: null, enumValues: new Map(), inner: null });
                    }
                    else {
                        for (const value of member.values) {
                            add({ name: value.name, kind: 'enum_value', isStatic: true, type: 'int', backingField: null, owner: cls, span: value.span, decl: member, func: null, enumValues: null, inner: null });
                        }
                    }
                    break;
                case 'signal':
                    add({ name: member.name, kind: 'signal', isStatic: false, type: 'Signal', backingField: null, owner: cls, span: member.span, decl: member, func: null, enumValues: null, inner: null });
                    break;
                case 'function':
                    add({ name: member.name, kind: 'func', isStatic: member.isStatic, type: 'Variant', backingField: null, owner: cls, span: member.nameSpan, decl: member, func: member, enumValues: null, inner: null });
                    break;
                case 'class': {
                    const inner = this.collectClass(member, cls, false, null);
                    cls.inner.set(member.name, inner);
                    add({ name: member.name, kind: 'class', isStatic: true, type: `@class:${inner.typeName}`, backingField: null, owner: cls, span: member.nameSpan, decl: member, func: null, enumValues: null, inner });
                    break;
                }
                default:
                    break;
            }
        }
        if (!cls.isSibling) {
            this.classes.push(cls);
            this.classesByTypeName.set(typeName, cls);
            if (!outer)
                this.classesByTypeName.set(name, cls);
        }
        else {
            this.classesByTypeName.set(typeName, cls);
        }
        return cls;
    }
    private readonly hierarchyResolved = new Set<ClassInfo>();
    private resolveHierarchy(cls: ClassInfo, visiting: Set<ClassInfo>): void {
        if (this.hierarchyResolved.has(cls))
            return;
        if (visiting.has(cls)) {
            this.error(cls.decl.span, `A classe "${cls.name}" herda de si mesma (ciclo de extends).`);
            cls.parent = null;
            return;
        }
        visiting.add(cls);
        const decl = cls.decl;
        const extendsPath = decl.extendsPath;
        const extendsType = decl.extendsType;
        let parent: ClassInfo | null = null;
        let godotBase: string | null = null;
        if (extendsPath) {
            const target = this.siblingByPath(extendsPath);
            if (!target)
                this.error(decl.span, `Não encontrei o script "${extendsPath}" no projeto para estender.${this.suggest(extendsPath.slice(extendsPath.lastIndexOf('/') + 1), [...this.siblingsByFile.keys()])}`);
            else
                parent = target;
        }
        else if (extendsType) {
            const name = extendsType.name;
            if (extendsType.args.length > 0)
                this.error(extendsType.span, 'A classe base não aceita parâmetros de tipo.');
            const found = this.lookupClassLexical(name, cls.outer) ?? this.siblingsByClassName.get(name) ?? null;
            if (found === cls) {
                this.error(extendsType.span, `"${name}" não pode estender a si mesma.`);
            }
            else if (found) {
                parent = found;
            }
            else if (isGodotClass(name) || name === 'Object' || name === 'Node') {
                godotBase = name;
            }
            else if (BUILTIN_TYPE_NAMES.includes(name)) {
                this.error(extendsType.span, `Não é possível estender o tipo embutido "${name}".`);
            }
            else {
                const candidates = [...this.siblingsByClassName.keys(), ...this.classesByTypeName.keys(), 'Node', 'Node3D', 'CharacterBody3D', 'RigidBody3D', 'Area3D', 'StaticBody3D', 'Camera3D', 'RefCounted', 'Resource', 'Object'];
                this.error(extendsType.span, `Classe base desconhecida: "${name}".${this.suggest(name, candidates)}`);
            }
        }
        if (parent) {
            this.useClass(parent);
            cls.parent = parent;
            this.resolveHierarchy(parent, visiting);
            cls.godotBase = parent.godotBase;
        }
        else if (godotBase) {
            cls.godotBase = godotBase;
        }
        visiting.delete(cls);
        this.hierarchyResolved.add(cls);
    }
    private lookupClassLexical(name: string, from: ClassInfo | null): ClassInfo | null {
        for (let c: ClassInfo | null = from; c; c = c.outer) {
            if (c.name === name)
                return c;
            for (let p: ClassInfo | null = c; p; p = p.parent) {
                const inner = p.inner.get(name);
                if (inner)
                    return inner;
            }
        }
        if (this.main && this.main.name === name)
            return this.main;
        return null;
    }
    private lookupClass(name: string, from: ClassInfo | null): ClassInfo | null {
        const dot = name.indexOf('.');
        if (dot !== -1) {
            const head = this.lookupClass(name.slice(0, dot), from);
            return head ? this.lookupClass(name.slice(dot + 1), head) ?? head.inner.get(name.slice(dot + 1)) ?? null : null;
        }
        const lexical = this.lookupClassLexical(name, from);
        if (lexical)
            return lexical;
        const sibling = this.siblingsByClassName.get(name);
        if (sibling)
            return sibling;
        return null;
    }
    private lookupEnum(name: string, from: ClassInfo | null): MemberInfo | null {
        const dot = name.indexOf('.');
        if (dot !== -1) {
            const head = this.lookupClass(name.slice(0, dot), from);
            if (!head)
                return null;
            const member = this.findMember(head, name.slice(dot + 1));
            return member && member.kind === 'enum' ? member : null;
        }
        for (let c: ClassInfo | null = from; c; c = c.outer) {
            const member = this.findMember(c, name);
            if (member && member.kind === 'enum')
                return member;
        }
        return null;
    }
    private findMember(cls: ClassInfo, name: string): MemberInfo | null {
        for (let c: ClassInfo | null = cls; c; c = c.parent) {
            const member = c.members.get(name);
            if (member)
                return member;
        }
        return null;
    }
    private findStaticInOuters(cls: ClassInfo, name: string): MemberInfo | null {
        for (let o = cls.outer; o; o = o.outer) {
            const member = this.findMember(o, name);
            if (member && member.isStatic)
                return member;
        }
        return null;
    }
    private inherits(from: ClassInfo, to: string): boolean {
        for (let c: ClassInfo | null = from; c; c = c.parent)
            if (c.typeName === to || c.name === to)
                return true;
        return godotIsA(from.godotBase, to);
    }
    private resolveTypeRef(ref: TypeRef, cls: ClassInfo): StaticType {
        const name = ref.name;
        if (name === 'void') {
            ref.resolved = { kind: 'void' };
            return 'void';
        }
        if (name === 'Variant') {
            ref.resolved = { kind: 'variant' };
            return 'Variant';
        }
        if (BUILTIN_TYPE_NAMES.includes(name)) {
            if (name === 'Array' && ref.args.length === 1) {
                const element = this.resolveTypeRef(ref.args[0]!, cls);
                const elementRuntime = ref.args[0]!.resolved?.kind === 'builtin' ? (ref.args[0]!.resolved as {
                    runtimeName: string;
                }).runtimeName : null;
                const staticType = `Array[${element}]`;
                ref.resolved = { kind: 'builtin', staticType, runtimeName: elementRuntime ? `Array[${elementRuntime}]` : 'Array' };
                return staticType;
            }
            if (name === 'Dictionary' && ref.args.length === 2) {
                this.resolveTypeRef(ref.args[0]!, cls);
                this.resolveTypeRef(ref.args[1]!, cls);
                ref.resolved = { kind: 'builtin', staticType: 'Dictionary', runtimeName: 'Dictionary' };
                return 'Dictionary';
            }
            if (ref.args.length > 0)
                this.error(ref.span, `O tipo ${name} não aceita parâmetros (${typeRefToString(ref)}).`);
            ref.resolved = { kind: 'builtin', staticType: name, runtimeName: name };
            return name;
        }
        if (ref.args.length > 0)
            this.error(ref.span, `Só Array e Dictionary aceitam parâmetros de tipo (${typeRefToString(ref)}).`);
        const found = this.lookupClass(name, cls);
        if (found) {
            this.useClass(found);
            ref.resolved = { kind: 'class', className: found.typeName, jsName: found.jsName, scriptName: found.isSibling ? found.scriptName : null };
            return found.typeName;
        }
        const enumMember = this.lookupEnum(name, cls);
        if (enumMember) {
            ref.resolved = { kind: 'enum', className: enumMember.owner.typeName, enumName: enumMember.name };
            return 'int';
        }
        if (isGodotClass(name)) {
            ref.resolved = { kind: 'godot', name };
            return name;
        }
        const candidates = [...BUILTIN_TYPE_NAMES, ...this.classesByTypeName.keys(), ...this.siblingsByClassName.keys(), 'Node3D', 'CharacterBody3D', 'RigidBody3D', 'Area3D', 'Timer', 'Tween', 'InputEvent', 'InputEventKey', 'InputEventMouseButton'];
        this.error(ref.span, `Tipo desconhecido: "${name}".${this.suggest(name, candidates)}`);
        ref.resolved = { kind: 'variant' };
        return 'Variant';
    }
    private isObjectType(type: StaticType): boolean {
        return this.classesByTypeName.has(type) || isGodotClass(type) || type === 'Object' || type === 'Node' || type === 'JSON';
    }
    private assignable(from: StaticType, to: StaticType): boolean {
        if (to === 'Variant' || from === 'Variant' || isMeta(from) || isMeta(to) || from === to || to === 'void')
            return true;
        if (from === 'null')
            return !NON_NULLABLE.has(baseTypeName(to));
        if (from === 'void')
            return false;
        if (to === 'float' && from === 'int')
            return true;
        if (STRING_TYPES.has(from) && STRING_TYPES.has(to))
            return true;
        if ((to === 'Vector2' && from === 'Vector2i') || (to === 'Vector3' && from === 'Vector3i'))
            return true;
        if (isArrayType(from) && isArrayType(to)) {
            const fromElement = from.startsWith('Array[') ? arrayElement(from) : null;
            const toElement = to.startsWith('Array[') ? arrayElement(to) : null;
            return !fromElement || !toElement || fromElement === toElement;
        }
        if (baseTypeName(to) === 'Dictionary' && baseTypeName(from) === 'Dictionary')
            return true;
        if (this.isObjectType(to)) {
            if (!this.isObjectType(from))
                return false;
            if (to === 'Object' || from === 'Object')
                return true;
            const fromClass = this.classesByTypeName.get(from);
            const toClass = this.classesByTypeName.get(to);
            if (fromClass && toClass)
                return this.inherits(fromClass, to) || this.inherits(toClass, from);
            if (fromClass)
                return godotIsA(fromClass.godotBase, to) || godotIsA(to, fromClass.godotBase);
            if (toClass)
                return godotIsA(toClass.godotBase, from) || godotIsA(from, toClass.godotBase);
            return godotIsA(from, to) || godotIsA(to, from);
        }
        return false;
    }
    private checkAssignable(from: StaticType, to: StaticType, span: SourceSpan, what: string): void {
        if (!this.assignable(from, to))
            this.error(span, `Não é possível atribuir um valor do tipo ${describeType(from)} a ${what}, do tipo ${describeType(to)}.`);
    }
    private declareMemberTypes(cls: ClassInfo): void {
        for (const member of cls.members.values()) {
            const decl = member.decl;
            if (!decl)
                continue;
            if (decl.kind === 'variable') {
                if (decl.type)
                    member.type = this.resolveTypeRef(decl.type, cls);
                decl.staticType = member.type;
            }
            else if (decl.kind === 'constant' && decl.type) {
                member.type = this.resolveTypeRef(decl.type, cls);
            }
            else if (decl.kind === 'function') {
                member.type = decl.returnType ? this.resolveTypeRef(decl.returnType, cls) : 'Variant';
                for (const param of decl.params) {
                    param.staticType = param.type ? this.resolveTypeRef(param.type, cls) : 'Variant';
                    param.jsName = jsIdentifier(param.name);
                }
            }
            else if (decl.kind === 'signal') {
                for (const param of decl.params) {
                    param.staticType = param.type ? this.resolveTypeRef(param.type, cls) : 'Variant';
                    param.jsName = jsIdentifier(param.name);
                }
            }
        }
    }
}
