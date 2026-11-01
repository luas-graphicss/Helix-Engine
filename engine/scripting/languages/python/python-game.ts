import type { LogLevel } from '@/engine/editor/session/editor-log';
import type { CompiledScript } from '../../compiler/compile-types';
import { closestName } from '../../compiler/script-compiler';
import type { ScriptOwner } from '../../runtime/runtime-context';
import { describeThrown, HelixError, isTaskCancelled } from '../../runtime/script-errors';
import type { InjectedFields } from '../../runtime/script-instance';
import { scriptFileName } from '../../script-document';
import { ForeignBridge, type Encoded } from '../foreign-bridge';
import { hookNameOf } from '../foreign-values';
import type { ForeignGame, ForeignGameHost, ForeignLocation } from '../language-engine';
import { isPythonFailure, pythonScriptError, type PythonFailure } from './python-errors';
import { PYTHON_KIND_KEY } from './python-prelude';
export interface PythonHostFunctions {
    get(id: number, key: unknown): Encoded;
    set(id: number, key: unknown, value: unknown): Encoded;
    call(fnId: number, ...args: unknown[]): Encoded;
    str(id: number): string;
    len(id: number): number;
    keys(id: number): Array<string | number>;
    console(level: string, message: string, file?: unknown, line?: unknown): void;
    resolve(fromKey: unknown, specifier: unknown): Encoded;
    code(key: unknown): Uint8Array | Encoded;
}
export type PythonPreludeResult = readonly [
    'done',
    unknown
] | readonly [
    'error',
    PythonFailure
] | readonly [
    'await',
    number,
    PromiseLike<unknown>
];
export interface PythonGameProxy {
    set_root(helix: Encoded): void;
    instantiate(key: string, file: string, helix: Encoded, script: Encoded): PythonPreludeResult;
    load_module(key: string, file: string): PythonPreludeResult;
    unload_module(key: string): void;
    invoke(id: number, ...args: Encoded[]): PythonPreludeResult;
    resume(token: number, ok: boolean, value: unknown): PythonPreludeResult;
    drop(token: number): void;
    where(): readonly [
        string,
        number,
        string
    ] | undefined;
    dispose(): void;
    destroy(): void;
}
export interface PythonGameOptions {
    createProxy(host: PythonHostFunctions): PythonGameProxy;
    activate(game: PythonGame | null): void;
}
interface Continuation {
    readonly owner: ScriptOwner | null;
    readonly label: string;
}
export class PythonGame implements ForeignGame {
    readonly language = 'python' as const;
    readonly bridge: ForeignBridge;
    private proxy: PythonGameProxy | null = null;
    private disposed = false;
    private depth = 0;
    private constructor(private readonly host: ForeignGameHost, private readonly options: PythonGameOptions) {
        this.bridge = new ForeignBridge({
            kindKey: PYTHON_KIND_KEY,
            indexBase: 0,
            promises: 'inline',
            invokeCallback: (id, args) => this.invokeCallback(id, args, { owner: this.host.currentOwner(), label: 'callback' }),
        });
    }
    static create(host: ForeignGameHost, options: PythonGameOptions): PythonGame {
        const game = new PythonGame(host, options);
        game.proxy = options.createProxy(game.hostFunctions());
        game.enter(() => game.live.set_root(game.bridge.encode(host.helix)));
        return game;
    }
    private get live(): PythonGameProxy {
        if (!this.proxy || this.disposed)
            throw new HelixError('o runtime Python desta execução já foi encerrado.');
        return this.proxy;
    }
    loadModule(compiled: CompiledScript): unknown {
        const file = scriptFileName(compiled.name, compiled.language);
        const result = this.enter(() => this.live.load_module(compiled.assetId, file));
        return this.settle(result, { owner: this.host.currentOwner(), label: `carregar ${file}` });
    }
    instantiate(compiled: CompiledScript, inject: InjectedFields): Record<string, unknown> {
        const file = scriptFileName(compiled.name, compiled.language);
        const owner = this.host.currentOwner();
        const result = this.enter(() => this.live.instantiate(compiled.assetId, file, this.bridge.encode(inject.helix), this.bridge.encode(inject.script)));
        const value = this.settle(result, { owner, label: `carregar ${file}` });
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
        if (!this.proxy || this.disposed)
            return;
        this.proxy.unload_module(assetId);
    }
    callerLocation(): ForeignLocation | null {
        if (!this.proxy || this.disposed || this.depth === 0)
            return null;
        const where = this.proxy.where();
        if (!where || typeof where[0] !== 'string')
            return null;
        const [file, line, functionName] = where;
        return { file, line: Number(line) || 0, assetId: this.host.assetIdOfFile(file), functionName: functionName && functionName !== '<module>' ? functionName : null };
    }
    dispose(): void {
        if (this.disposed)
            return;
        this.disposed = true;
        this.bridge.clear();
        const proxy = this.proxy;
        this.proxy = null;
        if (!proxy)
            return;
        try {
            proxy.dispose();
        }
        finally {
            proxy.destroy();
        }
    }
    report(level: LogLevel, message: string): void {
        if (this.disposed)
            return;
        this.host.console(level, message, null);
    }
    invokeCallback(id: number, args: readonly Encoded[], continuation: Continuation): unknown {
        if (this.disposed)
            return undefined;
        const result = this.enter(() => this.live.invoke(id, ...args));
        return this.settle(result, continuation);
    }
    private enter<T>(fn: () => T): T {
        if (this.depth++ === 0)
            this.options.activate(this);
        this.host.enter(this);
        try {
            return fn();
        }
        finally {
            this.host.exit(this);
            if (--this.depth === 0)
                this.options.activate(null);
        }
    }
    private settle(result: PythonPreludeResult, continuation: Continuation): unknown {
        if (!Array.isArray(result))
            throw new HelixError(`o prelúdio Python devolveu um resultado inesperado (${describeThrown(result)}).`);
        switch (result[0]) {
            case 'done':
                return this.bridge.decode(result[1]);
            case 'error': {
                const failure = result[1];
                if (!isPythonFailure(failure))
                    throw new HelixError(describeThrown(failure));
                throw pythonScriptError(failure, (file) => this.host.assetIdOfFile(file));
            }
            case 'await': {
                const [, token, promise] = result;
                return new Promise<unknown>((resolve, reject) => {
                    const resume = (ok: boolean, payload: unknown) => {
                        if (this.disposed) {
                            resolve(undefined);
                            return;
                        }
                        const next = this.host.invoke(continuation.owner, continuation.label, () => this.settle(this.enter(() => this.live.resume(token, ok, payload)), continuation));
                        if (next instanceof Promise)
                            next.then(resolve, reject);
                        else
                            resolve(next);
                    };
                    Promise.resolve(promise).then((payload) => resume(true, payload), (cause: unknown) => {
                        if (isTaskCancelled(cause)) {
                            if (!this.disposed)
                                this.enter(() => this.live.drop(token));
                            resolve(undefined);
                            return;
                        }
                        resume(false, describeThrown(cause));
                    });
                });
            }
            default:
                throw new HelixError(`estado desconhecido devolvido pelo prelúdio Python: ${String((result as readonly unknown[])[0])}.`);
        }
    }
    private hostFunctions(): PythonHostFunctions {
        const { bridge } = this;
        return {
            get: (id, key) => bridge.get(id, key),
            set: (id, key, value) => bridge.set(id, key, value),
            call: (fnId, ...args) => bridge.call(fnId, args),
            str: (id) => bridge.str(id),
            len: (id) => bridge.len(id),
            keys: (id) => bridge.keys(id),
            console: (level, message, file, line) => this.console(level, message, file, line),
            resolve: (fromKey, specifier) => this.resolve(fromKey, specifier),
            code: (key) => this.code(key),
        };
    }
    private console(level: string, message: string, file: unknown, line: unknown): void {
        const normalized: LogLevel = level === 'warn' || level === 'error' || level === 'debug' ? level : 'info';
        const location: ForeignLocation | null = typeof file === 'string' ? { file, line: Number(line) || 0, assetId: this.host.assetIdOfFile(file) } : this.callerLocation();
        this.host.console(normalized, String(message), location);
    }
    private resolve(fromKey: unknown, specifier: unknown): Encoded {
        try {
            if (typeof specifier !== 'string' || specifier.length === 0)
                throw new HelixError('import precisa do nome de um script da biblioteca.');
            const target = this.host.resolveScript(specifier);
            if (!target) {
                const suggestion = closestName(specifier, this.host.moduleNames());
                const hint = suggestion ? ` Você quis dizer "${suggestion}"?` : ' Os módulos importáveis são os scripts do projeto, pelo nome, e a biblioteca padrão do Python.';
                return { [PYTHON_KIND_KEY]: 'missing', message: `"${specifier}" não existe na biblioteca.${hint}` };
            }
            if (target.language === this.language)
                return { [PYTHON_KIND_KEY]: 'module', key: target.assetId, file: scriptFileName(target.name, target.language) };
            const from = typeof fromKey === 'string' ? this.host.compiledById(fromKey) : null;
            return this.bridge.encode(this.host.requireForeign(from, target));
        }
        catch (cause) {
            return this.bridge.error(cause);
        }
    }
    private code(key: unknown): Uint8Array | Encoded {
        try {
            const compiled = typeof key === 'string' ? this.host.compiledById(key) : null;
            if (!compiled)
                throw new HelixError(`o script ${String(key)} não foi compilado para esta execução.`);
            if (!compiled.artifact)
                throw new HelixError(`${compiled.name} não compilou; corrija os erros antes de executá-lo.`);
            return compiled.artifact;
        }
        catch (cause) {
            return this.bridge.error(cause);
        }
    }
}
