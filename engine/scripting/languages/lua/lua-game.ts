import type { LogLevel } from '@/engine/editor/session/editor-log';
import type { CompiledScript } from '../../compiler/compile-types';
import { closestName } from '../../compiler/script-compiler';
import type { ScriptOwner } from '../../runtime/runtime-context';
import { describeThrown, HelixError, isTaskCancelled } from '../../runtime/script-errors';
import type { InjectedFields } from '../../runtime/script-instance';
import { scriptFileName } from '../../script-document';
import type { ScriptLanguageId } from '../../script-languages';
import { ForeignBridge, type Encoded } from '../foreign-bridge';
import { ForeignScriptError, hookNameOf } from '../foreign-values';
import type { ForeignGame, ForeignGameHost, ForeignLocation } from '../language-engine';
import { luaScriptError } from './lua-errors';
import { LUA_KIND_KEY } from './lua-prelude';
export interface LuaHostFunctions {
    get(id: number, key: unknown): Encoded;
    set(id: number, key: unknown, value: unknown): Encoded;
    call(fnId: number, ...args: unknown[]): Encoded;
    str(id: number): string;
    len(id: number): number;
    keys(id: number): Array<string | number>;
    console(level: string, message: string): void;
    resolve(fromKey: unknown, specifier: unknown): Encoded;
    loadChunk(key: unknown, env: unknown): unknown;
}
export type PreludeResult = readonly [
    status: 'done' | 'error' | 'await',
    value: unknown,
    trace?: unknown
];
export interface LuaVm {
    toPlain(value: unknown): unknown;
    callPrelude(name: string, args: readonly unknown[]): unknown;
    loadChunk(compiled: CompiledScript, chunkName: string, env: unknown): unknown;
    callerLocation(): ForeignLocation | null;
    dispose(): void;
}
export interface LuaGameOptions {
    readonly language: ScriptLanguageId;
    readonly errorName: string;
    createVm(host: LuaHostFunctions): Promise<LuaVm>;
}
export function luaChunkName(file: string): string {
    return `=${file}`;
}
interface Continuation {
    readonly owner: ScriptOwner | null;
    readonly label: string;
}
export class LuaGame implements ForeignGame {
    readonly language: ScriptLanguageId;
    readonly bridge: ForeignBridge;
    private vm: LuaVm | null = null;
    private disposed = false;
    private depth = 0;
    private constructor(private readonly host: ForeignGameHost, private readonly options: LuaGameOptions) {
        this.language = options.language;
        this.bridge = new ForeignBridge({
            kindKey: LUA_KIND_KEY,
            indexBase: 1,
            promises: 'pending',
            invokeCallback: (id, args) => this.invokeCallback(id, args, { owner: this.host.currentOwner(), label: 'callback' }),
        });
    }
    static async create(host: ForeignGameHost, options: LuaGameOptions): Promise<LuaGame> {
        const game = new LuaGame(host, options);
        game.vm = await options.createVm(game.hostFunctions());
        game.run('setRoot', [game.bridge.encode(host.helix)]);
        return game;
    }
    private get live(): LuaVm {
        if (!this.vm || this.disposed)
            throw new HelixError(`o runtime ${this.options.errorName} desta execução já foi encerrado.`);
        return this.vm;
    }
    loadModule(compiled: CompiledScript): unknown {
        const file = scriptFileName(compiled.name, compiled.language);
        const result = this.enter(() => this.live.callPrelude('loadModule', [compiled.assetId, file])) as PreludeResult;
        return this.settle(result, { owner: this.host.currentOwner(), label: `carregar ${file}` });
    }
    instantiate(compiled: CompiledScript, inject: InjectedFields): Record<string, unknown> {
        const file = scriptFileName(compiled.name, compiled.language);
        const owner = this.host.currentOwner();
        const result = this.enter(() => this.live.callPrelude('instantiate', [compiled.assetId, file, this.bridge.encode(inject.helix), this.bridge.encode(inject.script)])) as PreludeResult;
        const value = this.settle(result, { owner, label: `carregar ${file}` });
        if (value instanceof Promise)
            throw new HelixError(`${file}: o nível superior do script não pode esperar (await); mova a espera para onStart ou helix.task.spawn.`);
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
        if (!this.vm || this.disposed)
            return;
        this.vm.callPrelude('unloadModule', [assetId]);
    }
    callerLocation(): ForeignLocation | null {
        if (!this.vm || this.disposed || this.depth === 0)
            return null;
        const location = this.vm.callerLocation();
        if (!location)
            return null;
        return { ...location, assetId: location.assetId ?? this.host.assetIdOfFile(location.file) };
    }
    dispose(): void {
        if (this.disposed)
            return;
        this.disposed = true;
        this.bridge.clear();
        try {
            this.vm?.dispose();
        }
        finally {
            this.vm = null;
        }
    }
    invokeCallback(id: number, args: readonly Encoded[], continuation: Continuation): unknown {
        if (this.disposed)
            return undefined;
        const result = this.enter(() => this.live.callPrelude('invoke', [id, ...args])) as PreludeResult;
        return this.settle(result, continuation);
    }
    private run(name: string, args: readonly unknown[]): unknown {
        return this.enter(() => this.live.callPrelude(name, args));
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
    private settle(result: PreludeResult, continuation: Continuation): unknown {
        if (!Array.isArray(result))
            throw new HelixError(`o prelúdio ${this.options.errorName} devolveu um resultado inesperado (${describeThrown(result)}).`);
        const [status, value, trace] = result;
        switch (status) {
            case 'done':
                return this.bridge.decode(value);
            case 'error':
                throw this.scriptError(value, trace);
            case 'await': {
                const token = value as number;
                const promise = this.bridge.takePendingPromise() ?? Promise.resolve(undefined);
                return new Promise<unknown>((resolve, reject) => {
                    const resume = (ok: boolean, payload: unknown) => {
                        if (this.disposed) {
                            resolve(undefined);
                            return;
                        }
                        const next = this.host.invoke(continuation.owner, continuation.label, () => this.settle(this.run('resume', [token, ok, ok ? this.bridge.encode(payload) : payload]) as PreludeResult, continuation));
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
                throw new HelixError(`estado desconhecido devolvido pelo prelúdio ${this.options.errorName}: ${String(status)}.`);
        }
    }
    private scriptError(message: unknown, trace: unknown): ForeignScriptError {
        return luaScriptError(String(message), typeof trace === 'string' ? trace : '', { assetIdOfFile: (file) => this.host.assetIdOfFile(file), errorName: this.options.errorName });
    }
    private hostFunctions(): LuaHostFunctions {
        const { bridge } = this;
        return {
            get: (id, key) => bridge.get(id, key),
            set: (id, key, value) => bridge.set(id, key, value),
            call: (fnId, ...args) => bridge.call(fnId, args),
            str: (id) => bridge.str(id),
            len: (id) => bridge.len(id),
            keys: (id) => bridge.keys(id),
            console: (level, message) => this.console(level, message),
            resolve: (fromKey, specifier) => this.resolve(fromKey, specifier),
            loadChunk: (key, env) => this.loadChunk(key, env),
        };
    }
    private console(level: string, message: string): void {
        const normalized: LogLevel = level === 'warn' || level === 'error' || level === 'debug' ? level : 'info';
        this.host.console(normalized, String(message), this.callerLocation());
    }
    private resolve(fromKey: unknown, specifier: unknown): Encoded {
        try {
            if (typeof specifier !== 'string' || specifier.length === 0)
                throw new HelixError('require() precisa do nome de um script da biblioteca, em texto.');
            const target = this.host.resolveScript(specifier);
            if (!target) {
                const suggestion = closestName(specifier, this.host.moduleNames());
                throw new HelixError(`"${specifier}" não existe na biblioteca.${suggestion ? ` Você quis dizer "${suggestion}"?` : ' Os módulos importáveis são os scripts do projeto, pelo nome.'}`);
            }
            if (target.language === this.language)
                return { [LUA_KIND_KEY]: 'module', key: target.assetId, file: scriptFileName(target.name, target.language) };
            const from = typeof fromKey === 'string' ? this.host.compiledById(fromKey) : null;
            return this.bridge.encode(this.host.requireForeign(from, target));
        }
        catch (cause) {
            return this.bridge.error(cause);
        }
    }
    private loadChunk(key: unknown, env: unknown): unknown {
        try {
            const compiled = typeof key === 'string' ? this.host.compiledById(key) : null;
            if (!compiled)
                throw new HelixError(`o script ${String(key)} não foi compilado para esta execução.`);
            if (!compiled.artifact)
                throw new HelixError(`${compiled.name} não compilou; corrija os erros antes de executá-lo.`);
            return this.live.loadChunk(compiled, luaChunkName(scriptFileName(compiled.name, compiled.language)), env);
        }
        catch (cause) {
            return this.bridge.error(cause);
        }
    }
}
