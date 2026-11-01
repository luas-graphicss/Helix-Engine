import type { RbValue, RubyVM } from '@ruby/wasm-wasi/dist/vm';
import type { CompileDiagnostic } from '../../compiler/compile-types';
import { HelixError } from '../../runtime/script-errors';
import type { ForeignCompileInput, ForeignCompileOutput, ForeignGame, ForeignGameHost, ScriptLanguageEngine } from '../language-engine';
import { RubyGame, type RubyHostFunctions, type RubyVmBridge } from './ruby-game';
import { RUBY_PRELUDE_FILE, rubyPreludeSource } from './ruby-prelude';
const RUBY_WASM_URL = '/vendor/ruby/ruby+stdlib.wasm';
const PRELUDE_GLOBAL = '__helixRubyPrelude';
interface CompileScriptResult {
    readonly diagnostics?: readonly Omit<CompileDiagnostic, 'source'>[];
    readonly dependencies?: readonly string[];
}
interface Prelude {
    readonly vm: RubyVM;
    readonly helix: RbValue;
}
export function rubyEngine(): ScriptLanguageEngine {
    return new RubyEngine();
}
class RubyEngine implements ScriptLanguageEngine {
    readonly label = 'Ruby';
    readonly languages = ['ruby'] as const;
    private prelude: Prelude | null = null;
    private rubyVersion: string | null = null;
    private loading: Promise<void> | null = null;
    get loaded(): boolean {
        return this.prelude !== null;
    }
    get version(): string | null {
        return this.rubyVersion;
    }
    load(): Promise<void> {
        if (!this.loading) {
            this.loading = this.boot().catch((cause: unknown) => {
                this.loading = null;
                throw cause;
            });
        }
        return this.loading;
    }
    private async boot(): Promise<void> {
        const [{ DefaultRubyVM }, module] = await Promise.all([import('@ruby/wasm-wasi/dist/browser'), fetchRubyModule()]);
        const { vm } = await DefaultRubyVM(module, { consolePrint: false });
        const scope = globalThis as unknown as Record<string, unknown>;
        scope[PRELUDE_GLOBAL] = rubyPreludeSource();
        try {
            vm.eval(`require "js"; eval(JS.global[:${PRELUDE_GLOBAL}].to_s, TOPLEVEL_BINDING, ${JSON.stringify(RUBY_PRELUDE_FILE)}, 1)`);
        }
        finally {
            delete scope[PRELUDE_GLOBAL];
        }
        const helix = vm.eval('defined?(Helix) && Helix.respond_to?(:dispatch) ? Helix : nil');
        if (helix.toString() !== 'Helix')
            throw new HelixError('o prelúdio Ruby não definiu o módulo Helix.');
        this.rubyVersion = `Ruby ${vm.eval('RUBY_VERSION').toString()}`;
        this.prelude = { vm, helix };
    }
    private ready(): Prelude {
        if (!this.prelude)
            throw new HelixError('o runtime Ruby ainda não foi carregado.');
        return this.prelude;
    }
    compile(input: ForeignCompileInput): ForeignCompileOutput {
        const { vm, helix } = this.ready();
        const raw = helix.call('compile_script', vm.wrap(input.source), vm.wrap(input.file)).toString();
        const result = JSON.parse(raw) as CompileScriptResult;
        const diagnostics = Array.isArray(result.diagnostics) ? result.diagnostics.map((diagnostic) => ({ ...diagnostic, source: this.label })) : [];
        const failed = diagnostics.some((diagnostic) => diagnostic.severity === 'error');
        return {
            artifact: failed ? null : new TextEncoder().encode(input.source),
            diagnostics,
            dependencies: Array.isArray(result.dependencies) ? result.dependencies.filter((entry): entry is string => typeof entry === 'string') : [],
        };
    }
    async createGame(host: ForeignGameHost): Promise<ForeignGame> {
        await this.load();
        return RubyGame.create(host, this.vmBridge());
    }
    private vmBridge(): RubyVmBridge {
        const { vm, helix } = this.ready();
        return {
            dispatch: (request) => helix.call('dispatch', vm.wrap(request)).toString(),
            where: () => helix.call('where').toString(),
            createGame: (id, functions: RubyHostFunctions) => {
                helix.call('create_game', vm.wrap(id), vm.wrap(functions));
            },
            disposeGame: (id) => {
                helix.call('dispose_game', vm.wrap(id));
            },
        };
    }
}
async function fetchRubyModule(): Promise<WebAssembly.Module> {
    const url = new URL(RUBY_WASM_URL, window.location.href).href;
    const response = await fetch(url);
    if (!response.ok)
        throw new HelixError(`não foi possível baixar o runtime Ruby (${response.status} em ${RUBY_WASM_URL}).`);
    const type = response.headers.get('content-type') ?? '';
    if (typeof WebAssembly.compileStreaming === 'function' && type.includes('application/wasm'))
        return WebAssembly.compileStreaming(response);
    return WebAssembly.compile(await response.arrayBuffer());
}
