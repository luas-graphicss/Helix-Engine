import { CLASS_EXPORT, type GameContext, type HelixRoot, contextOf } from './bridge';
import { CONSTANTS, GLOBAL_FUNCTIONS, IO_NAMES, JSON_CLASS, KEY_CODES, io, type ConsoleLike } from './globals';
import { GODOT_CONSTANTS, GODOT_NODE_CLASSES, GODOT_OBJECT_CLASSES, SINGLETON_NAMES, godotIsA, isGodotClass } from './godot-api';
import { ARRAY_METHODS, CALLABLE_METHODS, DICT_METHODS, STRING_METHODS, STRING_STATICS, call, callable, construct, get, index, invoke, iter, lengthOf, set, setChain, setIndex } from './methods';
import { NodeBase, Resource, ScriptResource, WeakRef, nodeClass, runtimeClass, sceneTreeOf, wrapEntity } from './node';
import { GodotObject, defineScriptClass, getCurrentHelix, godotBaseOf, isA, setCurrentHelix } from './object';
import { JSONParser, loadResource, singletonsOf } from './singletons';
import { Tween } from './tween';
import { AABB, Basis, Color, Dictionary, GDScriptError, Quaternion, Rect2, Signal, Transform3D, Vector2, Vector2i, Vector3, Vector3i, Vector4, fail, isScriptClass, markScriptClass } from './values';
import * as variant from './variant';
import { TYPE_CONSTANTS, str, toFloat, toInt, truthy } from './variant';
type AnyRecord = Record<string, unknown>;
type Fn = (...args: unknown[]) => unknown;
function callableClass<T extends Function>(ctor: T): T {
    return new Proxy(ctor, {
        apply: (target, _thisArg, args: unknown[]) => new (target as unknown as new (...args: unknown[]) => unknown)(...args),
    });
}
function withStaticNew<T extends Function>(ctor: T): T {
    if (!Object.prototype.hasOwnProperty.call(ctor, 'new')) {
        Object.defineProperty(ctor, 'new', {
            value: function (this: unknown, ...args: unknown[]) {
                return construct(this as new (inject: unknown) => object, args);
            },
            configurable: true,
        });
    }
    return ctor;
}
function toArray(value: unknown): unknown[] {
    if (value === undefined || value === null)
        return [];
    if (Array.isArray(value))
        return value.slice();
    return Array.from(iter(value, 'Array()'));
}
function packed<T>(make: (values: number[]) => T): (value?: unknown) => T {
    return (value?: unknown) => make(toArray(value).map(Number));
}
const VALUE_TYPES: Record<string, Function> = {
    Vector2: callableClass(Vector2),
    Vector2i: callableClass(Vector2i),
    Vector3: callableClass(Vector3),
    Vector3i: callableClass(Vector3i),
    Vector4: callableClass(Vector4),
    Quaternion: callableClass(Quaternion),
    Basis: callableClass(Basis),
    Transform3D: callableClass(Transform3D),
    Color: callableClass(Color),
    Rect2: callableClass(Rect2),
    AABB: callableClass(AABB),
};
const PRIMITIVE_TYPES: Record<string, Fn> = {
    int: (value: unknown = 0) => toInt(value),
    float: (value: unknown = 0) => toFloat(value),
    bool: (value: unknown = false) => truthy(value),
    String: (value: unknown = '') => str(value),
    StringName: (value: unknown = '') => str(value),
    NodePath: (value: unknown = '') => str(value),
    Array: (value?: unknown) => toArray(value),
    Dictionary: (value?: unknown) => new Dictionary(value),
    Callable: GLOBAL_FUNCTIONS.Callable,
    Signal: (object: unknown = null, name: unknown = '') => new Signal(object as object | null, str(name)),
    PackedByteArray: packed((values) => Uint8Array.from(values)),
    PackedInt32Array: packed((values) => Int32Array.from(values)),
    PackedInt64Array: packed((values) => Float64Array.from(values)),
    PackedFloat32Array: packed((values) => Float32Array.from(values)),
    PackedFloat64Array: packed((values) => Float64Array.from(values)),
    PackedStringArray: (value?: unknown) => toArray(value).map((item) => str(item)),
    PackedVector2Array: (value?: unknown) => toArray(value).map((item) => new Vector2(item)),
    PackedVector3Array: (value?: unknown) => toArray(value).map((item) => new Vector3(item)),
    PackedColorArray: (value?: unknown) => toArray(value).map((item) => new Color(item)),
};
const TYPES: Record<string, unknown> = new Proxy({} as Record<string, unknown>, {
    get: (_target, name: string | symbol) => {
        if (typeof name !== 'string')
            return undefined;
        if (Object.prototype.hasOwnProperty.call(VALUE_TYPES, name))
            return VALUE_TYPES[name];
        if (Object.prototype.hasOwnProperty.call(PRIMITIVE_TYPES, name))
            return PRIMITIVE_TYPES[name];
        if (name === 'JSON')
            return withStaticNew(JSONParser);
        const cls = runtimeClass(name);
        if (cls)
            return withStaticNew(cls);
        return fail(`"${name}" não é um tipo que esta engine representa.`);
    },
    has: (_target, name: string | symbol) => typeof name === 'string' && (name in VALUE_TYPES || name in PRIMITIVE_TYPES || name === 'JSON' || runtimeClass(name) !== null),
});
const ALL_CONSTANTS: Readonly<Record<string, unknown>> = { ...GODOT_CONSTANTS, ...TYPE_CONSTANTS, ...CONSTANTS };
export interface ClassInfo {
    readonly name: string;
    readonly base: string;
    readonly isMain: boolean;
    readonly path?: string;
    readonly exports?: readonly ExportInfo[];
    readonly tool?: boolean;
    readonly icon?: string | null;
}
export interface ExportInfo {
    readonly name: string;
    readonly type: string;
    readonly hint?: string;
    readonly hintString?: string;
    readonly default?: unknown;
}
export type ModuleRecord = {
    exports: Record<string, unknown>;
};
export interface ScriptClassMeta {
    readonly name: string;
    readonly base: string;
    readonly path: string;
    readonly exports: readonly ExportInfo[];
    readonly tool: boolean;
    readonly icon: string | null;
}
export const CLASS_META = Symbol.for('helix.gdscript.classMeta');
export function classMeta(ctor: unknown): ScriptClassMeta | null {
    return ((ctor as {
        [CLASS_META]?: ScriptClassMeta;
    } | null)?.[CLASS_META] as ScriptClassMeta | undefined) ?? null;
}
function defineScriptStatics(ctor: Function, info: ClassInfo): void {
    const statics: Record<string, unknown> = {
        instantiate: (...args: unknown[]) => construct(ctor as new (inject: unknown) => object, args),
        can_instantiate: () => true,
        get_global_name: () => info.name,
        get_instance_base_type: () => info.base,
        get_base_script: () => {
            const parent = Object.getPrototypeOf(ctor) as Function | null;
            return parent && isScriptClass(parent) ? parent : null;
        },
    };
    for (const [name, value] of Object.entries(statics)) {
        if (!Object.prototype.hasOwnProperty.call(ctor, name))
            Object.defineProperty(ctor, name, { value, configurable: true });
    }
}
function detach(helix: HelixRoot, context: GameContext, value: unknown): void {
    if (!(value instanceof Promise))
        return;
    value.catch((cause: unknown) => {
        const task = helix.task as {
            spawn?: (fn: () => unknown) => unknown;
        } | undefined;
        if (typeof task?.spawn === 'function') {
            task.spawn(() => {
                throw cause;
            });
            return;
        }
        context.log('error', cause instanceof Error ? cause.message : String(cause));
    });
}
