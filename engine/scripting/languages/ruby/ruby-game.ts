import type { LogLevel } from '@/engine/editor/session/editor-log';
import type { CompiledScript } from '../../compiler/compile-types';
import { closestName } from '../../compiler/script-compiler';
import type { ScriptOwner } from '../../runtime/runtime-context';
import { formatValue } from '../../runtime/script-console';
import { describeThrown, HelixError, isTaskCancelled } from '../../runtime/script-errors';
import type { InjectedFields } from '../../runtime/script-instance';
import { scriptFileName } from '../../script-document';
import { ForeignBridge, type Encoded } from '../foreign-bridge';
import { hookNameOf, isDataObject } from '../foreign-values';
import type { ForeignGame, ForeignGameHost, ForeignLocation } from '../language-engine';
import { isRubyFailure, rubyScriptError } from './ruby-errors';
import { RUBY_KIND_KEY } from './ruby-prelude';
export interface RubyHostFunctions {
    get(id: number, key: unknown): string;
    set(id: number, key: unknown, value: string): string;
    invoke(id: number, key: string, args: string): string;
    call(fnId: number, args: string): string;
    str(id: number): string;
    len(id: number): number;
    keys(id: number): string;
    has(id: number, key: unknown): boolean;
    console(level: string, message: string, file: unknown, line: unknown): void;
    resolve(fromKey: unknown, specifier: unknown): string;
    code(key: unknown): string;
    discard(): void;
}
export interface RubyVmBridge {
    dispatch(request: string): string;
    where(): string;
    createGame(id: string, host: RubyHostFunctions): void;
    disposeGame(id: string): void;
}
type RubyResult = readonly [
    status: 'done' | 'error' | 'await',
    value: unknown
];
interface Continuation {
    readonly owner: ScriptOwner | null;
    readonly label: string;
}
const AXES: Readonly<Record<string, number>> = { x: 0, y: 1, z: 2, w: 3 };
let nextGameId = 1;
