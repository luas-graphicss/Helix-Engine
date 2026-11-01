import type { LogLevel } from '@/engine/editor/session/editor-log';
import type { CompiledScript } from '../../compiler/compile-types';
import { closestName } from '../../compiler/script-compiler';
import type { ScriptOwner } from '../../runtime/runtime-context';
import { describeThrown, HelixError, isTaskCancelled } from '../../runtime/script-errors';
import type { InjectedFields } from '../../runtime/script-instance';
import { scriptFileName } from '../../script-document';
import { identifierFromName } from '../../script-templates';
import { ForeignBridge, type Encoded } from '../foreign-bridge';
import { ForeignScriptError, hookNameOf } from '../foreign-values';
import type { ForeignGame, ForeignGameHost, ForeignLocation } from '../language-engine';
import { isPhpFailure, phpScriptError, scriptFileOfPath } from './php-errors';
import { PHP_KIND_KEY, PHP_SCRIPT_DIR } from './php-prelude';
import { PhpBailout, PhpInstance, PhpRuntimeExit, type PhpHostFunctions, type PhpOutputLevel } from './php-runtime';
type PhpReply = readonly [
    'done',
    unknown
] | readonly [
    'error',
    unknown
] | readonly [
    'await',
    number,
    number
];
interface Continuation {
    readonly owner: ScriptOwner | null;
    readonly label: string;
}
export interface PhpGameOptions {
    boot(host: PhpHostFunctions, onOutput: (level: PhpOutputLevel, text: string) => void): Promise<PhpInstance>;
}
const DEAD_MESSAGE = 'o interpretador PHP desta execução encerrou depois de um erro fatal; corrija o script e reinicie o playtest.';
export class PhpGame implements ForeignGame {
    readonly language = 'php' as const;
    readonly bridge: ForeignBridge;
    private instance: PhpInstance | null = null;
    private readonly promises = new Map<number, Promise<Encoded>>();
    private nextPromise = 1;
    private readonly written = new Map<string, string>();
    private depth = 0;
    private disposed = false;
    private fatal: {
        readonly message: string;
        readonly location: ForeignLocation | null;
    } | null = null;
    private stderr = '';
    private constructor(private readonly host: ForeignGameHost) {
        this.bridge = new ForeignBridge({
            kindKey: PHP_KIND_KEY,
            indexBase: 0,
            promises: 'pending',
            invokeCallback: (id, args) => this.invokeCallback(id, args, { owner: this.host.currentOwner(), label: 'callback' }),
        });
    }
    static async create(host: ForeignGameHost, options: PhpGameOptions): Promise<PhpGame> {
        const game = new PhpGame(host);
        game.instance = await options.boot(game.hostFunctions(), (level, text) => game.output(level, text));
        game.entry('setRoot', game.json(game.bridge.encode(host.helix)));
        return game;
    }
    private get live(): PhpInstance {
        if (this.disposed || !this.instance)
            throw new HelixError('o runtime PHP desta execução já foi encerrado.');
        if (this.instance.dead)
            throw new HelixError(DEAD_MESSAGE);
        return this.instance;
    }
    loadModule(compiled: CompiledScript): unknown {
        const file = scriptFileName(compiled.name, compiled.language);
        this.sync(compiled);
        const reply = this.entry('loadModule', compiled.assetId, file, PHP_SCRIPT_DIR + file, compiled.key);
        return this.settle(reply, { owner: this.host.currentOwner(), label: `carregar ${file}` });
    }
    instantiate(compiled: CompiledScript, inject: InjectedFields): Record<string, unknown> {
        const file = scriptFileName(compiled.name, compiled.language);
        const owner = this.host.currentOwner();
        this.sync(compiled);
        const reply = this.entry('instantiate', compiled.assetId, file, PHP_SCRIPT_DIR + file, compiled.key, identifierFromName(compiled.name), this.json(this.bridge.encode(inject.helix)), this.json(this.bridge.encode(inject.script)));
        const value = this.settle(reply, { owner, label: `carregar ${file}` });
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
        if (this.disposed || !this.instance || this.instance.dead)
            return;
        this.entry('unloadModule', assetId);
    }
    callerLocation(): ForeignLocation | null {
        if (this.disposed || !this.instance || this.instance.dead || this.depth === 0)
            return null;
        const where = this.parse(this.instance.call('where'));
        if (!Array.isArray(where) || typeof where[0] !== 'string')
            return null;
        const [path, line, functionName] = where as [
            string,
            unknown,
            unknown
        ];
        const file = scriptFileOfPath(path);
        return { file, line: Number(line) || 0, assetId: this.host.assetIdOfFile(file), functionName: typeof functionName === 'string' && functionName ? functionName : null };
    }
    dispose(): void {
        if (this.disposed)
            return;
        this.disposed = true;
        this.bridge.clear();
        this.promises.clear();
        const instance = this.instance;
        this.instance = null;
        if (instance && !instance.dead) {
            try {
                instance.call('dispose');
            }
            catch {
            }
        }
    }
    invokeCallback(id: number, args: readonly Encoded[], continuation: Continuation): unknown {
        if (this.disposed)
            return undefined;
        return this.settle(this.entry('invoke', id, this.json(args)), continuation);
    }
    private entry(name: string, ...args: unknown[]): unknown {
        const instance = this.live;
        this.host.enter(this);
        this.depth++;
        try {
            return instance.call(name, ...args);
        }
        catch (cause) {
            if (cause instanceof PhpBailout)
                throw this.bailed();
            if (cause instanceof PhpRuntimeExit)
                throw this.died(cause);
            throw cause;
        }
        finally {
            this.depth--;
            this.host.exit(this);
            this.drainStderr();
        }
    }
    private takeFatal(): {
        readonly message: string;
        readonly location: ForeignLocation | null;
    } | null {
        const fatal = this.fatal;
        this.fatal = null;
        if (fatal)
            return fatal;
        const stderr = this.stderr.trim();
        this.stderr = '';
        return stderr ? { message: stderr.replace(/^PHP /, ''), location: null } : null;
    }
    private bailed(): ForeignScriptError {
        const fatal = this.takeFatal();
        if (fatal)
            return new ForeignScriptError(`${fatal.message}. O PHP cancelou esta chamada; os próximos hooks continuam.`, 'Erro fatal de PHP', fatal.location, null);
        return new ForeignScriptError('o script chamou exit(): num hook da engine isso cancela só a chamada atual; os próximos hooks continuam.', 'PHP', null, null);
    }
    private died(cause: PhpRuntimeExit): ForeignScriptError {
        const fatal = this.takeFatal();
        const message = `${cause.message}${fatal ? `: ${fatal.message}` : ''}. Os scripts PHP não rodam mais nesta execução; corrija o erro e reinicie o playtest.`;
        return new ForeignScriptError(message, 'Erro fatal de PHP', fatal?.location ?? null, null);
    }
    private settle(reply: unknown, continuation: Continuation): unknown {
        const result = this.parse(reply) as PhpReply | null;
        if (!Array.isArray(result))
            throw new HelixError(`o prelúdio PHP devolveu um resultado inesperado (${describeThrown(reply)}).`);
        switch (result[0]) {
            case 'done':
                return this.bridge.decode(result[1]);
            case 'error': {
                const failure = result[1];
                if (!isPhpFailure(failure))
                    throw new HelixError(describeThrown(failure));
                throw phpScriptError(failure, (file) => this.host.assetIdOfFile(file));
            }
            case 'await': {
                const [, token, promiseToken] = result;
                const promise = this.promises.get(promiseToken);
                this.promises.delete(promiseToken);
                if (!promise)
                    throw new HelixError('o gerador esperou por uma promessa que a engine não reconhece.');
                return new Promise<unknown>((resolve, reject) => {
                    const resume = (ok: boolean, payload: unknown) => {
                        if (this.disposed) {
                            resolve(undefined);
                            return;
                        }
                        const next = this.host.invoke(continuation.owner, continuation.label, () => this.settle(this.entry('resume', token, ok, this.json(payload)), continuation));
                        if (next instanceof Promise)
                            next.then(resolve, reject);
                        else
                            resolve(next);
                    };
                    promise.then((payload) => resume(true, payload), (cause: unknown) => {
                        if (isTaskCancelled(cause)) {
                            if (!this.disposed && this.instance && !this.instance.dead)
                                this.entry('drop', token);
                            resolve(undefined);
                            return;
                        }
                        resume(false, describeThrown(cause));
                    });
                });
            }
            default:
                throw new HelixError(`estado desconhecido devolvido pelo prelúdio PHP: ${String((result as readonly unknown[])[0])}.`);
        }
    }
    private sync(compiled: CompiledScript, seen: Set<string> = new Set()): void {
        if (seen.has(compiled.assetId))
            return;
        seen.add(compiled.assetId);
        if (!compiled.artifact)
            throw new HelixError(`${compiled.name} não compilou; corrija os erros antes de executá-lo.`);
        if (this.written.get(compiled.assetId) !== compiled.key) {
            this.live.writeFile(PHP_SCRIPT_DIR + scriptFileName(compiled.name, compiled.language), compiled.artifact);
            this.written.set(compiled.assetId, compiled.key);
        }
        for (const specifier of compiled.dependencies) {
            const dependency = this.host.resolveScript(specifier);
            if (dependency && dependency.language === this.language && dependency.artifact)
                this.sync(dependency, seen);
        }
    }
    private hostFunctions(): PhpHostFunctions {
        const { bridge } = this;
        return {
            get: (id, key) => this.json(this.stash(bridge.get(id, key))),
            set: (id, key, valueJson) => this.json(bridge.set(id, key, this.parse(valueJson))),
            call: (fnId, argsJson) => {
                const args = this.parse(argsJson);
                return this.json(this.stash(bridge.call(fnId, Array.isArray(args) ? args : [])));
            },
            str: (id) => bridge.str(id),
            len: (id) => bridge.len(id),
            keys: (id) => this.json(bridge.keys(id)),
            console: (level, message, file, line) => this.console(level, message, file, line),
            resolve: (fromKey, specifier) => this.json(this.resolve(fromKey, specifier)),
            fatal: (message, file, line) => {
                const path = typeof file === 'string' ? scriptFileOfPath(file) : null;
                const location: ForeignLocation | null = path && path !== file ? { file: path, line: Number(line) || 0, assetId: this.host.assetIdOfFile(path) } : null;
                this.fatal = { message: String(message).replace(/\s+/g, ' ').trim(), location };
            },
        };
    }
    private stash(encoded: Encoded): Encoded {
        if (!encoded || typeof encoded !== 'object' || Array.isArray(encoded) || (encoded as Record<string, unknown>)[PHP_KIND_KEY] !== 'await')
            return encoded;
        const promise = this.bridge.takePendingPromise();
        if (!promise)
            return encoded;
        const token = this.nextPromise++;
        this.promises.set(token, Promise.resolve(promise).then((value) => this.bridge.encode(value)));
        return { ...encoded, token };
    }
    private console(level: string, message: string, file: unknown, line: unknown): void {
        const normalized: LogLevel = level === 'warn' || level === 'error' || level === 'debug' ? level : 'info';
        const scriptFile = typeof file === 'string' ? scriptFileOfPath(file) : null;
        const location: ForeignLocation | null = scriptFile && scriptFile !== file ? { file: scriptFile, line: Number(line) || 0, assetId: this.host.assetIdOfFile(scriptFile) } : this.callerLocation();
        this.host.console(normalized, String(message), location);
    }
}
