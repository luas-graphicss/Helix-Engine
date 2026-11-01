import type { CompileDiagnostic } from '../../compiler/compile-types';
import type { ScriptLanguageId } from '../../script-languages';
import { WasmGame, type WasmFlavor, type WasmModuleSource } from '../c/c-game';
import type { ForeignCompileInput, ForeignCompileOutput, ForeignGame, ForeignGameHost, ScriptLanguageEngine } from '../language-engine';
import { BuildClient } from './build-client';
import type { NativeBuildLanguage } from './build-protocol';
export interface NativeWasmLanguage {
    readonly language: NativeBuildLanguage & ScriptLanguageId;
    readonly label: string;
    readonly flavor: WasmFlavor;
    dependenciesOf(source: string): string[];
}
const EMPTY_ARTIFACT = new Uint8Array(0);
export class NativeWasmEngine implements ScriptLanguageEngine, WasmModuleSource {
    readonly label: string;
    readonly languages: readonly ScriptLanguageId[];
    private readonly modules = new WeakMap<Uint8Array, WebAssembly.Module>();
    private loading: Promise<void> | null = null;
    private toolchain: string | null = null;
    constructor(private readonly spec: NativeWasmLanguage, private readonly client: BuildClient = new BuildClient()) {
        this.label = spec.label;
        this.languages = [spec.language];
    }
    get loaded(): boolean {
        return this.toolchain !== null;
    }
    get version(): string | null {
        return this.toolchain;
    }
    load(): Promise<void> {
        if (!this.loading) {
            this.loading = this.client
                .toolchain(this.spec.language)
                .then((status) => {
                this.toolchain = status.version;
            })
                .catch((cause: unknown) => {
                this.loading = null;
                throw cause;
            });
        }
        return this.loading;
    }
    async compile(input: ForeignCompileInput): Promise<ForeignCompileOutput> {
        const dependencies = this.spec.dependenciesOf(input.source);
        const { meta, artifact } = await this.client.build({ language: this.spec.language, file: input.file, source: input.source });
        const diagnostics: CompileDiagnostic[] = [...meta.diagnostics];
        if (!meta.ok || diagnostics.some((diagnostic) => diagnostic.severity === 'error'))
            return { artifact: null, diagnostics, dependencies };
        if (!artifact || !meta.artifact)
            return { artifact: EMPTY_ARTIFACT, diagnostics, dependencies };
        if (meta.artifact.kind !== 'wasm') {
            diagnostics.push(this.error(`o serviço de build devolveu um artefato ${meta.artifact.kind} para um script ${this.label}.`));
            return { artifact: null, diagnostics, dependencies };
        }
        try {
            this.modules.set(artifact, await WebAssembly.compile(artifact));
        }
        catch (cause) {
            diagnostics.push(this.error(`o navegador recusou o módulo WebAssembly gerado por ${meta.toolchain}: ${cause instanceof Error ? cause.message : String(cause)}`));
            return { artifact: null, diagnostics, dependencies };
        }
        return { artifact, diagnostics, dependencies };
    }
    moduleFor(artifact: Uint8Array): WebAssembly.Module {
        let module = this.modules.get(artifact);
        if (!module) {
            module = new WebAssembly.Module(artifact);
            this.modules.set(artifact, module);
        }
        return module;
    }
    async createGame(host: ForeignGameHost): Promise<ForeignGame> {
        return new WasmGame(host, this, this.spec.flavor, this.spec.language);
    }
    private error(message: string): CompileDiagnostic {
        return { severity: 'error', message, line: 1, column: 1, code: 'build-service', source: this.label };
    }
}
