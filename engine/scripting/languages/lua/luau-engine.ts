import type { Lua, LuaCallbackArgument, LuaCallbackReturn, LuaTable, LuaVector } from '@luau-rs/luau';
import type { CompileDiagnostic, CompiledScript } from '../../compiler/compile-types';
import { HelixError } from '../../runtime/script-errors';
import { MAX_DATA_DEPTH } from '../foreign-values';
import type { ForeignCompileInput, ForeignCompileOutput, ForeignGame, ForeignGameHost, ForeignLocation, ScriptLanguageEngine } from '../language-engine';
import { luaDependencies, luaSyntaxDiagnostic } from './lua-compile';
import { LuaGame, type LuaHostFunctions, type LuaVm } from './lua-game';
import { LUA_PRELUDE_CHUNK, luaPreludeSource } from './lua-prelude';
type LuauModule = typeof import('@luau-rs/luau');
const GAME_MEMORY_LIMIT = 256 * 1024 * 1024;
const COMPILER_OPTIONS = { optimizationLevel: 1, debugLevel: 2 } as const;
const SYNTAX_PREFIX = /^syntax error:\s*/;
export function luauEngine(): ScriptLanguageEngine {
    return new LuauEngine();
}
class LuauEngine implements ScriptLanguageEngine {
    readonly label = 'Luau';
    readonly languages = ['luau'] as const;
    private module: LuauModule | null = null;
    private compiler: Lua | null = null;
    private loading: Promise<void> | null = null;
    get loaded(): boolean {
        return this.compiler !== null;
    }
    get version(): string | null {
        return this.compiler ? `Luau ${this.compiler.version}` : null;
    }
    load(): Promise<void> {
        if (!this.loading) {
            this.loading = (async () => {
                const module = await import('@luau-rs/luau');
                this.compiler = await module.Lua.create({ sandbox: true, libraries: 'none' });
                this.module = module;
            })().catch((cause: unknown) => {
                this.loading = null;
                throw cause;
            });
        }
        return this.loading;
    }
    compile(input: ForeignCompileInput): ForeignCompileOutput {
        const compiler = this.compiler;
        if (!compiler)
            throw new HelixError('o runtime Luau ainda não foi carregado.');
        const dependencies = luaDependencies(input.source);
        try {
            const artifact = compiler.compile(input.source, COMPILER_OPTIONS);
            return { artifact, diagnostics: [], dependencies };
        }
        catch {
            return { artifact: null, diagnostics: [this.syntaxDiagnostic(compiler, input)], dependencies };
        }
    }
    private syntaxDiagnostic(compiler: Lua, input: ForeignCompileInput): CompileDiagnostic {
        let message = 'erro de sintaxe';
        try {
            compiler.load(input.source, { name: `=${input.file}` });
        }
        catch (cause) {
            message = (cause instanceof Error ? cause.message : String(cause)).replace(SYNTAX_PREFIX, '');
        }
        return luaSyntaxDiagnostic(message, input, 'Luau');
    }
    async createGame(host: ForeignGameHost): Promise<ForeignGame> {
        await this.load();
        const module = this.module;
        if (!module)
            throw new HelixError('o runtime Luau ainda não foi carregado.');
        return LuaGame.create(host, {
            language: 'luau',
            errorName: 'Erro de Luau',
            createVm: async (functions) => {
                const lua = await module.Lua.create({ sandbox: false, libraries: 'all', memory: { limitBytes: GAME_MEMORY_LIMIT } });
                return new LuauVm(module, lua, functions);
            },
        });
    }
}
class LuauVm implements LuaVm {
    private readonly prelude: LuaTable;
    private released = false;
    constructor(private readonly module: LuauModule, private readonly lua: Lua, functions: LuaHostFunctions) {
        const hx = lua.createTable();
        const bind = (name: keyof LuaHostFunctions, fn: (...args: LuaCallbackArgument[]) => unknown) => {
            hx.set(name, lua.createFunction((...args: LuaCallbackArgument[]) => fn(...args) as LuaCallbackReturn));
        };
        bind('get', (id, key) => functions.get(Number(id), this.toPlain(key)));
        bind('set', (id, key, value) => functions.set(Number(id), this.toPlain(key), this.toPlain(value)));
        bind('call', (fnId, ...args) => functions.call(Number(fnId), ...args.map((arg) => this.toPlain(arg))));
        bind('str', (id) => functions.str(Number(id)));
        bind('len', (id) => functions.len(Number(id)));
        bind('keys', (id) => functions.keys(Number(id)));
        bind('console', (level, message) => functions.console(String(level), String(message)));
        bind('resolve', (fromKey, specifier) => functions.resolve(this.toPlain(fromKey), this.toPlain(specifier)));
        bind('loadChunk', (key, env) => functions.loadChunk(this.toPlain(key), env));
        const [prelude] = lua.execute(luaPreludeSource(), { name: `=${LUA_PRELUDE_CHUNK}` }, hx);
        if (!(prelude instanceof module.LuaTable))
            throw new HelixError('o prelúdio Luau não devolveu a tabela de entrada.');
        this.prelude = prelude;
    }
    toPlain(value: unknown): unknown {
        return this.plain(value, 0);
    }
    private plain(value: unknown, depth: number): unknown {
        const { LuaTable, LuaVector, LuaFunction } = this.module;
        if (value === null)
            return undefined;
        if (typeof value === 'bigint')
            return Number(value);
        if (typeof value !== 'object')
            return value;
        if (value instanceof LuaVector)
            return vectorToData(value);
        if (value instanceof LuaTable)
            return depth > MAX_DATA_DEPTH + 1 ? undefined : this.tableToPlain(value, depth);
        if (value instanceof LuaFunction)
            return (...args: unknown[]) => this.toPlain(value.call(...(args as never[]))[0]);
        return undefined;
    }
    private tableToPlain(table: LuaTable, depth: number): unknown {
        const entries = table.entries();
        if (entries.length === 0)
            return [];
        let sequential = true;
        for (let index = 0; index < entries.length; index++) {
            if (entries[index][0] !== index + 1) {
                sequential = false;
                break;
            }
        }
        if (sequential)
            return entries.map(([, entry]) => this.plain(entry, depth + 1));
        const out: Record<string, unknown> = {};
        for (const [key, entry] of entries) {
            if (typeof key !== 'string' && typeof key !== 'number')
                continue;
            const plain = this.plain(entry, depth + 1);
            if (plain !== undefined)
                out[String(key)] = plain;
        }
        return out;
    }
    callPrelude(name: string, args: readonly unknown[]): unknown {
        const [result] = this.prelude.callFunction(name, ...(args as never[]));
        return this.toPlain(result);
    }
    loadChunk(compiled: CompiledScript, chunkName: string, env: unknown): unknown {
        if (!compiled.artifact)
            throw new HelixError(`${compiled.name} não tem bytecode compilado.`);
        const environment = env instanceof this.module.LuaTable ? env : null;
        return this.lua.loadBytecode(compiled.artifact, { name: chunkName, environment });
    }
    callerLocation(): ForeignLocation | null {
        for (let level = 0; level < 64; level++) {
            const frame = this.lua.inspectStack(level);
            if (!frame)
                return null;
            const file = frame.shortSource;
            if (frame.what !== 'Lua' || !file || file === LUA_PRELUDE_CHUNK || file === '[C]')
                continue;
            return { file, line: frame.currentLine ?? 0, functionName: frame.name ?? null };
        }
        return null;
    }
    dispose(): void {
        if (this.released)
            return;
        this.released = true;
        releaseState(this.lua);
    }
}
function vectorToData(vector: LuaVector): {
    x: number;
    y: number;
    z: number;
} {
    return { x: vector.x, y: vector.y, z: vector.z };
}
function releaseState(lua: Lua): void {
    const release = Object.getOwnPropertySymbols(Object.getPrototypeOf(lua)).find((symbol) => symbol.description === 'Lua.release');
    const method = release ? (lua as unknown as Record<symbol, unknown>)[release] : undefined;
    if (typeof method === 'function') {
        try {
            method.call(lua);
            return;
        }
        catch {
        }
    }
    try {
        lua.gcCollect();
    }
    catch {
    }
}
