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
    private checkMembersAgainstBase(cls: ClassInfo): void {
        for (const member of cls.members.values()) {
            const decl = member.decl;
            if (!decl)
                continue;
            if (member.kind === 'func' && member.func) {
                const virtualArity = GODOT_VIRTUALS[member.name];
                if (virtualArity !== undefined) {
                    if (member.isStatic)
                        this.error(member.span, `"${member.name}" é um callback do nó e não pode ser static.`);
                    if (virtualArity !== null && member.func.params.length !== virtualArity) {
                        this.error(member.span, virtualArity === 0 ? `"${member.name}" não recebe parâmetros.` : `"${member.name}" precisa de exatamente ${virtualArity} parâmetro${virtualArity > 1 ? 's' : ''} (${member.name === '_process' || member.name === '_physics_process' ? 'delta' : member.name === '_notification' ? 'what' : 'event'}).`);
                    }
                    continue;
                }
            }
            const base = this.baseMember(member.name, cls.godotBase);
            if (base) {
                this.error(member.span, `"${member.name}" já existe na classe base ${cls.godotBase} (${base.what}); escolha outro nome.`);
                continue;
            }
            for (const p of ancestorsOf(cls)) {
                const inherited = p.members.get(member.name);
                if (!inherited)
                    continue;
                if (member.kind === 'func' && inherited.kind === 'func') {
                    const own = member.func!;
                    const theirs = inherited.func!;
                    if (own.params.length < theirs.params.filter((param) => !param.defaultValue).length || own.params.length > theirs.params.length) {
                        this.error(member.span, `"${member.name}" sobrescreve o método de ${p.name} com uma assinatura diferente (${theirs.params.length} parâmetro${theirs.params.length === 1 ? '' : 's'} lá, ${own.params.length} aqui).`);
                    }
                    if (own.isStatic !== theirs.isStatic)
                        this.error(member.span, `"${member.name}" é ${theirs.isStatic ? 'static' : 'de instância'} em ${p.name} e precisa continuar assim aqui.`);
                }
                else {
                    this.error(member.span, `"${member.name}" já existe na classe pai ${p.name} como ${this.describeMemberKind(inherited.kind)}.`);
                }
                break;
            }
        }
    }
    private describeMemberKind(kind: MemberKind): string {
        switch (kind) {
            case 'var':
                return 'variável';
            case 'const':
                return 'constante';
            case 'enum':
                return 'enum';
            case 'enum_value':
                return 'valor de enum';
            case 'signal':
                return 'sinal';
            case 'func':
                return 'função';
            case 'class':
                return 'classe interna';
        }
    }
    private baseMember(name: string, godotBase: string): {
        readonly kind: 'property' | 'method' | 'signal';
        readonly type: StaticType;
        readonly readonly: boolean;
        readonly min: number;
        readonly max: number;
        readonly what: string;
    } | null {
        if (!baseMemberVisible(name, godotBase))
            return null;
        const property = NODE_PROPERTIES[name];
        if (property)
            return { kind: 'property', type: property.type, readonly: property.readonly ?? false, min: 0, max: 0, what: 'propriedade do nó' };
        const method = NODE_METHODS[name];
        if (method)
            return { kind: 'method', type: method.returns, readonly: true, min: method.min, max: method.max, what: 'método do nó' };
        if (NODE_SIGNALS.includes(name))
            return { kind: 'signal', type: 'Signal', readonly: true, min: 0, max: 0, what: 'sinal do nó' };
        return null;
    }
    private withFunction<T>(fn: FunctionContext, body: () => T): T {
        const previousFn = this.fn;
        const previousScope = this.scope;
        this.fn = fn;
        this.scope = { locals: new Map(), parent: fn.isLambda ? previousScope : null, fn };
        try {
            return body();
        }
        finally {
            this.fn = previousFn;
            this.scope = previousScope;
        }
    }
    private pushScope(): void {
        this.scope = { locals: new Map(), parent: this.scope, fn: this.fn! };
    }
    private popScope(): void {
        const scope = this.scope!;
        for (const local of scope.locals.values()) {
            if (!local.used && !local.name.startsWith('_')) {
                this.warn(local.span, local.isParam ? `O parâmetro "${local.name}" nunca é usado (prefixe com _ para silenciar).` : `A variável local "${local.name}" nunca é usada.`);
            }
        }
        this.scope = scope.parent;
    }
    private initializerContext(cls: ClassInfo, isStatic: boolean): FunctionContext {
        return { cls, isStatic, name: null, returnType: null, isLambda: false, parent: null, captures: new Set(), assigned: new Set(), accessorOf: null, isInitializer: true, loopDepth: 0, hasAwait: false };
    }
    private declareLocal(name: string, span: SourceSpan, type: StaticType, isConst: boolean, isParam: boolean): LocalInfo {
        const fn = this.fn!;
        const existing = this.lookupLocalInFunction(name);
        if (existing)
            this.error(span, `Já existe uma variável chamada "${name}" nesta função (declarada na linha ${existing.span.line}).`);
        else if (this.findMember(fn.cls, name))
            this.warn(span, `"${name}" esconde o membro de mesmo nome da classe.`);
        const local: LocalInfo = { name, jsName: jsIdentifier(name), type, isConst, isParam, span, used: false };
        this.scope!.locals.set(name, local);
        return local;
    }
    private lookupLocalInFunction(name: string): LocalInfo | null {
        for (let scope = this.scope; scope && scope.fn === this.fn; scope = scope.parent) {
            const local = scope.locals.get(name);
            if (local)
                return local;
        }
        return null;
    }
    private lookupLocal(name: string): LocalInfo | null {
        let scope: Scope | null = this.scope;
        while (scope) {
            const local = scope.locals.get(name);
            if (local) {
                if (scope.fn !== this.fn) {
                    let fn: FunctionContext | null = this.fn;
                    while (fn && fn !== scope.fn) {
                        fn.captures.add(local.jsName);
                        fn = fn.parent;
                    }
                }
                return local;
            }
            scope = scope.parent;
        }
        return null;
    }
    private ensureStaticInit(member: MemberInfo): void {
        const state = this.staticState.get(member);
        if (state === 'done')
            return;
        if (state === 'doing') {
            this.error(member.span, `A constante "${member.name}" depende dela mesma (ciclo entre constantes).`);
            return;
        }
        this.staticState.set(member, 'doing');
        const cls = member.owner;
        const decl = member.decl;
        if (cls.isSibling)
            this.silent++;
        try {
            this.withFunction(this.initializerContext(cls, true), () => {
                if (!decl)
                    return;
                if (decl.kind === 'constant') {
                    const valueType = this.expression(decl.value);
                    if (decl.type)
                        this.checkAssignable(valueType, member.type, decl.value.span, `a constante "${member.name}"`);
                    else
                        member.type = valueType === 'null' ? 'Variant' : valueType;
                    decl.staticType = member.type;
                    if (!this.isConstantExpression(decl.value))
                        this.error(decl.value.span, `O valor de const ${member.name} precisa ser uma expressão constante (literais, outras constantes, Vector3(…), preload…).`);
                    member.constValue = this.evaluateConstant(decl.value);
                }
                else if (decl.kind === 'enum') {
                    this.evaluateEnum(decl, member, cls);
                }
                else if (decl.kind === 'variable') {
                    this.analyzeVariableInitializer(decl, member, cls);
                }
            });
        }
        finally {
            if (cls.isSibling)
                this.silent--;
        }
        this.staticState.set(member, 'done');
        if (!cls.isSibling)
            this.staticInits.push({ owner: cls, member });
    }
    private evaluateEnum(decl: EnumMember, member: MemberInfo, cls: ClassInfo): void {
        let next = 0;
        const seen = new Map<string, number>();
        for (const value of decl.values) {
            if (seen.has(value.name))
                this.error(value.span, `O valor "${value.name}" aparece duas vezes no enum.`);
            let number = next;
            if (value.value) {
                this.expression(value.value);
                const evaluated = this.evaluateConstant(value.value);
                if (typeof evaluated === 'number' && Number.isInteger(evaluated))
                    number = evaluated;
                else
                    this.error(value.value.span, `O valor de ${value.name} precisa ser um inteiro constante.`);
            }
            seen.set(value.name, number);
            next = number + 1;
            if (!decl.name) {
                const valueMember = cls.members.get(value.name);
                if (valueMember && valueMember.decl === decl) {
                    valueMember.constValue = number;
                    this.staticState.set(valueMember, 'done');
                }
            }
        }
        if (member.enumValues)
            for (const [name, number] of seen)
                member.enumValues.set(name, number);
    }
    private analyzeVariableInitializer(decl: VariableMember, member: MemberInfo, cls: ClassInfo): void {
        if (decl.onReady && decl.isStatic)
            this.error(decl.nameSpan, '@onready não se aplica a variáveis static.');
        if (decl.onReady && 'kind' in cls.decl)
            this.error(decl.nameSpan, '@onready só funciona na classe principal do script (a que fica no ator).');
        if (decl.value) {
            if (decl.onReady)
                this.onReadyDepth++;
            const valueType = this.expression(decl.value);
            if (decl.onReady)
                this.onReadyDepth--;
            if (decl.type)
                this.checkAssignable(valueType, member.type, decl.value.span, `a variável "${member.name}"`);
            else if (decl.inferred) {
                if (valueType === 'null' || valueType === 'void')
                    this.error(decl.value.span, `Não dá para inferir o tipo de "${member.name}" a partir de ${valueType === 'null' ? 'null' : 'uma chamada sem retorno'}; declare o tipo.`);
                else
                    member.type = valueType;
            }
        }
        else if (decl.inferred) {
            this.error(decl.nameSpan, `"${member.name}" usa := mas não tem valor para inferir o tipo.`);
        }
        if (decl.exported && member.type === 'Variant')
            this.error(decl.nameSpan, `Não dá para exportar "${member.name}" sem tipo: declare-o (var ${member.name}: int = …) ou use :=.`);
        decl.staticType = member.type;
    }
    private analyzeInstanceInitializers(cls: ClassInfo): void {
        for (const member of cls.members.values()) {
            const decl = member.decl;
            if (!decl || decl.kind !== 'variable' || decl.isStatic)
                continue;
            this.withFunction(this.initializerContext(cls, false), () => this.analyzeVariableInitializer(decl, member, cls));
            if (decl.accessors)
                this.analyzeAccessors(decl, member, cls);
        }
    }
    private analyzeAccessors(decl: VariableMember, member: MemberInfo, cls: ClassInfo): void {
        const accessors = decl.accessors!;
        const setter = accessors.setter;
        if (setter) {
            if (setter.kind === 'named') {
                const target = cls.members.get(setter.name);
                if (!target || target.kind !== 'func' || !target.func)
                    this.error(setter.span, `O setter "${setter.name}" de ${member.name} precisa ser uma função desta classe.`);
                else if (target.func.params.length !== 1)
                    this.error(setter.span, `O setter "${setter.name}" precisa receber exatamente 1 parâmetro (o novo valor).`);
                else if (target.isStatic)
                    this.error(setter.span, `O setter "${setter.name}" não pode ser static.`);
                else
                    target.func.accessorOf = member.name;
            }
            else {
                const fn: FunctionContext = { cls, isStatic: false, name: null, returnType: 'void', isLambda: false, parent: null, captures: new Set(), assigned: new Set(), accessorOf: member.name, isInitializer: false, loopDepth: 0, hasAwait: false };
                collectAssigned(setter.body, fn.assigned);
                this.withFunction(fn, () => {
                    const local = this.declareLocal(setter.param, setter.span, member.type, false, true);
                    local.used = true;
                    this.block(setter.body, false);
                    if (fn.hasAwait)
                        this.error(setter.span, 'await não é permitido dentro de set().');
                });
            }
        }
        const getter = accessors.getter;
        if (getter) {
            if (getter.kind === 'named') {
                const target = cls.members.get(getter.name);
                if (!target || target.kind !== 'func' || !target.func)
                    this.error(getter.span, `O getter "${getter.name}" de ${member.name} precisa ser uma função desta classe.`);
                else if (target.func.params.length !== 0)
                    this.error(getter.span, `O getter "${getter.name}" não recebe parâmetros.`);
                else if (target.isStatic)
                    this.error(getter.span, `O getter "${getter.name}" não pode ser static.`);
                else
                    target.func.accessorOf = member.name;
            }
            else {
                const fn: FunctionContext = { cls, isStatic: false, name: null, returnType: member.type === 'Variant' ? null : member.type, isLambda: false, parent: null, captures: new Set(), assigned: new Set(), accessorOf: member.name, isInitializer: false, loopDepth: 0, hasAwait: false };
                collectAssigned(getter.body, fn.assigned);
                this.withFunction(fn, () => {
                    this.block(getter.body, false);
                    if (fn.hasAwait)
                        this.error(getter.span, 'await não é permitido dentro de get().');
                });
            }
        }
    }
    private analyzeFunctions(cls: ClassInfo): void {
        for (const member of cls.members.values()) {
            const decl = member.func;
            if (!decl)
                continue;
            decl.isAsync = containsAwait(decl.body);
            const fn: FunctionContext = {
                cls,
                isStatic: decl.isStatic,
                name: decl.name,
                returnType: decl.returnType ? member.type : decl.name === '_init' ? 'void' : null,
                isLambda: false,
                parent: null,
                captures: new Set(),
                assigned: new Set(),
                accessorOf: decl.accessorOf ?? null,
                isInitializer: false,
                loopDepth: 0,
                hasAwait: false,
            };
            collectAssigned(decl.body, fn.assigned);
            this.withFunction(fn, () => {
                this.declareParams(decl.params);
                this.block(decl.body, false);
                this.popScopeWarnings();
            });
        }
    }
    private popScopeWarnings(): void {
        const scope = this.scope!;
        for (const local of scope.locals.values()) {
            if (!local.used && !local.name.startsWith('_')) {
                this.warn(local.span, local.isParam ? `O parâmetro "${local.name}" nunca é usado (prefixe com _ para silenciar).` : `A variável local "${local.name}" nunca é usada.`);
            }
        }
    }
    private declareParams(params: readonly Parameter[]): void {
        const seen = new Set<string>();
        for (const param of params) {
            if (seen.has(param.name))
                this.error(param.span, `O parâmetro "${param.name}" está repetido.`);
            seen.add(param.name);
            const type = param.staticType ?? (param.type ? this.resolveTypeRef(param.type, this.fn!.cls) : 'Variant');
            param.staticType = type;
            if (param.defaultValue) {
                const valueType = this.expression(param.defaultValue);
                if (param.type)
                    this.checkAssignable(valueType, type, param.defaultValue.span, `o parâmetro "${param.name}"`);
                else if (valueType !== 'null' && valueType !== 'Variant' && !isMeta(valueType))
                    param.staticType = this.fn!.assigned.has(param.name) ? 'Variant' : valueType;
            }
            const local = this.declareLocal(param.name, param.span, param.staticType, false, true);
            param.jsName = local.jsName;
        }
    }
    private block(block: Block, newScope = true): void {
        if (newScope)
            this.pushScope();
        let terminated: Statement | null = null;
        for (const statement of block.statements) {
            if (terminated) {
                this.warn(statement.span, `Código inacessível: a linha ${terminated.span.line} sempre ${terminated.kind === 'return' ? 'sai da função' : 'interrompe o laço'} antes daqui.`);
                terminated = null;
            }
            this.statement(statement);
            if (statement.kind === 'return' || statement.kind === 'break' || statement.kind === 'continue')
                terminated = statement;
        }
        if (newScope)
            this.popScope();
    }
    private statement(statement: Statement): void {
        const fn = this.fn!;
        switch (statement.kind) {
            case 'expression': {
                const e = statement.expression;
                this.expression(e);
                if (e.kind !== 'call' && e.kind !== 'await' && !(e.kind === 'lambda'))
                    this.warn(statement.span, 'Esta expressão não tem efeito (o valor é descartado).');
                if (e.kind === 'await' && e.value.kind !== 'call' && e.value.type !== 'Signal' && e.value.type !== 'Variant' && !isMeta(e.value.type ?? 'Variant'))
                    this.warn(statement.span, 'await de um valor que não é sinal nem corrotina não espera nada.');
                return;
            }
            case 'assignment':
                this.assignment(statement);
                return;
            case 'variable': {
                let valueType: StaticType = 'null';
                if (statement.value)
                    valueType = this.expression(statement.value);
                let type: StaticType = 'Variant';
                if (statement.type) {
                    type = this.resolveTypeRef(statement.type, fn.cls);
                    if (statement.value)
                        this.checkAssignable(valueType, type, statement.value.span, `a variável "${statement.name}"`);
                    else if (NON_NULLABLE.has(baseTypeName(type)) && !isNumeric(type) && type !== 'bool' && !STRING_TYPES.has(type)) {
                    }
                }
                else if (statement.inferred) {
                    if (!statement.value)
                        this.error(statement.nameSpan, `"${statement.name}" usa := mas não tem valor para inferir o tipo.`);
                    else if (valueType === 'null' || valueType === 'void')
                        this.error(statement.value.span, `Não dá para inferir o tipo de "${statement.name}" a partir de ${valueType === 'null' ? 'null' : 'uma chamada sem retorno'}.`);
                    else
                        type = valueType;
                }
                else if (statement.value && valueType !== 'null' && valueType !== 'void' && valueType !== 'Variant' && !fn.assigned.has(statement.name)) {
                    type = valueType;
                }
                if (valueType === 'void' && statement.value)
                    this.error(statement.value.span, 'Esta chamada não devolve valor (void) e não pode inicializar uma variável.');
                const local = this.declareLocal(statement.name, statement.nameSpan, type, false, false);
                statement.jsName = local.jsName;
                statement.staticType = type;
                return;
            }
            case 'constant': {
                const valueType = this.expression(statement.value);
                let type = valueType === 'null' ? 'Variant' : valueType;
                if (statement.type) {
                    type = this.resolveTypeRef(statement.type, fn.cls);
                    this.checkAssignable(valueType, type, statement.value.span, `a constante "${statement.name}"`);
                }
                if (!this.isConstantExpression(statement.value))
                    this.error(statement.value.span, `O valor de const ${statement.name} precisa ser uma expressão constante.`);
                const local = this.declareLocal(statement.name, statement.nameSpan, type, true, false);
                statement.jsName = local.jsName;
                statement.staticType = type;
                return;
            }
            case 'if':
                this.condition(statement.condition);
                this.block(statement.then);
                if (statement.otherwise)
                    this.block(statement.otherwise);
                return;
            case 'while':
                this.condition(statement.condition);
                fn.loopDepth++;
                this.block(statement.body);
                fn.loopDepth--;
                return;
            case 'for': {
                const iterableType = this.expression(statement.iterable);
                let variableType: StaticType = 'Variant';
                if (isArrayType(iterableType))
                    variableType = arrayElement(iterableType);
                else if (iterableType === 'int' || iterableType === 'float')
                    variableType = iterableType;
                else if (STRING_TYPES.has(iterableType))
                    variableType = 'String';
                else if (iterableType === 'Dictionary')
                    variableType = 'Variant';
                else if (iterableType === 'bool' || iterableType === 'null' || VALUE_TYPES.has(iterableType) || iterableType === 'Callable' || iterableType === 'Signal')
                    this.error(statement.iterable.span, `Não é possível percorrer um valor do tipo ${iterableType} com for.`);
                if (statement.variableType) {
                    const declared = this.resolveTypeRef(statement.variableType, fn.cls);
                    if (variableType !== 'Variant')
                        this.checkAssignable(variableType, declared, statement.variableSpan, `a variável do laço "${statement.variable}"`);
                    variableType = declared;
                }
                this.pushScope();
                const local = this.declareLocal(statement.variable, statement.variableSpan, variableType, false, false);
                statement.jsName = local.jsName;
                fn.loopDepth++;
                this.block(statement.body, false);
                fn.loopDepth--;
                this.popScope();
                return;
            }
            case 'match': {
                const valueType = this.expression(statement.value);
                for (const branch of statement.branches) {
                    this.pushScope();
                    for (const pattern of branch.patterns)
                        this.pattern(pattern, valueType);
                    if (branch.guard)
                        this.condition(branch.guard);
                    this.block(branch.body, false);
                    this.popScope();
                }
                return;
            }
            case 'return': {
                if (fn.isInitializer) {
                    this.error(statement.span, 'return não pode aparecer fora de uma função.');
                    return;
                }
                const valueType = statement.value ? this.expression(statement.value) : 'void';
                if (fn.returnType === 'void') {
                    if (statement.value)
                        this.error(statement.span, fn.name === '_init' ? '_init não devolve valor.' : fn.accessorOf && !statement.value ? '' : 'Esta função é void e não pode devolver um valor.');
                }
                else if (fn.returnType) {
                    if (!statement.value)
                        this.error(statement.span, `Esta função devolve ${fn.returnType}: o return precisa de um valor.`);
                    else
                        this.checkAssignable(valueType, fn.returnType, statement.value.span, 'o valor devolvido');
                }
                return;
            }
            case 'break':
                if (fn.loopDepth === 0)
                    this.error(statement.span, 'break só pode aparecer dentro de um laço (for/while).');
                return;
            case 'continue':
                if (fn.loopDepth === 0)
                    this.error(statement.span, 'continue só pode aparecer dentro de um laço (for/while).');
                return;
            case 'assert':
                this.condition(statement.condition);
                if (statement.message)
                    this.expression(statement.message);
                return;
            case 'pass':
            case 'breakpoint':
                return;
        }
    }
    private condition(e: Expression): void {
        const type = this.expression(e);
        if (type === 'void')
            this.error(e.span, 'A condição é uma chamada sem retorno (void).');
        if (e.kind === 'assignment' as never)
            this.error(e.span, 'Use == para comparar; = é atribuição.');
    }
    private pattern(pattern: Pattern, valueType: StaticType): void {
        switch (pattern.kind) {
            case 'wildcard':
                return;
            case 'binding': {
                const local = this.declareLocal(pattern.name, pattern.span, valueType === 'Variant' ? 'Variant' : valueType, false, false);
                local.used = true;
                pattern.jsName = local.jsName;
                return;
            }
            case 'value': {
                const type = this.expression(pattern.value);
                if (!this.isConstantExpression(pattern.value))
                    this.error(pattern.span, 'Um padrão de match precisa ser constante (literal, const, enum…); para capturar o valor use "var nome".');
                if (type !== 'Variant' && valueType !== 'Variant' && !isMeta(type) && !isMeta(valueType) && type !== 'null' && !this.assignable(type, valueType) && !this.assignable(valueType, type))
                    this.warn(pattern.span, `Este padrão (${type}) nunca casa com um valor do tipo ${valueType}.`);
                return;
            }
            case 'array':
                for (const element of pattern.elements)
                    this.pattern(element, isArrayType(valueType) ? arrayElement(valueType) : 'Variant');
                return;
            case 'dictionary':
                for (const entry of pattern.entries) {
                    this.expression(entry.key);
                    if (!this.isConstantExpression(entry.key))
                        this.error(entry.key.span, 'A chave de um padrão de dicionário precisa ser constante.');
                    if (entry.value)
                        this.pattern(entry.value, 'Variant');
                }
                return;
        }
    }
    private assignment(statement: AssignmentStatement): void {
        const valueType = this.expression(statement.value);
        const target = statement.target;
        let targetType: StaticType = 'Variant';
        let what = 'o destino';
        if (target.kind === 'identifier') {
            targetType = this.resolveIdentifier(target, statement.operator === '=' ? 'assign' : 'read');
            what = `"${target.name}"`;
            const resolution = target.resolved;
            if (resolution)
                this.checkAssignTarget(resolution, target.name, target.span, targetType);
        }
        else if (target.kind === 'member') {
            const lookup = this.member(target, 'assign');
            targetType = lookup?.type ?? 'Variant';
            what = `"${target.name}"`;
            if (lookup?.readonly)
                this.error(target.nameSpan, `"${target.name}" não aceita atribuição (${lookup.what}).`);
        }
        else if (target.kind === 'index') {
            const container = this.expression(target.object);
            this.expression(target.index);
            if (STRING_TYPES.has(container))
                this.error(target.span, 'Strings são imutáveis: não dá para atribuir a um caractere.');
            targetType = isArrayType(container) ? arrayElement(container) : 'Variant';
            target.type = targetType;
            what = 'o elemento';
        }
        else {
            this.error(target.span, 'O lado esquerdo de uma atribuição precisa ser uma variável, um membro ou um índice.');
            return;
        }
        if (statement.operator === '=') {
            if (valueType === 'void')
                this.error(statement.value.span, 'Esta chamada não devolve valor (void).');
            else
                this.checkAssignable(valueType, targetType, statement.value.span, what);
            return;
        }
        const operator = statement.operator.slice(0, -1) as BinaryOperator;
        const result = this.binaryResult(operator, targetType, valueType, statement.span);
        if (result)
            this.checkAssignable(result, targetType, statement.span, what);
    }
    private checkAssignTarget(resolution: Resolution, name: string, span: SourceSpan, _type: StaticType): void {
        switch (resolution.kind) {
            case 'local': {
                const local = this.lookupLocal(name);
                if (local?.isConst)
                    this.error(span, `"${name}" é uma constante e não pode receber valor.`);
                return;
            }
            case 'member':
                if (resolution.memberKind !== 'var')
                    this.error(span, `"${name}" é ${this.describeMemberKind(resolution.memberKind)} e não pode receber valor.`);
                return;
            case 'base': {
                const base = this.baseMember(name, this.fn!.cls.godotBase);
                if (base && base.kind !== 'property')
                    this.error(span, `"${name}" é um ${base.what} e não pode receber valor.`);
                else if (base?.readonly)
                    this.error(span, `"${name}" é só de leitura.`);
                return;
            }
            case 'helix':
                return;
            default:
                this.error(span, `"${name}" não pode receber valor.`);
        }
    }
    private expression(e: Expression): StaticType {
        const type = this.expressionType(e);
        e.type = type;
        return type;
    }
    private expressionType(e: Expression): StaticType {
        const fn = this.fn!;
        switch (e.kind) {
            case 'literal':
                return e.literalType;
            case 'string':
                return e.flavor === 'string' ? 'String' : e.flavor === 'string_name' ? 'StringName' : 'NodePath';
            case 'identifier':
                return this.resolveIdentifier(e, 'read');
            case 'self':
                if (fn.isStatic)
                    this.error(e.span, 'self não existe em contexto static.');
                return fn.cls.typeName;
            case 'super':
                this.error(e.span, 'super só pode ser usado como super() ou super.metodo().');
                return 'Variant';
            case 'array': {
                for (const element of e.elements)
                    this.expression(element);
                return 'Array';
            }
            case 'dictionary': {
                for (const entry of e.entries) {
                    this.expression(entry.key);
                    this.expression(entry.value);
                }
                return 'Dictionary';
            }
            case 'member':
                return this.member(e, 'read')?.type ?? 'Variant';
            case 'index': {
                const container = this.expression(e.object);
                const index = this.expression(e.index);
                if (isArrayType(container) || STRING_TYPES.has(container) || VECTOR_TYPES.has(container)) {
                    if (index !== 'Variant' && index !== 'int' && !isMeta(index))
                        this.error(e.index.span, `O índice de ${container} precisa ser int, não ${index}.`);
                    if (isArrayType(container))
                        return arrayElement(container);
                    if (STRING_TYPES.has(container))
                        return 'String';
                    return container.endsWith('i') ? 'int' : 'float';
                }
                if (container === 'Color')
                    return 'float';
                if (isNumeric(container) || container === 'bool' || container === 'null')
                    this.error(e.span, `Um valor do tipo ${container} não pode ser indexado.`);
                return 'Variant';
            }
            case 'call':
                return this.call(e);
            case 'unary': {
                const operand = this.expression(e.operand);
                if (e.operator === 'not')
                    return 'bool';
                if (operand === 'Variant' || isMeta(operand))
                    return e.operator === '~' ? 'int' : 'Variant';
                if (e.operator === '~') {
                    if (operand !== 'int')
                        this.error(e.span, `O operador ~ só se aplica a int, não a ${operand}.`);
                    return 'int';
                }
                if (isNumeric(operand) || VALUE_TYPES.has(operand))
                    return operand;
                this.error(e.span, `O operador ${e.operator} não se aplica a ${describeType(operand)}.`);
                return 'Variant';
            }
            case 'binary': {
                const left = this.expression(e.left);
                const right = this.expression(e.right);
                return this.binaryResult(e.operator, left, right, e.span) ?? 'Variant';
            }
            case 'ternary': {
                this.condition(e.condition);
                const whenTrue = this.expression(e.whenTrue);
                const whenFalse = this.expression(e.whenFalse);
                if (whenTrue === whenFalse)
                    return whenTrue;
                if (isNumeric(whenTrue) && isNumeric(whenFalse))
                    return 'float';
                if (whenTrue === 'null')
                    return whenFalse;
                if (whenFalse === 'null')
                    return whenTrue;
                return 'Variant';
            }
            case 'is': {
                const value = this.expression(e.value);
                const target = this.resolveTypeRef(e.target, fn.cls);
                if (value !== 'Variant' && !isMeta(value) && target !== 'Variant' && value !== 'null' && !this.assignable(value, target) && !this.assignable(target, value)) {
                    this.warn(e.span, `"is ${typeRefToString(e.target)}" é sempre ${e.negated ? 'verdadeiro' : 'falso'}: o valor é do tipo ${value}.`);
                }
                return 'bool';
            }
            case 'as': {
                this.expression(e.value);
                return this.resolveTypeRef(e.target, fn.cls);
            }
            case 'await': {
                if (fn.isInitializer)
                    this.error(e.span, 'await só pode aparecer dentro de funções.');
                fn.hasAwait = true;
                const value = this.expression(e.value);
                if (value === 'Signal')
                    return 'Variant';
                return value;
            }
            case 'lambda':
                return this.lambda(e);
            case 'get_node':
                if (fn.isStatic)
                    this.error(e.span, '$ (get_node) precisa de um nó: não funciona em contexto static.');
                if (fn.isInitializer && !(this.currentInitializerIsOnReady()))
                    this.warn(e.span, 'Inicializar um membro com $ roda antes de o ator entrar na cena; use @onready var para esperar os filhos existirem.');
                return 'Node';
            case 'preload': {
                if (/\.(tscn|scn|res|tres)$/i.test(e.path)) {
                    this.error(e.span, 'Esta engine não tem cenas .tscn: preload só carrega scripts GDScript do projeto (preload("res://Inimigo.gd")). Para criar atores use helix.scene.');
                    e.scriptName = null;
                    return 'Variant';
                }
                const target = this.siblingByPath(e.path);
                if (!target) {
                    this.error(e.span, `Não encontrei o script "${e.path}" no projeto.${this.suggest(e.path.slice(e.path.lastIndexOf('/') + 1), [...this.siblingsByFile.keys()])}`);
                    e.scriptName = null;
                    return 'Variant';
                }
                this.useClass(target);
                e.scriptName = target.scriptName;
                return `@class:${target.typeName}`;
            }
            case 'type_name':
                return `@type:${e.name}`;
        }
    }
    private currentInitializerIsOnReady(): boolean {
        return this.onReadyDepth > 0;
    }
    private onReadyDepth = 0;
    private memberResolution(member: MemberInfo): Resolution {
        return { kind: 'member', name: member.name, isStatic: member.isStatic, memberKind: member.kind, backingField: member.backingField, owner: member.owner.jsName };
    }
    private memberValueType(member: MemberInfo): StaticType {
        switch (member.kind) {
            case 'func':
                return 'Callable';
            case 'signal':
                return 'Signal';
            case 'enum':
                return `@enum:${member.owner.typeName}.${member.name}`;
            case 'enum_value':
                return 'int';
            case 'class':
                return member.inner ? `@class:${member.inner.typeName}` : 'Variant';
            default:
                return member.type;
        }
    }
    private touchStatic(member: MemberInfo): void {
        if (member.isStatic && (member.kind === 'const' || member.kind === 'enum' || member.kind === 'enum_value' || member.kind === 'var') && this.staticState.get(member) !== 'done')
            this.ensureStaticInit(member);
    }
    private resolveIdentifier(e: IdentifierExpression, mode: 'read' | 'call' | 'assign'): StaticType {
        const fn = this.fn!;
        const name = e.name;
        const local = this.lookupLocal(name);
        if (local) {
            if (mode !== 'assign')
                local.used = true;
            e.resolved = { kind: 'local', jsName: local.jsName };
            return local.type;
        }
        const member = this.findMember(fn.cls, name);
        if (member) {
            if (fn.isStatic && !member.isStatic)
                this.error(e.span, `"${name}" é ${this.describeMemberKind(member.kind)} de instância e não pode ser usado em contexto static (static func, const, static var).`);
            this.touchStatic(member);
            e.resolved = this.memberResolution(member);
            return this.memberValueType(member);
        }
        const outerStatic = this.findStaticInOuters(fn.cls, name);
        if (outerStatic) {
            this.touchStatic(outerStatic);
            e.resolved = this.memberResolution(outerStatic);
            return this.memberValueType(outerStatic);
        }
        const base = this.baseMember(name, fn.cls.godotBase);
        if (base) {
            if (fn.isStatic)
                this.error(e.span, `"${name}" pertence ao nó e não pode ser usado em contexto static.`);
            e.resolved = { kind: 'base', name };
            return base.kind === 'method' ? 'Callable' : base.type;
        }
        const cls = this.lookupClass(name, fn.cls);
        if (cls) {
            this.useClass(cls);
            e.resolved = cls.isSibling && cls.scriptName && !cls.outer ? { kind: 'sibling', scriptName: cls.scriptName, className: cls.typeName } : { kind: 'class', jsName: cls.jsName, className: cls.typeName };
            return `@class:${cls.typeName}`;
        }
        if (BUILTIN_TYPE_NAMES.includes(name) && name !== 'Object' && name !== 'Node' && name !== 'Nil' && name !== 'null') {
            e.resolved = { kind: 'builtin_type', name };
            return `@type:${name}`;
        }
        if (isGodotClass(name) || name === 'Object' || name === 'Node') {
            e.resolved = { kind: 'builtin_type', name };
            return `@type:${name}`;
        }
        if (SINGLETON_NAMES.includes(name)) {
            e.resolved = { kind: 'singleton', name };
            return `@singleton:${name}`;
        }
        if (Object.prototype.hasOwnProperty.call(GLOBAL_FUNCTIONS, name)) {
            e.resolved = { kind: 'global_function', name };
            return 'Callable';
        }
        if (IO_NAMES.includes(name)) {
            e.resolved = { kind: 'io', name };
            return 'Callable';
        }
        if (Object.prototype.hasOwnProperty.call(CONSTANTS, name) || Object.prototype.hasOwnProperty.call(TYPE_CONSTANTS, name) || Object.prototype.hasOwnProperty.call(GODOT_CONSTANTS, name)) {
            e.resolved = { kind: 'constant', name };
            return FLOAT_CONSTANTS.has(name) ? 'float' : 'int';
        }
        if (Object.prototype.hasOwnProperty.call(KEY_CODES, name)) {
            e.resolved = { kind: 'key', name };
            return 'int';
        }
        if (name === 'helix') {
            e.resolved = { kind: 'helix' };
            return 'Variant';
        }
        const candidates = new Set<string>();
        for (let scope = this.scope; scope; scope = scope.parent)
            for (const key of scope.locals.keys())
                candidates.add(key);
        for (let c: ClassInfo | null = fn.cls; c; c = c.parent)
            for (const key of c.members.keys())
                candidates.add(key);
        for (const key of Object.keys(NODE_PROPERTIES))
            if (baseMemberVisible(key, fn.cls.godotBase))
                candidates.add(key);
        for (const key of Object.keys(NODE_METHODS))
            if (baseMemberVisible(key, fn.cls.godotBase))
                candidates.add(key);
        for (const key of Object.keys(GLOBAL_FUNCTIONS))
            candidates.add(key);
        for (const key of IO_NAMES)
            candidates.add(key);
        for (const key of BUILTIN_TYPE_NAMES)
            candidates.add(key);
        for (const key of SINGLETON_NAMES)
            candidates.add(key);
        for (const key of Object.keys(CONSTANTS))
            candidates.add(key);
        for (const key of this.siblingsByClassName.keys())
            candidates.add(key);
        candidates.add('self');
        const hint = this.suggest(name, candidates);
        const extra = name === 'print' ? '' : name === 'Vector3.ZERO' ? '' : name.includes('.') ? '' : '';
        this.error(e.span, `O identificador "${name}" não foi declarado neste escopo.${hint}${extra}`);
        e.resolved = { kind: 'helix' };
        return 'Variant';
    }
    private member(e: MemberExpression, mode: 'read' | 'call' | 'assign'): MemberLookup | null {
        const object = e.object;
        const name = e.name;
        const fn = this.fn!;
        let lookup: MemberLookup | null = null;
        if (object.kind === 'self') {
            if (fn.isStatic)
                this.error(object.span, 'self não existe em contexto static.');
            lookup = this.ownMember(fn.cls, name, e.nameSpan, true);
            object.type = fn.cls.typeName;
        }
        else if (object.kind === 'super') {
            if (mode !== 'call')
                this.error(e.span, 'super só serve para chamar métodos da classe pai: super.metodo().');
            lookup = this.superMember(name, e.nameSpan);
        }
        else {
            const objectType = this.expression(object);
            lookup = this.memberOf(objectType, object, name, e.nameSpan, mode);
        }
        if (lookup?.resolution)
            e.memberResolution = lookup.resolution;
        e.type = lookup ? lookup.type : 'Variant';
        return lookup;
    }
    private ownMember(cls: ClassInfo, name: string, span: SourceSpan, viaSelf: boolean): MemberLookup | null {
        const member = this.findMember(cls, name);
        if (member) {
            this.touchStatic(member);
            return this.lookupFromMember(member);
        }
        const base = this.baseMember(name, cls.godotBase);
        if (base)
            return { type: base.type, callable: base.kind === 'method', min: base.min, max: base.max, resolution: { kind: 'base', name }, readonly: base.readonly, what: base.what };
        const candidates = new Set<string>();
        for (let c: ClassInfo | null = cls; c; c = c.parent)
            for (const key of c.members.keys())
                candidates.add(key);
        for (const key of Object.keys(NODE_PROPERTIES))
            if (baseMemberVisible(key, cls.godotBase))
                candidates.add(key);
        for (const key of Object.keys(NODE_METHODS))
            if (baseMemberVisible(key, cls.godotBase))
                candidates.add(key);
        this.error(span, `"${name}" não existe em ${viaSelf ? 'self' : cls.typeName} (classe ${cls.typeName}, base ${cls.godotBase}).${this.suggest(name, candidates)}`);
        return null;
    }
    private lookupFromMember(member: MemberInfo): MemberLookup {
        const resolution = this.memberResolution(member);
        if (member.kind === 'func' && member.func) {
            const params = member.func.params;
            return { type: member.type, callable: true, min: params.filter((p) => !p.defaultValue).length, max: params.length, resolution, readonly: true, func: member.func, what: 'método' };
        }
        return { type: this.memberValueType(member), callable: member.kind === 'var' || member.kind === 'const' ? member.type === 'Callable' || member.type === 'Variant' : false, resolution, readonly: member.kind !== 'var', what: this.describeMemberKind(member.kind) };
    }
    private superMember(name: string, span: SourceSpan): MemberLookup | null {
        const fn = this.fn!;
        if (fn.isStatic) {
            this.error(span, 'super não existe em contexto static.');
            return null;
        }
        const parent = fn.cls.parent;
        if (parent) {
            const member = this.findMember(parent, name);
            if (member) {
                if (member.kind !== 'func') {
                    this.error(span, `"${name}" em ${parent.name} é ${this.describeMemberKind(member.kind)}, não um método.`);
                    return null;
                }
                return this.lookupFromMember(member);
            }
        }
        const base = this.baseMember(name, fn.cls.godotBase);
        if (base && base.kind === 'method')
            return { type: base.type, callable: true, min: base.min, max: base.max, resolution: { kind: 'base', name }, readonly: true, what: base.what };
        if (GODOT_VIRTUALS[name] !== undefined || name === '_init')
            return { type: 'void', callable: true, min: 0, max: Infinity, resolution: { kind: 'base', name }, readonly: true, what: 'callback do nó' };
        this.error(span, `A classe pai não tem o método "${name}".`);
        return null;
    }
    private memberOf(objectType: StaticType, object: Expression, name: string, span: SourceSpan, mode: 'read' | 'call' | 'assign'): MemberLookup | null {
        const resolution = object.kind === 'identifier' ? object.resolved : undefined;
        if (objectType.startsWith('@class:')) {
            const cls = this.classesByTypeName.get(objectType.slice(7));
            if (!cls)
                return { type: 'Variant', callable: true, readonly: false, what: 'membro' };
            if (name === 'new') {
                const init = this.findMember(cls, '_init');
                const params = init?.func?.params ?? [];
                return { type: cls.typeName, callable: true, min: init ? params.filter((p) => !p.defaultValue).length : 0, max: init ? params.length : 0, readonly: true, what: 'construtor' };
            }
            const member = this.findMember(cls, name);
            if (!member) {
                if (name === 'get_script' || name === 'get_class' || name === 'instantiate' || name === 'can_instantiate' || name === 'get_base_script' || name === 'get_instance_base_type' || name === 'resource_path' || name === 'get_global_name')
                    return { type: name === 'can_instantiate' ? 'bool' : 'Variant', callable: name !== 'resource_path', min: 0, max: 0, readonly: true, what: 'membro do script' };
                const candidates = new Set<string>(['new']);
                for (let c: ClassInfo | null = cls; c; c = c.parent)
                    for (const key of c.members.keys())
                        if (c.members.get(key)!.isStatic)
                            candidates.add(key);
                this.error(span, `A classe ${cls.typeName} não tem o membro estático "${name}".${this.suggest(name, candidates)}`);
                return null;
            }
            if (!member.isStatic) {
                this.error(span, `"${name}" é ${this.describeMemberKind(member.kind)} de instância: acesse por um objeto (${cls.name}.new().${name}), não pela classe.`);
                return null;
            }
            this.touchStatic(member);
            return this.lookupFromMember(member);
        }
        if (objectType.startsWith('@enum:')) {
            const dot = objectType.lastIndexOf('.');
            const owner = this.classesByTypeName.get(objectType.slice(6, dot));
            const enumMember = owner ? this.findMember(owner, objectType.slice(dot + 1)) : null;
            if (enumMember?.enumValues) {
                if (enumMember.enumValues.has(name))
                    return { type: 'int', callable: false, readonly: true, what: 'valor de enum' };
                const dictReturn = DICT_RETURNS[name];
                if (dictReturn && Object.prototype.hasOwnProperty.call(DICT_METHODS, name))
                    return { type: dictReturn, callable: true, readonly: true, what: 'método de enum' };
                this.error(span, `O enum ${enumMember.name} não tem o valor "${name}".${this.suggest(name, [...enumMember.enumValues.keys(), 'keys', 'values', 'size', 'has'])}`);
                return null;
            }
            return { type: 'Variant', callable: true, readonly: false, what: 'membro' };
        }
        if (objectType.startsWith('@type:'))
            return this.staticOfType(objectType.slice(6), name, span, mode);
        if (objectType.startsWith('@singleton:'))
            return this.singletonMember(objectType.slice(11), name, span);
        if (resolution?.kind === 'helix')
            return { type: 'Variant', callable: true, readonly: false, what: 'membro de helix' };
        if (objectType === 'Variant' || objectType === 'Object' || objectType === 'Resource' || objectType === 'RefCounted')
            return { type: 'Variant', callable: true, readonly: false, what: 'membro' };
        if (objectType === 'JSON') {
            const entry = JSON_INSTANCE_MEMBERS[name];
            if (!entry) {
                this.error(span, `JSON não tem o membro "${name}".${this.suggest(name, Object.keys(JSON_INSTANCE_MEMBERS))}`);
                return null;
            }
            return this.lookupFromSingletonEntry(entry, name);
        }
        if (VALUE_TYPES.has(objectType))
            return this.valueMember(objectType, name, span);
        if (STRING_TYPES.has(objectType)) {
            if (objectType === 'NodePath' && !Object.prototype.hasOwnProperty.call(STRING_METHODS, name))
                return { type: 'Variant', callable: true, readonly: true, what: 'método de NodePath' };
            if (!Object.prototype.hasOwnProperty.call(STRING_METHODS, name)) {
                this.error(span, `String não tem o método "${name}".${this.suggest(name, Object.keys(STRING_METHODS))}`);
                return null;
            }
            const type = STRING_INT_METHODS.has(name) ? 'int' : STRING_FLOAT_METHODS.has(name) ? 'float' : STRING_ARRAY_METHODS.has(name) ? 'Array' : STRING_BOOL_METHODS.has(name) || name.startsWith('is_') ? 'bool' : 'String';
            return { type, callable: true, readonly: true, what: 'método de String' };
        }
        if (isArrayType(objectType)) {
            if (!Object.prototype.hasOwnProperty.call(ARRAY_METHODS, name)) {
                this.error(span, `Array não tem o método "${name}".${this.suggest(name, Object.keys(ARRAY_METHODS))}`);
                return null;
            }
            const element = arrayElement(objectType);
            const type = ARRAY_INT_METHODS.has(name) ? 'int' : ARRAY_BOOL_METHODS.has(name) ? 'bool' : ARRAY_ELEMENT_METHODS.has(name) ? element : ARRAY_ARRAY_METHODS.has(name) ? (name === 'map' ? 'Array' : objectType.startsWith('Array') ? objectType : 'Array') : ARRAY_VOID_METHODS.has(name) ? 'void' : 'Variant';
            return { type, callable: true, readonly: true, what: 'método de Array' };
        }
        if (objectType === 'Dictionary') {
            if (!Object.prototype.hasOwnProperty.call(DICT_METHODS, name)) {
                this.error(span, `Dictionary não tem o método "${name}".${this.suggest(name, Object.keys(DICT_METHODS))}`);
                return null;
            }
            return { type: DICT_RETURNS[name] ?? 'Variant', callable: true, readonly: true, what: 'método de Dictionary' };
        }
        if (objectType === 'Callable') {
            if (!Object.prototype.hasOwnProperty.call(CALLABLE_METHODS, name)) {
                this.error(span, `Callable não tem o método "${name}".${this.suggest(name, Object.keys(CALLABLE_METHODS))}`);
                return null;
            }
            return { type: CALLABLE_RETURNS[name] ?? 'Variant', callable: true, readonly: true, what: 'método de Callable' };
        }
        if (objectType === 'Signal') {
            if (!SIGNAL_METHOD_NAMES.includes(name)) {
                this.error(span, `Signal não tem o método "${name}".${this.suggest(name, SIGNAL_METHOD_NAMES)}`);
                return null;
            }
            return { type: SIGNAL_RETURNS[name] ?? 'Variant', callable: true, readonly: true, what: 'método de Signal' };
        }
        if (isNumeric(objectType) || objectType === 'bool' || objectType === 'null' || objectType === 'void') {
            this.error(span, objectType === 'void' ? 'Esta chamada não devolve valor (void): não há membro para acessar.' : `Um valor do tipo ${objectType} não tem o membro "${name}".`);
            return null;
        }
        const cls = this.classesByTypeName.get(objectType);
        if (cls) {
            const member = this.findMember(cls, name);
            if (member) {
                this.touchStatic(member);
                return this.lookupFromMember(member);
            }
            const base = this.baseMember(name, cls.godotBase);
            if (base)
                return { type: base.type, callable: base.kind === 'method', min: base.min, max: base.max, readonly: base.readonly, what: base.what };
            if (name === 'new') {
                this.error(span, `"new" cria instâncias a partir da classe (${cls.name}.new()), não de um objeto.`);
                return null;
            }
            const candidates = new Set<string>();
            for (let c: ClassInfo | null = cls; c; c = c.parent)
                for (const key of c.members.keys())
                    candidates.add(key);
            for (const key of Object.keys(NODE_PROPERTIES))
                if (baseMemberVisible(key, cls.godotBase))
                    candidates.add(key);
            for (const key of Object.keys(NODE_METHODS))
                if (baseMemberVisible(key, cls.godotBase))
                    candidates.add(key);
            this.error(span, `${cls.typeName} não tem o membro "${name}".${this.suggest(name, candidates)}`);
            return null;
        }
        if (isGodotNodeClass(objectType) || objectType === 'Node') {
            const base = this.baseMember(name, objectType);
            if (base)
                return { type: base.type, callable: base.kind === 'method', min: base.min, max: base.max, readonly: base.readonly, what: base.what };
            return { type: 'Variant', callable: true, readonly: false, what: 'membro' };
        }
        return { type: 'Variant', callable: true, readonly: false, what: 'membro' };
    }
    private lookupFromSingletonEntry(entry: (typeof SINGLETON_MEMBERS)[string][string], name: string): MemberLookup {
        switch (entry.kind) {
            case 'method':
                return { type: entry.returns, callable: true, min: entry.min, max: entry.max, readonly: true, what: `método ${name}` };
            case 'property':
                return { type: entry.type, callable: false, readonly: entry.readonly, what: 'propriedade' };
            case 'constant':
                return { type: 'int', callable: false, readonly: true, what: 'constante' };
        }
    }
    private singletonMember(singleton: string, name: string, span: SourceSpan): MemberLookup | null {
        const table = SINGLETON_MEMBERS[singleton];
        if (!table)
            return { type: 'Variant', callable: true, readonly: false, what: 'membro' };
        const entry = table[name];
        if (!entry) {
            this.error(span, `${singleton} não tem "${name}".${this.suggest(name, Object.keys(table))}`);
            return null;
        }
        return this.lookupFromSingletonEntry(entry, name);
    }
    private staticOfType(typeName: string, name: string, span: SourceSpan, mode: 'read' | 'call' | 'assign'): MemberLookup | null {
        const valueClass = VALUE_CLASSES[typeName];
        if (valueClass) {
            if (!(name in valueClass.ctor)) {
                const candidates = Object.getOwnPropertyNames(valueClass.ctor).filter((key) => !['length', 'name', 'prototype'].includes(key));
                this.error(span, `${typeName} não tem o membro estático "${name}".${this.suggest(name, candidates)}`);
                return null;
            }
            const isMethod = typeof (valueClass.ctor as Record<string, unknown>)[name] === 'function';
            const type = /^AXIS_/.test(name) ? 'int' : name === 'html_is_valid' ? 'bool' : typeName === 'Color' && (name === 'to_rgba32' || name === 'to_abgr32') ? 'int' : typeName;
            return { type, callable: isMethod, readonly: true, what: isMethod ? 'método estático' : 'constante' };
        }
        if (typeName === 'String' || typeName === 'StringName') {
            if (!Object.prototype.hasOwnProperty.call(STRING_STATICS, name)) {
                this.error(span, `String não tem o método estático "${name}".${this.suggest(name, Object.keys(STRING_STATICS))}`);
                return null;
            }
            return { type: 'String', callable: true, readonly: true, what: 'método estático de String' };
        }
        if (isGodotClass(typeName) || typeName === 'Object' || typeName === 'Node') {
            if (name === 'new') {
                if (isGodotNodeClass(typeName))
                    return { type: typeName, callable: true, min: 0, max: 0, readonly: true, what: 'construtor' };
                if (CONSTRUCTIBLE_OBJECT_CLASSES.has(typeName))
                    return { type: typeName, callable: true, min: 0, max: 0, readonly: true, what: 'construtor' };
                this.error(span, `${typeName} não pode ser criado com new() nesta engine.`);
                return null;
            }
            if (/^[A-Z][A-Z0-9_]*$/.test(name))
                return { type: 'int', callable: false, readonly: true, what: 'constante' };
            if (mode === 'call')
                return { type: 'Variant', callable: true, readonly: true, what: 'método estático' };
            this.error(span, `${typeName} não tem o membro estático "${name}".`);
            return null;
        }
        if (typeName === 'Array' || typeName === 'Dictionary' || isNumeric(typeName) || typeName === 'bool' || typeName === 'Callable' || typeName === 'Signal' || typeName in PACKED_ELEMENTS) {
            this.error(span, `${typeName} não tem membros estáticos; use ${typeName}(...) para construir um valor.`);
            return null;
        }
        return { type: 'Variant', callable: true, readonly: false, what: 'membro' };
    }
    private valueMember(typeName: string, name: string, span: SourceSpan): MemberLookup | null {
        const fields = VALUE_FIELDS[typeName] ?? {};
        const field = fields[name];
        if (field)
            return { type: field, callable: false, readonly: false, what: 'componente' };
        const valueClass = VALUE_CLASSES[typeName]!;
        const prototype = Object.getPrototypeOf(valueClass.sample) as object;
        if (!(name in prototype) || name === 'constructor') {
            const candidates = [...Object.keys(fields), ...Object.getOwnPropertyNames(prototype).filter((key) => key !== 'constructor')];
            this.error(span, `${typeName} não tem o membro "${name}".${this.suggest(name, candidates)}`);
            return null;
        }
        const isMethod = typeof (prototype as Record<string, unknown>)[name] === 'function';
        let type: StaticType = typeName;
        if (VECTOR_TYPES.has(typeName)) {
            if (VECTOR_FLOAT_METHODS.has(name) || (name === 'cross' && (typeName === 'Vector2' || typeName === 'Vector2i')))
                type = 'float';
            else if (name === 'max_axis_index' || name === 'min_axis_index')
                type = 'int';
            else if (name.startsWith('is_'))
                type = 'bool';
            else if (name === 'to_vector3' || name === 'to_vector2')
                type = 'Variant';
        }
        else if (typeName === 'Color') {
            if (name === 'to_html')
                type = 'String';
            else if (name.startsWith('to_'))
                type = 'int';
            else if (name.startsWith('is_'))
                type = 'bool';
            else if (name === 'luminance' || name === 'get_luminance')
                type = 'float';
        }
        else if (typeName === 'Quaternion') {
            if (name === 'length' || name === 'length_squared' || name === 'dot' || name === 'angle_to' || name === 'get_angle')
                type = 'float';
            else if (name.startsWith('is_'))
                type = 'bool';
            else if (name === 'get_euler' || name === 'get_axis')
                type = 'Vector3';
        }
        else if (typeName === 'Basis') {
            if (name === 'determinant' || name.startsWith('tdot'))
                type = 'float';
            else if (name === 'get_euler' || name === 'get_scale')
                type = 'Vector3';
            else if (name === 'get_rotation_quaternion')
                type = 'Quaternion';
            else if (name.startsWith('is_'))
                type = 'bool';
        }
        else if (typeName === 'Transform3D') {
            if (name.startsWith('is_'))
                type = 'bool';
        }
        else if (typeName === 'Rect2') {
            if (name === 'has_point' || name === 'intersects' || name === 'encloses' || name === 'has_area' || name.startsWith('is_'))
                type = 'bool';
            else if (name === 'get_area')
                type = 'float';
            else if (name === 'get_center')
                type = 'Vector2';
        }
        else if (typeName === 'AABB') {
            if (name === 'has_point' || name === 'intersects' || name === 'encloses' || name === 'has_volume' || name === 'has_surface' || name.startsWith('is_'))
                type = 'bool';
            else if (name === 'get_volume')
                type = 'float';
            else if (name === 'get_center' || name === 'get_longest_axis' || name === 'get_shortest_axis' || name === 'get_endpoint' || name === 'get_support')
                type = 'Vector3';
            else if (name === 'get_longest_axis_index' || name === 'get_shortest_axis_index')
                type = 'int';
            else if (name === 'get_longest_axis_size' || name === 'get_shortest_axis_size')
                type = 'float';
        }
        if (!isMethod)
            return { type: 'Variant', callable: false, readonly: false, what: 'propriedade' };
        return { type, callable: true, readonly: true, what: `método de ${typeName}` };
    }
    private call(e: CallExpression): StaticType {
        const callee = e.callee;
        const fn = this.fn!;
        if (callee.kind === 'identifier') {
            const calleeType = this.resolveIdentifier(callee, 'call');
            callee.type = calleeType;
            const argTypes = e.args.map((arg) => this.expression(arg));
            const resolution = callee.resolved;
            if (!resolution)
                return 'Variant';
            switch (resolution.kind) {
                case 'local': {
                    if (calleeType !== 'Callable' && calleeType !== 'Variant' && !isMeta(calleeType)) {
                        this.error(callee.span, `"${callee.name}" é ${describeType(calleeType)} e não pode ser chamado como função.`);
                        return 'Variant';
                    }
                    if (calleeType.startsWith('@class:')) {
                        this.error(callee.span, `Para criar uma instância use ${callee.name}.new(...).`);
                        return 'Variant';
                    }
                    return 'Variant';
                }
                case 'member': {
                    const member = this.findMember(fn.cls, callee.name) ?? this.findStaticInOuters(fn.cls, callee.name);
                    if (!member)
                        return 'Variant';
                    switch (member.kind) {
                        case 'func':
                            this.checkArity(callee.name, member.func!.params.filter((p) => !p.defaultValue).length, member.func!.params.length, e, argTypes, member.func!);
                            return member.type;
                        case 'var':
                        case 'const':
                            if (member.type === 'Callable' || member.type === 'Variant')
                                return 'Variant';
                            if (member.type.startsWith('@class:'))
                                this.error(callee.span, `Para criar uma instância use ${callee.name}.new(...).`);
                            else
                                this.error(callee.span, `"${callee.name}" é ${describeType(member.type)} e não pode ser chamado como função.`);
                            return 'Variant';
                        case 'signal':
                            this.error(callee.span, `Sinais não são chamados diretamente: use ${callee.name}.emit(...).`);
                            return 'Variant';
                        case 'class':
                            this.error(callee.span, `Para criar uma instância use ${callee.name}.new(...).`);
                            return 'Variant';
                        default:
                            this.error(callee.span, `"${callee.name}" é ${this.describeMemberKind(member.kind)} e não pode ser chamado como função.`);
                            return 'Variant';
                    }
                }
                case 'base': {
                    const base = this.baseMember(callee.name, fn.cls.godotBase);
                    if (!base)
                        return 'Variant';
                    if (base.kind !== 'method') {
                        this.error(callee.span, `"${callee.name}" é ${base.what}, não um método.`);
                        return 'Variant';
                    }
                    this.checkArity(callee.name, base.min, base.max, e, argTypes, null);
                    return base.type;
                }
                case 'class':
                case 'sibling':
                    this.error(callee.span, `Para criar uma instância use ${callee.name}.new(...).`);
                    return 'Variant';
                case 'builtin_type': {
                    const name = resolution.name;
                    const arity = CONSTRUCTOR_ARITY[name];
                    if (arity && !arity.includes(e.args.length))
                        this.error(e.span, `${name}(...) aceita ${arity.join(', ')} argumentos, não ${e.args.length}.`);
                    if (isGodotClass(name) || name === 'Object' || name === 'Node') {
                        this.error(callee.span, `Para criar um ${name} use ${name}.new().`);
                        return 'Variant';
                    }
                    const globalArity = GLOBAL_ARITY[name];
                    if (globalArity && (e.args.length < globalArity[0] || e.args.length > globalArity[1]))
                        this.error(e.span, `${name}(...) aceita ${globalArity[0] === globalArity[1] ? globalArity[0] : `de ${globalArity[0]} a ${globalArity[1]}`} argumento(s), não ${e.args.length}.`);
                    return name;
                }
                case 'singleton':
                    this.error(callee.span, `${callee.name} é um singleton: chame um método dele (${callee.name}.${this.firstMethodOf(callee.name)}(...)).`);
                    return 'Variant';
                case 'global_function': {
                    const name = resolution.name;
                    const arity = GLOBAL_ARITY[name];
                    if (arity && (e.args.length < arity[0] || e.args.length > arity[1])) {
                        this.error(e.span, `${name}() espera ${arity[0] === arity[1] ? `${arity[0]}` : arity[1] === Infinity ? `pelo menos ${arity[0]}` : `de ${arity[0]} a ${arity[1]}`} argumento${arity[0] === 1 && arity[1] === 1 ? '' : 's'}, mas recebeu ${e.args.length}.`);
                    }
                    if (name === 'preload')
                        this.error(e.span, 'preload precisa de um caminho fixo entre aspas: preload("res://Nome.gd").');
                    const known = GLOBAL_RETURN_TYPES[name];
                    if (known)
                        return known;
                    if (SAME_TYPE_GLOBALS.has(name)) {
                        const first = argTypes[0] ?? 'Variant';
                        if (name === 'lerp')
                            return isNumeric(first) ? 'float' : first;
                        if (name === 'min' || name === 'max')
                            return argTypes.every((t) => t === 'int') ? 'int' : argTypes.every(isNumeric) ? 'float' : argTypes.every((t) => t === first) ? first : 'Variant';
                        return isNumeric(first) || VALUE_TYPES.has(first) ? first : 'Variant';
                    }
                    return 'Variant';
                }
                case 'io':
                    return 'void';
                case 'constant':
                case 'key':
                    this.error(callee.span, `"${callee.name}" é uma constante e não pode ser chamada.`);
                    return 'Variant';
                case 'helix':
                    return 'Variant';
            }
        }
        if (callee.kind === 'member') {
            const lookup = this.member(callee, 'call');
            const argTypes = e.args.map((arg) => this.expression(arg));
            if (!lookup)
                return 'Variant';
            if (!lookup.callable) {
                this.error(callee.nameSpan, `"${callee.name}" é ${lookup.what} (${describeType(lookup.type)}) e não pode ser chamado como função.`);
                return 'Variant';
            }
            if (lookup.min !== undefined && lookup.max !== undefined)
                this.checkArity(callee.name, lookup.min, lookup.max, e, argTypes, lookup.func ?? null);
            if (lookup.type === 'Signal' && lookup.resolution?.kind === 'member') {
                this.error(callee.nameSpan, `Sinais não são chamados diretamente: use ${callee.name}.emit(...).`);
                return 'Variant';
            }
            if (lookup.resolution?.kind === 'member' && lookup.resolution.memberKind === 'var')
                return 'Variant';
            return lookup.type;
        }
        if (callee.kind === 'super') {
            const argTypes = e.args.map((arg) => this.expression(arg));
            if (fn.isLambda || fn.isInitializer || !fn.name) {
                this.error(callee.span, 'super() só pode ser chamado dentro de um método, e chama o método de mesmo nome da classe pai.');
                return 'Variant';
            }
            const lookup = this.superMember(fn.name, callee.span);
            if (!lookup)
                return 'Variant';
            if (lookup.min !== undefined && lookup.max !== undefined)
                this.checkArity(`super (${fn.name})`, lookup.min, lookup.max, e, argTypes, lookup.func ?? null);
            callee.type = 'Callable';
            return lookup.type;
        }
        const calleeType = this.expression(callee);
        for (const arg of e.args)
            this.expression(arg);
        if (calleeType !== 'Callable' && calleeType !== 'Variant' && !isMeta(calleeType)) {
            this.error(callee.span, `Um valor do tipo ${calleeType} não pode ser chamado como função.`);
            return 'Variant';
        }
        if (calleeType.startsWith('@class:'))
            this.error(callee.span, `Para criar uma instância use ${calleeType.slice(7)}.new(...).`);
        return 'Variant';
    }
    private firstMethodOf(singleton: string): string {
        const table = SINGLETON_MEMBERS[singleton];
        if (!table)
            return 'metodo';
        for (const [name, entry] of Object.entries(table))
            if (entry.kind === 'method')
                return name;
        return 'metodo';
    }
    private checkArity(name: string, min: number, max: number, e: CallExpression, argTypes: readonly StaticType[], func: FunctionMember | null): void {
        const count = e.args.length;
        if (count < min)
            this.error(e.span, `Faltam argumentos para "${name}": espera ${min === max ? min : `pelo menos ${min}`}, recebeu ${count}.`);
        else if (count > max)
            this.error(e.span, `Argumentos demais para "${name}": espera ${min === max ? max : `no máximo ${max}`}, recebeu ${count}.`);
        if (!func)
            return;
        for (let index = 0; index < Math.min(count, func.params.length); index++) {
            const param = func.params[index]!;
            const argType = argTypes[index] ?? 'Variant';
            if (param.type && param.staticType && argType === 'void')
                this.error(e.args[index]!.span, `O argumento ${index + 1} de "${name}" é uma chamada sem retorno (void).`);
            else if (param.type && param.staticType && !this.assignable(argType, param.staticType)) {
                this.error(e.args[index]!.span, `O argumento ${index + 1} de "${name}" (${param.name}) é do tipo ${param.staticType}, mas recebeu ${describeType(argType)}.`);
            }
        }
    }
    private lambda(e: LambdaExpression): StaticType {
        const outer = this.fn!;
        const returnType = e.returnType ? this.resolveTypeRef(e.returnType, outer.cls) : null;
        const fn: FunctionContext = {
            cls: outer.cls,
            isStatic: outer.isStatic,
            name: null,
            returnType,
            isLambda: true,
            parent: outer,
            captures: new Set(),
            assigned: new Set(),
            accessorOf: null,
            isInitializer: false,
            loopDepth: 0,
            hasAwait: false,
        };
        collectAssigned(e.body, fn.assigned);
        this.withFunction(fn, () => {
            this.declareParams(e.params);
            this.block(e.body, false);
            this.popScopeWarnings();
        });
        e.captures = [...fn.captures];
        e.isAsync = containsAwait(e.body);
        return 'Callable';
    }
    private binaryResult(operator: BinaryOperator, left: StaticType, right: StaticType, span: SourceSpan): StaticType | null {
        switch (operator) {
            case 'and':
            case 'or':
                return 'bool';
            case '==':
            case '!=':
                return 'bool';
            case 'in':
            case 'not in': {
                if (isNumeric(right) || right === 'bool' || right === 'null' || VALUE_TYPES.has(right) || right === 'Callable' || right === 'Signal') {
                    this.error(span, `O operador "in" precisa de uma coleção à direita (Array, Dictionary, String ou objeto), não ${right}.`);
                    return 'bool';
                }
                return 'bool';
            }
            default:
                break;
        }
        const unknown = left === 'Variant' || right === 'Variant' || isMeta(left) || isMeta(right);
        switch (operator) {
            case '<':
            case '>':
            case '<=':
            case '>=': {
                if (unknown)
                    return 'bool';
                if ((isNumeric(left) && isNumeric(right)) || (STRING_TYPES.has(left) && STRING_TYPES.has(right)) || left === right)
                    return 'bool';
                this.error(span, `Operandos inválidos ${describeType(left)} e ${describeType(right)} para o operador "${operator}".`);
                return 'bool';
            }
            case '&':
            case '|':
            case '^':
            case '<<':
            case '>>': {
                if (unknown)
                    return 'int';
                if (left === 'int' && right === 'int')
                    return 'int';
                this.error(span, `O operador "${operator}" só se aplica a int, não a ${describeType(left)} e ${describeType(right)}.`);
                return 'int';
            }
            default:
                break;
        }
        if (unknown) {
            if (operator === '%' && STRING_TYPES.has(left))
                return 'String';
            return 'Variant';
        }
        const result = this.arithmetic(operator, left, right);
        if (result === null) {
            const hint = operator === '+' && (STRING_TYPES.has(left) || STRING_TYPES.has(right)) ? ' Para juntar texto com números use str(): "Vida: " + str(vida), ou "Vida: %d" % vida.' : operator === '%' && isNumeric(left) && isNumeric(right) ? ' Para floats use fmod(a, b).' : '';
            this.error(span, `Operandos inválidos ${describeType(left)} e ${describeType(right)} para o operador "${operator}".${hint}`);
            return null;
        }
        if (operator === '/' && left === 'int' && right === 'int')
            this.warn(span, 'Divisão inteira: o resultado descarta a parte decimal. Use float(a) / b (ou 2.0 em vez de 2) para obter decimais.');
        return result;
    }
    private arithmetic(operator: BinaryOperator, left: StaticType, right: StaticType): StaticType | null {
        if (isNumeric(left) && isNumeric(right)) {
            if (operator === '%')
                return left === 'int' && right === 'int' ? 'int' : null;
            return left === 'int' && right === 'int' ? 'int' : 'float';
        }
        if (operator === '%') {
            if (STRING_TYPES.has(left))
                return 'String';
            if (VECTOR_TYPES.has(left) && (right === left || isNumeric(right)))
                return left;
            return null;
        }
        if (operator === '**')
            return null;
        if (STRING_TYPES.has(left) && STRING_TYPES.has(right))
            return operator === '+' ? 'String' : null;
        if (isArrayType(left) && isArrayType(right))
            return operator === '+' ? (left === right ? left : 'Array') : null;
        if (VECTOR_TYPES.has(left)) {
            if (right === left)
                return left;
            if (isNumeric(right) && (operator === '*' || operator === '/'))
                return left.endsWith('i') && right === 'float' ? left.slice(0, -1) : left;
            if ((left === 'Vector2' && right === 'Vector2i') || (left === 'Vector3' && right === 'Vector3i'))
                return left;
            if ((left === 'Vector2i' && right === 'Vector2') || (left === 'Vector3i' && right === 'Vector3'))
                return right;
            return null;
        }
        if (VECTOR_TYPES.has(right)) {
            if (isNumeric(left) && operator === '*')
                return right.endsWith('i') && left === 'float' ? right.slice(0, -1) : right;
            if (operator === '*' && (left === 'Quaternion' || left === 'Basis' || left === 'Transform3D') && right === 'Vector3')
                return 'Vector3';
            return null;
        }
        if (left === 'Color') {
            if (right === 'Color')
                return 'Color';
            if (isNumeric(right) && (operator === '*' || operator === '/'))
                return 'Color';
            return null;
        }
        if (right === 'Color' && isNumeric(left) && operator === '*')
            return 'Color';
        if (left === 'Quaternion') {
            if (right === 'Quaternion' && (operator === '*' || operator === '+' || operator === '-'))
                return 'Quaternion';
            if (isNumeric(right) && (operator === '*' || operator === '/'))
                return 'Quaternion';
            return null;
        }
        if (left === 'Basis') {
            if (right === 'Basis' && operator === '*')
                return 'Basis';
            if (isNumeric(right) && (operator === '*' || operator === '/'))
                return 'Basis';
            return null;
        }
        if (left === 'Transform3D' && operator === '*') {
            if (right === 'Transform3D')
                return 'Transform3D';
            if (right === 'AABB')
                return 'AABB';
            return null;
        }
        return null;
    }
    private isConstantExpression(e: Expression): boolean {
        switch (e.kind) {
            case 'literal':
            case 'string':
            case 'preload':
            case 'type_name':
                return true;
            case 'array':
                return e.elements.every((element) => this.isConstantExpression(element));
            case 'dictionary':
                return e.entries.every((entry) => this.isConstantExpression(entry.key) && this.isConstantExpression(entry.value));
            case 'unary':
                return this.isConstantExpression(e.operand);
            case 'binary':
                return this.isConstantExpression(e.left) && this.isConstantExpression(e.right);
            case 'ternary':
                return this.isConstantExpression(e.condition) && this.isConstantExpression(e.whenTrue) && this.isConstantExpression(e.whenFalse);
            case 'identifier': {
                const resolution = e.resolved;
                if (!resolution)
                    return false;
                switch (resolution.kind) {
                    case 'constant':
                    case 'key':
                    case 'builtin_type':
                    case 'class':
                    case 'sibling':
                        return true;
                    case 'member':
                        return resolution.memberKind === 'const' || resolution.memberKind === 'enum' || resolution.memberKind === 'enum_value' || resolution.memberKind === 'class';
                    case 'local': {
                        const local = this.lookupLocal(e.name);
                        return local?.isConst ?? false;
                    }
                    default:
                        return false;
                }
            }
            case 'member': {
                if (!this.isConstantExpression(e.object))
                    return false;
                const type = e.object.type ?? 'Variant';
                if (type.startsWith('@type:') || type.startsWith('@enum:'))
                    return true;
                const resolution = e.memberResolution;
                return resolution?.kind === 'member' ? resolution.memberKind === 'const' || resolution.memberKind === 'enum' || resolution.memberKind === 'enum_value' || resolution.memberKind === 'class' : false;
            }
            case 'call': {
                const callee = e.callee;
                if (callee.kind === 'identifier' && callee.resolved?.kind === 'builtin_type')
                    return e.args.every((arg) => this.isConstantExpression(arg));
                if (callee.kind === 'member' && this.isConstantExpression(callee.object) && (callee.object.type ?? '').startsWith('@type:'))
                    return e.args.every((arg) => this.isConstantExpression(arg));
                return false;
            }
            case 'index':
                return this.isConstantExpression(e.object) && this.isConstantExpression(e.index);
            case 'is':
            case 'as':
                return this.isConstantExpression(e.value);
            default:
                return false;
        }
    }
}
