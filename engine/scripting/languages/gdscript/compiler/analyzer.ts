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
