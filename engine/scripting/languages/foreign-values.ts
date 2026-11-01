import { isEngineResource } from '../runtime/engine-objects';
import { CONTACT_HOOKS, LIFECYCLE_HOOKS, type HookName } from '../runtime/script-instance';
import { HelixError } from '../runtime/script-errors';
import type { ForeignLocation } from './language-engine';
export class ForeignScriptError extends HelixError {
    constructor(message: string, name: string, readonly location: ForeignLocation | null, readonly traceback: string | null) {
        super(message);
        this.name = name;
    }
}
export function isThenable(value: unknown): value is PromiseLike<unknown> {
    return (typeof value === 'object' || typeof value === 'function') && value !== null && typeof (value as {
        then?: unknown;
    }).then === 'function';
}
export const MAX_DATA_DEPTH = 8;
export function isDataObject(value: object): boolean {
    if (Array.isArray(value))
        return true;
    if (isEngineResource(value))
        return false;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null)
        return false;
    for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(value))) {
        if (descriptor.get || descriptor.set)
            return false;
        if (typeof descriptor.value === 'function')
            return false;
    }
    return true;
}
export const HOOK_NAMES: readonly HookName[] = [...LIFECYCLE_HOOKS, ...CONTACT_HOOKS];
export function toSnakeCase(name: string): string {
    return name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}
export function toCamelCase(name: string): string {
    return name.replace(/_([a-z0-9])/g, (_, letter: string) => letter.toUpperCase());
}
const HOOK_BY_ANY_NAME: ReadonlyMap<string, HookName> = new Map(HOOK_NAMES.flatMap((hook) => [[hook, hook] as const, [toSnakeCase(hook), hook] as const]));
export function hookNameOf(name: string): HookName | null {
    return HOOK_BY_ANY_NAME.get(name) ?? null;
}
export function hookAliases(hook: HookName): readonly string[] {
    return [toSnakeCase(hook), hook];
}
export function stripLocationPrefix(message: string, file: string): string {
    const escaped = file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return message.replace(new RegExp(`^${escaped}:\\d+(?::\\d+)?:\\s*`), '');
}
