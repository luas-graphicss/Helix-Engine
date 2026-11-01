import { Entity } from '@/engine/core/scene/entity';
import type { ScriptPropValue } from '../script-settings';
import { HelixArgumentError, HelixError } from '../runtime/script-errors';
import type { RuntimeHost } from '../runtime/runtime-host';
import { isJsonValue, requireFunction, requireString, toLinearColor, toVec3 } from '../runtime/values';
export type PropType = 'number' | 'boolean' | 'string' | 'vec3' | 'color' | 'entity' | 'asset' | 'enum' | 'range';
export interface PropDefinition {
    readonly name: string;
    readonly type: PropType;
    readonly default: ScriptPropValue;
    readonly label?: string;
    readonly hint?: string;
    readonly min?: number;
    readonly max?: number;
    readonly step?: number;
    readonly options?: readonly string[];
    readonly assetKind?: string;
}
export class PropRegistry {
    private readonly definitions = new Map<string, Map<string, PropDefinition>>();
    private readonly orders = new Map<string, number>();
    define(assetId: string, definition: PropDefinition): void {
        let byName = this.definitions.get(assetId);
        if (!byName)
            this.definitions.set(assetId, (byName = new Map()));
        byName.set(definition.name, definition);
    }
    of(assetId: string): PropDefinition[] {
        return Array.from(this.definitions.get(assetId)?.values() ?? []);
    }
    get(assetId: string, name: string): PropDefinition | null {
        return this.definitions.get(assetId)?.get(name) ?? null;
    }
    setExecutionOrder(assetId: string, order: number): void {
        this.orders.set(assetId, order);
    }
    executionOrder(assetId: string): number {
        return this.orders.get(assetId) ?? 0;
    }
    clear(assetId?: string): void {
        if (assetId) {
            this.definitions.delete(assetId);
            this.orders.delete(assetId);
            return;
        }
        this.definitions.clear();
        this.orders.clear();
    }
}
const PROP_TYPES: readonly PropType[] = ['number', 'boolean', 'string', 'vec3', 'color', 'entity', 'asset', 'enum', 'range'];
function defaultFor(type: PropType, spec: Record<string, unknown>): ScriptPropValue {
    if (spec.default !== undefined) {
        if (spec.default instanceof Entity)
            return spec.default.id;
        if (spec.default instanceof Float32Array)
            return Array.from(spec.default);
        if (!isJsonValue(spec.default))
            throw new HelixArgumentError('helix.props.define', `o valor padrão de "${String(spec.name)}" precisa ser serializável em JSON.`);
        return spec.default as ScriptPropValue;
    }
    switch (type) {
        case 'number':
        case 'range':
            return typeof spec.min === 'number' ? spec.min : 0;
        case 'boolean':
            return false;
        case 'string':
            return '';
        case 'vec3':
            return [0, 0, 0];
        case 'color':
            return '#ffffff';
        case 'enum':
            return Array.isArray(spec.options) && typeof spec.options[0] === 'string' ? spec.options[0] : '';
        default:
            return null;
    }
}
function materialize(host: RuntimeHost, definition: PropDefinition, raw: ScriptPropValue | undefined): unknown {
    const value = raw === undefined ? definition.default : raw;
    switch (definition.type) {
        case 'number':
        case 'range': {
            const number = typeof value === 'number' ? value : Number(value);
            if (!Number.isFinite(number))
                return typeof definition.default === 'number' ? definition.default : 0;
            if (definition.min !== undefined && number < definition.min)
                return definition.min;
            if (definition.max !== undefined && number > definition.max)
                return definition.max;
            return number;
        }
        case 'boolean':
            return Boolean(value);
        case 'string':
            return value === null || value === undefined ? '' : String(value);
        case 'enum':
            return typeof value === 'string' && (!definition.options || definition.options.includes(value)) ? value : (definition.options?.[0] ?? '');
        case 'vec3':
            return Array.isArray(value) && value.length >= 3 ? toVec3(value as number[], 'helix.props') : toVec3(definition.default as number[], 'helix.props');
        case 'color':
            return typeof value === 'string' ? toLinearColor(value, 'helix.props') : Array.isArray(value) ? toVec3(value as number[], 'helix.props') : toLinearColor('#ffffff', 'helix.props');
        case 'entity':
            return typeof value === 'number' ? host.session.findById(value) : typeof value === 'string' ? host.session.findByName(value) : null;
        case 'asset':
            return typeof value === 'string' ? (host.session.library.get(value) ?? null) : null;
    }
}
function serialize(definition: PropDefinition, value: unknown): ScriptPropValue {
    switch (definition.type) {
        case 'number':
        case 'range': {
            const number = Number(value);
            if (!Number.isFinite(number))
                throw new HelixArgumentError('helix.props.set', `"${definition.name}" espera um número.`);
            return number;
        }
        case 'boolean':
            return Boolean(value);
        case 'string':
            return String(value ?? '');
        case 'enum': {
            const text = String(value);
            if (definition.options && !definition.options.includes(text))
                throw new HelixArgumentError('helix.props.set', `"${definition.name}" aceita ${definition.options.map((option) => `"${option}"`).join(', ')}; recebido "${text}".`);
            return text;
        }
        case 'vec3':
        case 'color':
            return Array.from(definition.type === 'color' ? toLinearColor(value, 'helix.props.set') : toVec3(value, 'helix.props.set'));
        case 'entity':
            if (value === null || value === undefined)
                return null;
            if (value instanceof Entity)
                return value.id;
            if (typeof value === 'number')
                return value;
            throw new HelixArgumentError('helix.props.set', `"${definition.name}" espera um Entity (ou null).`);
        case 'asset':
            if (value === null || value === undefined)
                return null;
            if (typeof value === 'string')
                return value;
            if (typeof value === 'object' && typeof (value as {
                id?: unknown;
            }).id === 'string')
                return (value as {
                    id: string;
                }).id;
            throw new HelixArgumentError('helix.props.set', `"${definition.name}" espera um ativo da biblioteca (ou o id dele).`);
    }
}
export function createPropsApi(host: RuntimeHost, registry: PropRegistry) {
    const listeners = new Map<string, Set<(value: unknown, previous: unknown) => void>>();
    function current(member: string) {
        const context = host.current;
        if (!context)
            throw new HelixError(`${member} só pode ser usado de dentro de um script (durante um hook ou callback).`);
        return context;
    }
    function settingsOf(member: string) {
        const context = current(member);
        const actor = context.handle.actor;
        const settings = actor?.script ?? null;
        return { context, settings };
    }
    function define(spec: unknown): void {
        const member = 'helix.props.define';
        const context = current(member);
        if (typeof spec !== 'object' || spec === null)
            throw new HelixArgumentError(member, 'esperava um objeto { nome: { type, default, ... } } ou uma lista de definições.');
        const entries: Array<[
            string,
            Record<string, unknown>
        ]> = Array.isArray(spec)
            ? spec.map((entry: Record<string, unknown>) => [requireString(entry.name, member, 'o nome da propriedade'), entry])
            : Object.entries(spec as Record<string, unknown>).map(([name, entry]) => [name, typeof entry === 'object' && entry !== null && !Array.isArray(entry) && !(entry instanceof Float32Array) && !(entry instanceof Entity) ? (entry as Record<string, unknown>) : { default: entry }]);
        for (const [name, raw] of entries) {
            const inferred = raw.type ?? inferType(raw.default);
            if (typeof inferred !== 'string' || !PROP_TYPES.includes(inferred as PropType))
                throw new HelixArgumentError(member, `tipo "${String(inferred)}" da propriedade "${name}" não é válido. Tipos: ${PROP_TYPES.join(', ')}.`);
            const type = inferred as PropType;
            if (type === 'enum' && (!Array.isArray(raw.options) || raw.options.length === 0))
                throw new HelixArgumentError(member, `a propriedade enum "${name}" precisa de options: ['a', 'b', …].`);
            registry.define(context.assetId, {
                name,
                type,
                default: defaultFor(type, { ...raw, name }),
                label: typeof raw.label === 'string' ? raw.label : undefined,
                hint: typeof raw.hint === 'string' ? raw.hint : undefined,
                min: typeof raw.min === 'number' ? raw.min : undefined,
                max: typeof raw.max === 'number' ? raw.max : undefined,
                step: typeof raw.step === 'number' ? raw.step : undefined,
                options: Array.isArray(raw.options) ? raw.options.map(String) : undefined,
                assetKind: typeof raw.assetKind === 'string' ? raw.assetKind : typeof raw.kind === 'string' ? raw.kind : undefined,
            });
        }
        host.session.notify();
    }
    function get(nameValue: unknown): unknown {
        const member = 'helix.props.get';
        const name = requireString(nameValue, member, 'o nome da propriedade');
        const { context, settings } = settingsOf(member);
        const definition = registry.get(context.assetId, name);
        if (!definition)
            throw new HelixArgumentError(member, `a propriedade "${name}" não foi declarada; use helix.props.define({ ${name}: { type: 'number', default: 0 } }).`);
        return materialize(host, definition, settings?.props[name]);
    }
    function set(nameValue: unknown, value: unknown): void {
        const member = 'helix.props.set';
        const name = requireString(nameValue, member, 'o nome da propriedade');
        const { context, settings } = settingsOf(member);
        const definition = registry.get(context.assetId, name);
        if (!definition)
            throw new HelixArgumentError(member, `a propriedade "${name}" não foi declarada.`);
        if (!settings)
            throw new HelixError(`${member}: o script de entrada não tem ator, logo não tem propriedades por instância.`);
        const previous = materialize(host, definition, settings.props[name]);
        settings.props[name] = serialize(definition, value);
        const next = materialize(host, definition, settings.props[name]);
        for (const listener of listeners.get(`${context.id}:${name}`) ?? [])
            host.invoke(context, `helix.props.onChanged("${name}")`, () => listener(next, previous));
        host.session.notify();
    }
    return {
        define,
        get,
        set,
        has: (nameValue: unknown) => {
            const context = current('helix.props.has');
            return registry.get(context.assetId, requireString(nameValue, 'helix.props.has', 'o nome')) !== null;
        },
        all: () => {
            const { context, settings } = settingsOf('helix.props.all');
            const values: Record<string, unknown> = {};
            for (const definition of registry.of(context.assetId))
                values[definition.name] = materialize(host, definition, settings?.props[definition.name]);
            return values;
        },
        definitions: () => registry.of(current('helix.props.definitions').assetId).map((definition) => ({ ...definition })),
        onChanged: (nameValue: unknown, handler: unknown) => {
            const context = current('helix.props.onChanged');
            const name = requireString(nameValue, 'helix.props.onChanged', 'o nome');
            const fn = requireFunction<(value: unknown, previous: unknown) => void>(handler, 'helix.props.onChanged');
            const key = `${context.id}:${name}`;
            let set = listeners.get(key);
            if (!set)
                listeners.set(key, (set = new Set()));
            set.add(fn);
            const dispose = () => {
                set!.delete(fn);
                if (set!.size === 0)
                    listeners.delete(key);
            };
            context.track(dispose);
            return dispose;
        },
        reset: (nameValue?: unknown) => {
            const { context, settings } = settingsOf('helix.props.reset');
            if (!settings)
                return;
            if (nameValue === undefined) {
                settings.props = {};
            }
            else {
                delete settings.props[requireString(nameValue, 'helix.props.reset', 'o nome')];
            }
            host.session.notify();
        },
        get executionOrder() {
            const context = current('helix.props.executionOrder');
            return context.handle.actor?.script?.executionOrder ?? registry.executionOrder(context.assetId);
        },
        set executionOrder(value: number) {
            const context = current('helix.props.executionOrder');
            if (typeof value !== 'number' || !Number.isFinite(value))
                throw new HelixArgumentError('helix.props.executionOrder', 'esperava um número.');
            registry.setExecutionOrder(context.assetId, value);
            if (context.handle.actor?.script)
                context.handle.actor.script.executionOrder = value;
            host.requestActorSync();
        },
        notifyExternalChange: (assetId: string, actorId: number, name: string) => {
            for (const context of host.scriptsOfAsset(assetId)) {
                if (context.handle.actor?.id !== actorId)
                    continue;
                const definition = registry.get(assetId, name);
                if (!definition)
                    continue;
                const value = materialize(host, definition, context.handle.actor.script?.props[name]);
                for (const listener of listeners.get(`${context.id}:${name}`) ?? [])
                    host.invoke(context, `helix.props.onChanged("${name}")`, () => listener(value, undefined));
            }
        },
    };
}
function inferType(value: unknown): PropType | undefined {
    if (typeof value === 'number')
        return 'number';
    if (typeof value === 'boolean')
        return 'boolean';
    if (typeof value === 'string')
        return /^#[0-9a-f]{3,8}$/i.test(value) ? 'color' : 'string';
    if (value instanceof Entity)
        return 'entity';
    if (value instanceof Float32Array && value.length === 3)
        return 'vec3';
    if (Array.isArray(value) && value.length === 3 && value.every((entry) => typeof entry === 'number'))
        return 'vec3';
    return undefined;
}
export { materialize as materializeProp };
