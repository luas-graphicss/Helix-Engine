import type { Entity } from '@/engine/core/scene/entity';
import type { ScriptLanguageId } from '../script-languages';
import type { ScriptRunContext } from '../script-document';
import type { LoadedModule } from './module-loader';
import type { ScriptContext, ScriptHandle } from './runtime-host';
import { HelixError } from './script-errors';
export const LIFECYCLE_HOOKS = ['onLoad', 'onStart', 'onUpdate', 'onFixedUpdate', 'onLateUpdate', 'onRender', 'onEnable', 'onDisable', 'onStop', 'onDestroy', 'onBeforeHotReload', 'onHotReload'] as const;
export const CONTACT_HOOKS = ['onCollisionBegin', 'onCollisionStay', 'onCollisionEnd', 'onTriggerEnter', 'onTriggerStay', 'onTriggerExit'] as const;
export type HookName = (typeof LIFECYCLE_HOOKS)[number] | (typeof CONTACT_HOOKS)[number];
export type HookFunction = (...args: unknown[]) => unknown;
export interface ResolvedHooks {
    readonly target: object | undefined;
    readonly hooks: Partial<Record<HookName, HookFunction>>;
    readonly shape: 'class' | 'object' | 'functions' | 'empty';
}
export type HooksResolver = (exports: Record<string, unknown>, inject: InjectedFields) => ResolvedHooks;
export function hooksFromFunctions(hooks: Record<string, unknown>): ResolvedHooks {
    const resolved: Partial<Record<HookName, HookFunction>> = {};
    for (const name of ALL_HOOKS) {
        const candidate = hooks[name];
        if (typeof candidate === 'function')
            resolved[name] = candidate as HookFunction;
    }
    return { target: undefined, hooks: resolved, shape: Object.keys(resolved).length > 0 ? 'functions' : 'empty' };
}
const ALL_HOOKS: readonly HookName[] = [...LIFECYCLE_HOOKS, ...CONTACT_HOOKS];
function isClass(value: unknown): value is new () => object {
    if (typeof value !== 'function')
        return false;
    const source = Function.prototype.toString.call(value);
    return /^class[\s{]/.test(source) || (value.prototype !== undefined && Object.getOwnPropertyNames(value.prototype).length > 1);
}
export interface InjectedFields {
    readonly entity: Entity | null;
    readonly helix: object;
    readonly script: ScriptHandle;
}
export function resolveHooks(exports: Record<string, unknown>, inject: InjectedFields): ResolvedHooks {
    const defaultExport = exports.default;
    const collect = (source: object | undefined, lookup: (name: HookName) => unknown): Partial<Record<HookName, HookFunction>> => {
        const hooks: Partial<Record<HookName, HookFunction>> = {};
        for (const name of ALL_HOOKS) {
            const candidate = lookup(name);
            if (typeof candidate === 'function')
                hooks[name] = source ? (candidate as HookFunction).bind(source) : (candidate as HookFunction);
        }
        return hooks;
    };
    if (isClass(defaultExport)) {
        const instance = new defaultExport() as Record<string, unknown>;
        for (const [key, value] of Object.entries(inject))
            if (instance[key] === undefined)
                instance[key] = value;
        if (instance.self === undefined)
            instance.self = inject.entity;
        if (instance.actor === undefined)
            instance.actor = inject.entity;
        return { target: instance, hooks: collect(instance, (name) => instance[name]), shape: 'class' };
    }
    if (defaultExport && typeof defaultExport === 'object') {
        const object = defaultExport as Record<string, unknown>;
        return { target: object, hooks: collect(object, (name) => object[name]), shape: 'object' };
    }
    if (typeof defaultExport === 'function') {
        const produced = defaultExport.call(undefined, inject);
        if (produced && typeof produced === 'object') {
            const object = produced as Record<string, unknown>;
            return { target: object, hooks: collect(object, (name) => object[name]), shape: 'object' };
        }
        throw new HelixError('O export default é uma função que não devolveu um objeto de hooks; exporte uma classe, um objeto ou funções nomeadas (onStart, onUpdate…).');
    }
    const hooks = collect(undefined, (name) => exports[name]);
    return { target: undefined, hooks, shape: Object.keys(hooks).length > 0 ? 'functions' : 'empty' };
}
let nextInstanceId = 1;
export class ScriptInstance implements ScriptContext {
    readonly id = nextInstanceId++;
    readonly handle: ScriptHandle;
    readonly helix: object;
    hooks: ResolvedHooks;
    enabled = true;
    faulted = false;
    loaded = false;
    started = false;
    destroyed = false;
    wasActive = false;
    consecutiveFailures = 0;
    hierarchyIndex = 0;
    private readonly disposers = new Set<() => void>();
    constructor(readonly module: LoadedModule, readonly actor: Entity | null, readonly self: Entity | null, readonly role: 'entry' | 'actor', createHelix: (instance: ScriptInstance) => object, resolve: HooksResolver = resolveHooks) {
        const compiled = module.compiled;
        const instance = this;
        this.handle = {
            assetId: compiled.assetId,
            name: compiled.name,
            language: compiled.language,
            runContext: compiled.runContext,
            actor,
            get enabled() {
                return instance.enabled;
            },
            enable: () => {
                instance.enabled = true;
            },
            disable: () => {
                instance.enabled = false;
            },
        };
        this.helix = createHelix(this);
        this.hooks = resolve(module.exports, { entity: self, helix: this.helix, script: this.handle });
    }
    get name(): string {
        return this.module.compiled.name;
    }
    get assetId(): string {
        return this.module.compiled.assetId;
    }
    get file(): string {
        return this.module.file;
    }
    get runContext(): ScriptRunContext {
        return this.module.compiled.runContext;
    }
    get language(): ScriptLanguageId {
        return this.module.compiled.language;
    }
    get active(): boolean {
        if (this.destroyed || this.faulted || !this.enabled)
            return false;
        const actor = this.actor;
        if (!actor)
            return true;
        if (actor.script && !actor.script.enabled)
            return false;
        for (let current: Entity | null = actor; current; current = current.parent)
            if (!current.visible)
                return false;
        return true;
    }
    has(name: HookName): boolean {
        return typeof this.hooks.hooks[name] === 'function';
    }
    hook(name: HookName): HookFunction | null {
        return this.hooks.hooks[name] ?? null;
    }
    track(dispose: () => void): () => void {
        this.disposers.add(dispose);
        return dispose;
    }
    dispose(): void {
        this.destroyed = true;
        for (const dispose of Array.from(this.disposers)) {
            try {
                dispose();
            }
            catch {
            }
        }
        this.disposers.clear();
    }
}
