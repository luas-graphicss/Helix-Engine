import type { PyodideAPI } from 'pyodide';
import type { PyCallable, PyDict } from 'pyodide/ffi';
import type { CompileDiagnostic } from '../../compiler/compile-types';
import { HelixError } from '../../runtime/script-errors';
import type { ForeignCompileInput, ForeignCompileOutput, ForeignGame, ForeignGameHost, ScriptLanguageEngine } from '../language-engine';
import { PythonGame, type PythonGameProxy, type PythonHostFunctions } from './python-game';
import { PYTHON_PRELUDE_FILE, pythonPreludeSource } from './python-prelude';
const PYODIDE_BASE_PATH = '/vendor/pyodide/';
interface PyodideModule {
    loadPyodide(options: {
        indexURL: string;
    }): Promise<PyodideAPI>;
}
interface CompileScriptResult {
    readonly artifact: Uint8Array | null | undefined;
    readonly diagnostics: readonly CompileDiagnostic[];
    readonly dependencies: readonly string[];
}
interface Prelude {
    readonly createGame: PyCallable;
    readonly compileScript: PyCallable;
}
export function pythonEngine(): ScriptLanguageEngine {
    return new PythonEngine();
}
class PythonEngine implements ScriptLanguageEngine {
    readonly label = 'Python';
    readonly languages = ['python'] as const;
    private prelude: Prelude | null = null;
    private pythonVersion: string | null = null;
    private loading: Promise<void> | null = null;
    private active: PythonGame | null = null;
    get loaded(): boolean {
        return this.prelude !== null;
    }
    get version(): string | null {
        return this.pythonVersion;
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
        const indexURL = new URL(PYODIDE_BASE_PATH, window.location.href).href;
        const module = (await import(`${indexURL}pyodide.mjs`)) as PyodideModule;
        const pyodide = await module.loadPyodide({ indexURL });
        pyodide.setStdout({ batched: (text) => this.emit('info', text) });
        pyodide.setStderr({ batched: (text) => this.emit('warn', text) });
        const namespace = pyodide.globals.get('dict')() as PyDict;
        pyodide.runPython(pythonPreludeSource(), { globals: namespace, filename: PYTHON_PRELUDE_FILE });
        const createGame = namespace.get('create_game') as PyCallable | undefined;
        const compileScript = namespace.get('compile_script') as PyCallable | undefined;
        if (!createGame || !compileScript)
            throw new HelixError('o prelúdio Python não definiu as funções de entrada.');
        this.pythonVersion = `Python ${String(pyodide.runPython('import sys; "%d.%d" % sys.version_info[:2]'))}`;
        this.prelude = { createGame, compileScript };
    }
    private ready(): Prelude {
        if (!this.prelude)
            throw new HelixError('o runtime Python ainda não foi carregado.');
        return this.prelude;
    }
    compile(input: ForeignCompileInput): ForeignCompileOutput {
        const result = this.ready().compileScript(input.source, input.file) as CompileScriptResult;
        return {
            artifact: result.artifact instanceof Uint8Array ? result.artifact : null,
            diagnostics: Array.isArray(result.diagnostics) ? result.diagnostics.map((diagnostic) => ({ ...diagnostic, source: this.label })) : [],
            dependencies: Array.isArray(result.dependencies) ? result.dependencies : [],
        };
    }
    async createGame(host: ForeignGameHost): Promise<ForeignGame> {
        await this.load();
        const prelude = this.ready();
        return PythonGame.create(host, {
            createProxy: (functions: PythonHostFunctions) => prelude.createGame(functions) as PythonGameProxy,
            activate: (game) => {
                this.active = game;
            },
        });
    }
    private emit(level: 'info' | 'warn', text: string): void {
        if (this.active) {
            this.active.report(level, text);
            return;
        }
        if (level === 'warn')
            console.warn(`[Python] ${text}`);
        else
            console.log(`[Python] ${text}`);
    }
}
