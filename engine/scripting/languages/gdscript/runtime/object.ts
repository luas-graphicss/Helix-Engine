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
