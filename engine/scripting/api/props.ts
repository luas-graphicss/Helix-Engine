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
