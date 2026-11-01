import type { LuaEngine, LuaFactory } from 'wasmoon';
import type { CompiledScript } from '../../compiler/compile-types';
import { HelixError } from '../../runtime/script-errors';
import type { ForeignCompileInput, ForeignCompileOutput, ForeignGame, ForeignGameHost, ForeignLocation, ScriptLanguageEngine } from '../language-engine';
import { luaDependencies, luaSyntaxDiagnostic } from './lua-compile';
import { LuaGame, type LuaHostFunctions, type LuaVm } from './lua-game';
import { LUA_KIND_KEY, LUA_PRELUDE_CHUNK, luaPreludeSource } from './lua-prelude';
type WasmoonModule = typeof import('wasmoon');
const WASM_URL = '/vendor/wasmoon/glue.wasm';
const CALL_TIMEOUT_MS = 5000;
const encoder = new TextEncoder();
export function lua54Engine(): ScriptLanguageEngine {
    return new Lua54Engine();
}
class Lua54Engine implements ScriptLanguageEngine {
    readonly label = 'Lua 5.4';
    readonly languages = ['lua'] as const;
    private module: WasmoonModule | null = null;
    private factory: LuaFactory | null = null;
    private checker: LuaEngine | null = null;
    private loading: Promise<void> | null = null;
    private runtimeVersion: string | null = null;
    get loaded(): boolean {
        return this.checker !== null;
    }
    get version(): string | null {
        return this.runtimeVersion;
    }
    load(): Promise<void> {
        if (!this.loading) {
            this.loading = (async () => {
                const module = await import('wasmoon');
                const factory = new module.LuaFactory(WASM_URL);
                const checker = await factory.createEngine({ openStandardLibs: true, injectObjects: false, enableProxy: false });
                this.module = module;
                this.factory = factory;
                this.checker = checker;
                this.runtimeVersion = readVersion(checker);
            })().catch((cause: unknown) => {
                this.loading = null;
                throw cause;
            });
        }
        return this.loading;
    }
    compile(input: ForeignCompileInput): ForeignCompileOutput {
        const checker = this.checker;
        if (!checker)
            throw new HelixError('o runtime Lua ainda não foi carregado.');
        const dependencies = luaDependencies(input.source);
        try {
            checker.global.loadString(input.source, `=${input.file}`);
            checker.global.pop(1);
            return { artifact: encoder.encode(input.source), diagnostics: [], dependencies };
        }
        catch (cause) {
            const message = cause instanceof Error ? cause.message : String(cause);
            return { artifact: null, diagnostics: [luaSyntaxDiagnostic(message, input, 'Lua')], dependencies };
        }
    }
    async createGame(host: ForeignGameHost): Promise<ForeignGame> {
        await this.load();
        const module = this.module;
        const factory = this.factory;
        if (!module || !factory)
            throw new HelixError('o runtime Lua ainda não foi carregado.');
        return LuaGame.create(host, {
            language: 'lua',
            errorName: 'Erro de Lua',
            createVm: async (functions) => {
                const engine = await factory.createEngine({ openStandardLibs: true, injectObjects: false, enableProxy: false, functionTimeout: CALL_TIMEOUT_MS });
                return new Lua54Vm(module, engine, functions);
            },
        });
    }
}
type PreludeTable = Record<string, (...args: unknown[]) => unknown>;
class Lua54Vm implements LuaVm {
    private readonly prelude: PreludeTable;
    private closed = false;
    constructor(module: WasmoonModule, private readonly engine: LuaEngine, functions: LuaHostFunctions) {
        const hx = {
            get: (id: number, key: unknown) => functions.get(id, key),
            set: (id: number, key: unknown, value: unknown) => functions.set(id, key, value),
            call: (fnId: number, ...args: unknown[]) => functions.call(fnId, ...args),
            str: (id: number) => functions.str(id),
            len: (id: number) => functions.len(id),
            keys: (id: number) => functions.keys(id),
            console: (level: string, message: string) => functions.console(level, message),
            resolve: (fromKey: unknown, specifier: unknown) => functions.resolve(fromKey, specifier),
            loadChunk: module.decorateFunction((thread) => functions.loadChunk(thread.getValue(1), null), { receiveThread: true, receiveArgsQuantity: true }),
        };
        engine.global.loadString(`return function(...)${luaPreludeSource()}\nend`, `=${LUA_PRELUDE_CHUNK}`);
        const [preludeFactory] = engine.global.runSync(0) as unknown[];
        if (typeof preludeFactory !== 'function')
            throw new HelixError('o prelúdio Lua não compilou.');
        const prelude = (preludeFactory as (hx: unknown) => unknown)(hx);
        if (!prelude || typeof prelude !== 'object')
            throw new HelixError('o prelúdio Lua não devolveu a tabela de entrada.');
        this.prelude = prelude as PreludeTable;
    }
    toPlain(value: unknown): unknown {
        return value === null ? undefined : value;
    }
    callPrelude(name: string, args: readonly unknown[]): unknown {
        const fn = this.prelude[name];
        if (typeof fn !== 'function')
            throw new HelixError(`o prelúdio Lua não tem a função ${name}.`);
        return this.toPlain(fn(...args));
    }
    loadChunk(compiled: CompiledScript, chunkName: string): unknown {
        if (!compiled.artifact)
            throw new HelixError(`${compiled.name} não tem fonte verificado.`);
        return { [LUA_KIND_KEY]: 'source', source: compiled.source, name: chunkName };
    }
    callerLocation(): ForeignLocation | null {
        const where = this.prelude.where?.();
        if (!Array.isArray(where))
            return null;
        const [file, line] = where as [
            unknown,
            unknown
        ];
        if (typeof file !== 'string' || typeof line !== 'number' || file === LUA_PRELUDE_CHUNK)
            return null;
        return { file, line };
    }
    dispose(): void {
        if (this.closed)
            return;
        this.closed = true;
        this.engine.global.close();
    }
}
function readVersion(engine: LuaEngine): string {
    try {
        const version = engine.global.get('_VERSION');
        return typeof version === 'string' ? version : 'Lua 5.4';
    }
    catch {
        return 'Lua 5.4';
    }
}
