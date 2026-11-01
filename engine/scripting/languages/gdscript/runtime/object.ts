import { contextOf, type GameContext, type HelixRoot } from './bridge';
import { godotIsA } from './godot-api';
import { call as dynamicCall, get as dynamicGet, set as dynamicSet, toEngineArgs } from './methods';
import { Dictionary, Signal, fail, markScriptClass, sameCallable, scriptClassName } from './values';
import { str } from './variant';
type Fn = (...args: unknown[]) => unknown;
export interface Injection {
    readonly entity: unknown;
    readonly helix: HelixRoot;
    readonly script: unknown;
}
const BASE_NAME = Symbol.for('helix.gdscript.base');
const SCRIPT_NAME = Symbol.for('helix.gdscript.scriptName');
export function godotBaseOf(ctor: unknown): string {
    let current = ctor as (Function & {
        [BASE_NAME]?: string;
    }) | null;
    while (current) {
        const base = current[BASE_NAME];
        if (base)
            return base;
        current = Object.getPrototypeOf(current) as typeof current;
    }
    return 'Object';
}
export function setGodotBase(ctor: Function, base: string): void {
    Object.defineProperty(ctor, BASE_NAME, { value: base, configurable: true });
}
export function scriptNameOf(value: object): string | null {
    let current = Object.getPrototypeOf(value) as (object & {
        constructor: Function & {
            [SCRIPT_NAME]?: string;
        };
    }) | null;
    while (current) {
        const name = current.constructor[SCRIPT_NAME];
        if (name)
            return name;
        current = Object.getPrototypeOf(current) as typeof current;
    }
    return null;
}
export function setScriptName(ctor: Function, name: string): void {
    Object.defineProperty(ctor, SCRIPT_NAME, { value: name, configurable: true });
}
export class GodotObject {
    $context: GameContext;
    $helix: HelixRoot;
    readonly $instanceId: number;
    $freed = false;
    private $signals: Map<string, Signal> | null = null;
    private $meta: Dictionary | null = null;
    constructor(inject: Injection | null = null) {
        const helix = inject?.helix ?? currentHelix;
        if (!helix)
            fail(`${scriptClassName(this) ?? 'Object'}.new() foi chamado fora de um jogo: não há runtime da engine ativo.`);
        this.$helix = helix;
        this.$context = contextOf(helix);
        this.$instanceId = this.$context.allocateInstanceId();
    }
    $signal(name: string): Signal | null {
        const own = (this as unknown as Record<string, unknown>)[name];
        if (own instanceof Signal)
            return own;
        return this.$signals?.get(name) ?? null;
    }
    protected $builtinSignal(name: string): Signal {
        if (!this.$signals)
            this.$signals = new Map();
        let signal = this.$signals.get(name);
        if (!signal) {
            signal = new Signal(this, name);
            this.$signals.set(name, signal);
        }
        return signal;
    }
    $emit(name: string, ...args: unknown[]): void {
        this.$signal(name)?.emit(...args);
    }
    $clearSignals(): void {
        for (const key of Object.keys(this)) {
            const value = (this as unknown as Record<string, unknown>)[key];
            if (value instanceof Signal)
                value.clearConnections();
        }
        if (this.$signals)
            for (const signal of this.$signals.values())
                signal.clearConnections();
    }
    private $requireSignal(name: unknown, where: string): Signal {
        if (typeof name !== 'string')
            fail(`${where}: o nome do sinal precisa ser uma String.`);
        const signal = this.$signal(name);
        if (!signal)
            fail(`${where}: ${scriptClassName(this) ?? godotBaseOf(this.constructor)} não tem o sinal "${name}".`);
        return signal;
    }
    emit_signal(name: unknown, ...args: unknown[]): number {
        this.$requireSignal(name, 'emit_signal').emit(...args);
        return 0;
    }
    connect(name: unknown, callable: unknown, flags = 0): number {
        return this.$requireSignal(name, 'connect').connect(callable, Number(flags));
    }
    disconnect(name: unknown, callable: unknown): void {
        this.$requireSignal(name, 'disconnect').disconnect(callable);
    }
    is_connected(name: unknown, callable: unknown): boolean {
        return this.$requireSignal(name, 'is_connected').is_connected(callable);
    }
    has_signal(name: unknown): boolean {
        return typeof name === 'string' && this.$signal(name) !== null;
    }
    add_user_signal(name: unknown): void {
        if (typeof name !== 'string' || name.length === 0)
            fail('add_user_signal(): o nome do sinal precisa ser uma String.');
        if (this.$signal(name))
            fail(`add_user_signal(): o sinal "${name}" já existe.`);
        this.$builtinSignal(name);
    }
    get_signal_list(): Dictionary[] {
        const names = new Set<string>();
        for (const key of Object.keys(this))
            if ((this as unknown as Record<string, unknown>)[key] instanceof Signal)
                names.add(key);
        if (this.$signals)
            for (const key of this.$signals.keys())
                names.add(key);
        return Array.from(names, (name) => new Dictionary({ name, args: [] }));
    }
    get_class(): string {
        return godotBaseOf(this.constructor);
    }
    is_class(name: unknown): boolean {
        if (typeof name !== 'string')
            return false;
        if (scriptNameOf(this) === name)
            return true;
        return isA(godotBaseOf(this.constructor), name);
    }
    get_script(): unknown {
        return scriptNameOf(this) ? this.constructor : null;
    }
    get_instance_id(): number {
        return this.$instanceId;
    }
    has_method(name: unknown): boolean {
        return typeof name === 'string' && !name.startsWith('$') && typeof (this as unknown as Record<string, unknown>)[name] === 'function';
    }
    get_method_list(): Dictionary[] {
        const names = new Set<string>();
        let current: object | null = Object.getPrototypeOf(this) as object;
        while (current && current !== Object.prototype) {
            for (const key of Object.getOwnPropertyNames(current)) {
                if (key === 'constructor' || key.startsWith('$'))
                    continue;
                const descriptor = Object.getOwnPropertyDescriptor(current, key);
                if (descriptor && typeof descriptor.value === 'function')
                    names.add(key);
            }
            current = Object.getPrototypeOf(current) as object | null;
        }
        return Array.from(names, (name) => new Dictionary({ name, args: [], return: new Dictionary({ type: 0 }) }));
    }
    get_property_list(): Dictionary[] {
        return Object.keys(this)
            .filter((key) => !key.startsWith('$') && !((this as unknown as Record<string, unknown>)[key] instanceof Signal))
            .map((name) => new Dictionary({ name: name.endsWith('$') ? name.slice(0, -1) : name, class_name: scriptNameOf(this) ?? '', type: 0, hint: 0, hint_string: '', usage: 6 }));
    }
    call(name: unknown, ...args: unknown[]): unknown {
        if (typeof name !== 'string')
            fail('call(): o nome do método precisa ser uma String.');
        return dynamicCall(this, name, args);
    }
    callv(name: unknown, args: unknown): unknown {
        if (!Array.isArray(args))
            fail('callv(): o segundo argumento precisa ser um Array com os argumentos.');
        return this.call(name, ...args);
    }
    call_deferred(name: unknown, ...args: unknown[]): void {
        if (typeof name !== 'string')
            fail('call_deferred(): o nome do método precisa ser uma String.');
        this.$context.defer(() => {
            if (!this.$freed)
                dynamicCall(this, name, args);
        });
    }
    get(property: unknown): unknown {
        if (typeof property !== 'string')
            fail('get(): o nome da propriedade precisa ser uma String.');
        if (property.includes('/') || property.includes(':')) {
            let value: unknown = this;
            for (const part of property.split(/[/:]/))
                value = dynamicGet(value, part);
            return value;
        }
        return dynamicGet(this, property);
    }
    set(property: unknown, value: unknown): void {
        if (typeof property !== 'string')
            fail('set(): o nome da propriedade precisa ser uma String.');
        dynamicSet(this, property, value);
    }
    set_deferred(property: unknown, value: unknown): void {
        if (typeof property !== 'string')
            fail('set_deferred(): o nome da propriedade precisa ser uma String.');
        this.$context.defer(() => {
            if (!this.$freed)
                dynamicSet(this, property, value);
        });
    }
    protected $metaStore(): Dictionary {
        if (!this.$meta)
            this.$meta = new Dictionary();
        return this.$meta;
    }
    set_meta(name: unknown, value: unknown): void {
        if (typeof name !== 'string')
            fail('set_meta(): o nome precisa ser uma String.');
        if (value === null || value === undefined)
            this.$metaStore().delete(name);
        else
            this.$metaStore().set(name, value);
    }
    get_meta(name: unknown, fallback: unknown = undefined): unknown {
        if (typeof name !== 'string')
            fail('get_meta(): o nome precisa ser uma String.');
        const store = this.$metaStore();
        if (store.has(name))
            return store.get(name);
        if (fallback !== undefined)
            return fallback;
        return fail(`get_meta(): não existe o metadado "${name}" neste objeto; passe um valor padrão ou confira com has_meta().`);
    }
    has_meta(name: unknown): boolean {
        return typeof name === 'string' && this.$metaStore().has(name);
    }
    remove_meta(name: unknown): void {
        if (typeof name === 'string')
            this.$metaStore().delete(name);
    }
    get_meta_list(): unknown[] {
        return this.$metaStore().keys();
    }
    free(): void {
        this.$freed = true;
        this.$clearSignals();
    }
    get __gdFreed(): boolean {
        return this.$freed;
    }
    is_queued_for_deletion(): boolean {
        return false;
    }
    notify_property_list_changed(): void { }
    tr(message: unknown): string {
        return str(message);
    }
    to_string(): string {
        const custom = (this as unknown as {
            _to_string?: Fn;
        })._to_string;
        if (typeof custom === 'function' && custom !== GodotObject.prototype._to_string)
            return str(custom.call(this));
        return `<${scriptNameOf(this) ?? godotBaseOf(this.constructor)}#${this.$instanceId}>`;
    }
    toString(): string {
        return this.to_string();
    }
    _init(..._args: unknown[]): void { }
    _ready(): void { }
    _enter_tree(): void { }
    _exit_tree(): void { }
    _process(_delta: number): void { }
    _physics_process(_delta: number): void { }
    _input(_event: unknown): void { }
    _unhandled_input(_event: unknown): void { }
    _unhandled_key_input(_event: unknown): void { }
    _shortcut_input(_event: unknown): void { }
    _notification(_what: number): void { }
    _to_string(): string {
        return `<${scriptNameOf(this) ?? godotBaseOf(this.constructor)}#${this.$instanceId}>`;
    }
    _get_configuration_warnings(): string[] {
        return [];
    }
    _integrate_forces(_state: unknown): void { }
    _draw(): void { }
}
setGodotBase(GodotObject, 'Object');
export { Signal, sameCallable, toEngineArgs };
export function isA(name: string, ancestor: string): boolean {
    if (ancestor === 'Object')
        return true;
    if (name === 'KinematicCollision3D')
        return ancestor === 'RefCounted';
    return godotIsA(name, ancestor) || (ancestor === 'Node' && godotIsA(name, 'Node3D'));
}
let currentHelix: HelixRoot | null = null;
export function setCurrentHelix(helix: HelixRoot): void {
    currentHelix = helix;
}
export function getCurrentHelix(): HelixRoot | null {
    return currentHelix;
}
export function defineScriptClass(ctor: Function, name: string, base: string): void {
    markScriptClass(ctor, name);
    setScriptName(ctor, name);
    setGodotBase(ctor, base);
    if (!Object.prototype.hasOwnProperty.call(ctor, 'new')) {
        Object.defineProperty(ctor, 'new', {
            value: (...args: unknown[]) => {
                const instance = new (ctor as new (inject: null) => GodotObject)(null);
                instance._init(...args);
                return instance;
            },
            configurable: true,
        });
    }
}
