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
export class RubyGame implements ForeignGame {
    readonly language = 'ruby' as const;
    readonly bridge: ForeignBridge;
    private readonly id = String(nextGameId++);
    private readonly taskSpawn: unknown;
    private disposed = false;
    private depth = 0;
    private constructor(private readonly host: ForeignGameHost, private readonly vm: RubyVmBridge) {
        this.bridge = new ForeignBridge({
            kindKey: RUBY_KIND_KEY,
            indexBase: 0,
            promises: 'pending',
            invokeCallback: (id, args) => this.invokeCallback(id, args, { owner: this.host.currentOwner(), label: 'callback' }),
        });
        const task = (host.helix as {
            task?: {
                spawn?: unknown;
            };
        }).task;
        this.taskSpawn = task && typeof task === 'object' ? task.spawn : undefined;
    }
    static create(host: ForeignGameHost, vm: RubyVmBridge): RubyGame {
        const game = new RubyGame(host, vm);
        vm.createGame(game.id, game.hostFunctions());
        game.settle(game.run('set_root', [game.bridge.encode(host.helix)]), { owner: null, label: 'helix' });
        return game;
    }
    loadModule(compiled: CompiledScript): unknown {
        const file = scriptFileName(compiled.name, compiled.language);
        return this.settle(this.run('load_module', [compiled.assetId, file]), { owner: this.host.currentOwner(), label: `carregar ${file}` });
    }
    instantiate(compiled: CompiledScript, inject: InjectedFields): Record<string, unknown> {
        const file = scriptFileName(compiled.name, compiled.language);
        const owner = this.host.currentOwner();
        const value = this.settle(this.run('instantiate', [compiled.assetId, file, this.bridge.encode(inject.helix), this.bridge.encode(inject.script)]), { owner, label: `carregar ${file}` });
        const hooks: Record<string, unknown> = {};
        if (value && typeof value === 'object') {
            for (const [name, id] of Object.entries(value as Record<string, unknown>)) {
                const hook = hookNameOf(name);
                if (!hook || typeof id !== 'number')
                    continue;
                hooks[hook] = (...args: unknown[]) => this.invokeCallback(id, args.map((arg) => this.bridge.encode(arg)), { owner: this.host.currentOwner() ?? owner, label: hook });
            }
        }
        return hooks;
    }
    unloadModule(assetId: string): void {
        if (this.disposed)
            return;
        this.run('unload_module', [assetId]);
    }
    callerLocation(): ForeignLocation | null {
        if (this.disposed || this.depth === 0)
            return null;
        let where: unknown;
        try {
            const raw = this.vm.where();
            where = raw ? JSON.parse(raw) : null;
        }
        catch {
            return null;
        }
        if (!Array.isArray(where) || typeof where[0] !== 'string')
            return null;
        const [file, line, functionName] = where as [
            string,
            unknown,
            unknown
        ];
        return { file, line: Number(line) || 0, assetId: this.host.assetIdOfFile(file), functionName: typeof functionName === 'string' && functionName ? functionName : null };
    }
    dispose(): void {
        if (this.disposed)
            return;
        this.disposed = true;
        this.bridge.clear();
        try {
            this.vm.disposeGame(this.id);
        }
        catch {
        }
    }
    invokeCallback(id: number, args: readonly Encoded[], continuation: Continuation): unknown {
        if (this.disposed)
            return undefined;
        return this.settle(this.run('invoke', [id, args]), continuation);
    }
    private run(op: string, args: readonly unknown[]): RubyResult {
        if (this.disposed)
            throw new HelixError('o runtime Ruby desta execução já foi encerrado.');
        return this.enter(() => {
            const raw = this.vm.dispatch(JSON.stringify({ id: this.id, op, args }));
            const result = JSON.parse(raw) as unknown;
            if (!Array.isArray(result))
                throw new HelixError(`o prelúdio Ruby devolveu um resultado inesperado (${describeThrown(result)}).`);
            return result as unknown as RubyResult;
        });
    }
    private enter<T>(fn: () => T): T {
        this.depth++;
        this.host.enter(this);
        try {
            return fn();
        }
        finally {
            this.host.exit(this);
            this.depth--;
        }
    }
    private settle(result: RubyResult, continuation: Continuation): unknown {
        const [status, value] = result;
        switch (status) {
            case 'done':
                return this.bridge.decode(value);
            case 'error':
                if (!isRubyFailure(value))
                    throw new HelixError(describeThrown(value));
                throw rubyScriptError(value, (file) => this.host.assetIdOfFile(file));
            case 'await': {
                const token = Number(value);
                const promise = this.bridge.takePendingPromise() ?? Promise.resolve(undefined);
                return new Promise<unknown>((resolve, reject) => {
                    const resume = (ok: boolean, payload: unknown) => {
                        if (this.disposed) {
                            resolve(undefined);
                            return;
                        }
                        const next = this.host.invoke(continuation.owner, continuation.label, () => this.settle(this.run('resume', [token, ok, ok ? this.bridge.encode(payload) : payload]), continuation));
                        if (next instanceof Promise)
                            next.then(resolve, reject);
                        else
                            resolve(next);
                    };
                    promise.then((payload) => resume(true, payload), (cause: unknown) => {
                        if (isTaskCancelled(cause)) {
                            if (!this.disposed)
                                this.run('drop', [token]);
                            resolve(undefined);
                            return;
                        }
                        resume(false, describeThrown(cause));
                    });
                });
            }
            default:
                throw new HelixError(`estado desconhecido devolvido pelo prelúdio Ruby: ${String(status)}.`);
        }
    }
    private hostFunctions(): RubyHostFunctions {
        const { bridge } = this;
        return {
            get: (id, key) => this.envelope(() => bridge.get(id, this.axisKey(id, key))),
            set: (id, key, value) => this.envelope(() => bridge.set(id, this.axisKey(id, key), parseJson(value))),
            invoke: (id, key, args) => this.envelope(() => this.invoke(id, String(key), args)),
            call: (fnId, args) => this.envelope(() => bridge.call(fnId, asArray(parseJson(args)))),
            str: (id) => bridge.str(id),
            len: (id) => bridge.len(id),
            keys: (id) => JSON.stringify(bridge.keys(id)),
            has: (id, key) => bridge.has(id, String(key)),
            console: (level, message, file, line) => this.console(level, message, file, line),
            resolve: (fromKey, specifier) => this.envelope(() => this.resolve(fromKey, specifier)),
            code: (key) => this.code(key),
            discard: () => {
                bridge.takePendingPromise()?.then(noop, noop);
            },
        };
    }
    private envelope(produce: () => Encoded): string {
        let value: Encoded;
        try {
            value = produce();
        }
        catch (cause) {
            value = this.bridge.error(cause);
        }
        try {
            return JSON.stringify({ v: value }) ?? '{}';
        }
        catch (cause) {
            return JSON.stringify({ v: this.bridge.error(cause) });
        }
    }
    private axisKey(id: number, key: unknown): unknown {
        if (typeof key !== 'string' || !(key in AXES))
            return key;
        const target = this.bridge.objectOf(id);
        return ArrayBuffer.isView(target) && AXES[key] < (target as unknown as ArrayLike<number>).length ? AXES[key] : key;
    }
    private invoke(id: number, key: string, argsJson: string): Encoded {
        const target = this.bridge.objectOf(id);
        const args = asArray(parseJson(argsJson));
        if (target instanceof Map || target instanceof Set) {
            if (args.length === 0)
                return this.bridge.get(id, key);
            throw new HelixError(`${key} não é um método de ${formatValue(target)}.`);
        }
        const member = (target as Record<string, unknown>)[key];
        if (typeof member === 'function') {
            const decoded = args.map((arg) => this.bridge.decode(arg));
            if (member === this.taskSpawn && typeof decoded[0] === 'function')
                decoded[0] = this.deferTask(decoded[0] as () => unknown);
            return this.bridge.encode((member as (...params: unknown[]) => unknown).apply(target, decoded));
        }
        const exists = key in Object(target);
        if (exists && args.length === 0)
            return this.bridge.get(id, this.axisKey(id, key));
        if (!exists && args.length === 0 && (isDataObject(target) || ArrayBuffer.isView(target)))
            return this.bridge.get(id, this.axisKey(id, key));
        const suggestion = exists ? null : closestName(key, this.bridge.keys(id).map(String));
        const hint = suggestion ? ` Você quis dizer "${suggestion}"?` : '';
        throw new HelixError(exists ? `${key} não é um método de ${formatValue(target)} (é um valor; leia-o sem argumentos).` : `${key} não existe em ${formatValue(target)}.${hint}`);
    }
    private deferTask(body: () => unknown): () => Promise<unknown> {
        const owner = this.host.currentOwner();
        return () => new Promise<unknown>((resolve, reject) => {
            queueMicrotask(() => {
                if (this.disposed) {
                    resolve(undefined);
                    return;
                }
                try {
                    const result = this.host.invoke(owner, 'helix.task.spawn', body);
                    if (result instanceof Promise)
                        result.then(resolve, reject);
                    else
                        resolve(result);
                }
                catch (cause) {
                    reject(cause instanceof Error ? cause : new HelixError(describeThrown(cause)));
                }
            });
        });
    }
    private console(level: string, message: string, file: unknown, line: unknown): void {
        if (this.disposed)
            return;
        const normalized: LogLevel = level === 'warn' || level === 'error' || level === 'debug' ? level : 'info';
        const location: ForeignLocation | null = typeof file === 'string' && file ? { file, line: Number(line) || 0, assetId: this.host.assetIdOfFile(file) } : this.callerLocation();
        this.host.console(normalized, String(message), location);
    }
    private resolve(fromKey: unknown, specifier: unknown): Encoded {
        if (typeof specifier !== 'string' || specifier.length === 0)
            throw new HelixError('require precisa do nome de um script da biblioteca, em texto.');
        const target = this.host.resolveScript(specifier);
        if (!target) {
            const suggestion = closestName(specifier, this.host.moduleNames());
            const hint = suggestion ? ` Você quis dizer "${suggestion}"?` : ' Os módulos importáveis são os scripts do projeto, pelo nome, e a biblioteca padrão do Ruby.';
            return { [RUBY_KIND_KEY]: 'missing', message: `"${specifier}" não existe na biblioteca.${hint}` };
        }
        if (target.language === this.language)
            return { [RUBY_KIND_KEY]: 'module', key: target.assetId, file: scriptFileName(target.name, target.language) };
        const from = typeof fromKey === 'string' ? this.host.compiledById(fromKey) : null;
        return this.bridge.encode(this.host.requireForeign(from, target));
    }
    private code(key: unknown): string {
        try {
            const compiled = typeof key === 'string' ? this.host.compiledById(key) : null;
            if (!compiled)
                throw new HelixError(`o script ${String(key)} não foi compilado para esta execução.`);
            if (!compiled.artifact)
                throw new HelixError(`${compiled.name} não compilou; corrija os erros antes de executá-lo.`);
            return JSON.stringify({ v: new TextDecoder().decode(compiled.artifact) });
        }
        catch (cause) {
            return JSON.stringify({ e: describeThrown(cause) });
        }
    }
}
function parseJson(text: unknown): unknown {
    if (typeof text !== 'string' || text.length === 0)
        return undefined;
    return JSON.parse(text) as unknown;
}
function asArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
}
function noop(): void { }
