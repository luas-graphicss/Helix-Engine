import type wabtFactory from 'wabt';
import wabtPackage from 'wabt/package.json';
import type { CompileDiagnostic } from '../../compiler/compile-types';
import { closestName } from '../../compiler/script-compiler';
import type { ScriptLanguageId } from '../../script-languages';
import { WasmGame, type WasmModuleSource } from '../c/c-game';
import { hookNameOf, HOOK_NAMES } from '../foreign-values';
import type { ForeignCompileInput, ForeignCompileOutput, ForeignGame, ForeignGameHost, ScriptLanguageEngine } from '../language-engine';
import { WAT_FLAVOR } from '../native/wasm-flavors';
import { formatSignature, HELIX_ABI, HELIX_IMPORT_MODULES, sameSignature, WASI_IMPORT_MODULES, type WasmFunctionSignature, type WasmValueType } from './helix-abi';
import { readWasmModuleInfo, type WasmExportInfo, type WasmImportInfo } from './wasm-module-info';
import { locate, parseWabtFailure, WAT_SOURCE } from './wat-diagnostics';
type WabtModule = Awaited<ReturnType<typeof wabtFactory>>;
type WasmTextModule = ReturnType<WabtModule['parseWat']>;
type WabtFeatures = NonNullable<Parameters<WabtModule['parseWat']>[2]>;
const LABEL = 'WebAssembly (texto)';
const LANGUAGE: ScriptLanguageId = 'wat';
const EMPTY_ARTIFACT = new Uint8Array(0);
const REQUIRE_ANNOTATION = /\(@helix\.require\s+"((?:[^"\\]|\\.)*)"\s*\)/g;
const STRING_ESCAPE = /\\(u\{([0-9a-fA-F]+)\}|[0-9a-fA-F]{2}|[tnr"'\\])/g;
const HOOK_PARAMETERS: Readonly<Record<string, readonly WasmValueType[]>> = {
    onUpdate: ['f64'],
    onFixedUpdate: ['f64'],
    onLateUpdate: ['f64'],
    onRender: ['i32'],
    onHotReload: ['i32'],
    onCollisionBegin: ['i32', 'i32'],
    onCollisionStay: ['i32', 'i32'],
    onCollisionEnd: ['i32'],
    onTriggerEnter: ['i32', 'i32'],
    onTriggerStay: ['i32', 'i32'],
    onTriggerExit: ['i32', 'i32'],
};
function unescapeWatString(text: string): string {
    return text.replace(STRING_ESCAPE, (match, body: string, codePoint?: string) => {
        if (codePoint)
            return String.fromCodePoint(parseInt(codePoint, 16));
        switch (body) {
            case 't':
                return '\t';
            case 'n':
                return '\n';
            case 'r':
                return '\r';
            case '"':
            case "'":
            case '\\':
                return body;
            default:
                return String.fromCharCode(parseInt(body, 16));
        }
    });
}
export function watDependencies(source: string): string[] {
    const names: string[] = [];
    for (const match of source.matchAll(REQUIRE_ANNOTATION)) {
        const name = unescapeWatString(match[1]).trim();
        if (name && !names.includes(name))
            names.push(name);
    }
    return names;
}
function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
export class WatEngine implements ScriptLanguageEngine, WasmModuleSource {
    readonly label = LABEL;
    readonly languages = [LANGUAGE] as const;
    private readonly modules = new WeakMap<Uint8Array, WebAssembly.Module>();
    private wabt: WabtModule | null = null;
    private features: WabtFeatures = {};
    private loading: Promise<void> | null = null;
    get loaded(): boolean {
        return this.wabt !== null;
    }
    get version(): string | null {
        return this.wabt ? `wabt ${wabtPackage.version}` : null;
    }
    load(): Promise<void> {
        if (!this.loading) {
            this.loading = this.loadWabt().catch((cause: unknown) => {
                this.loading = null;
                throw cause;
            });
        }
        return this.loading;
    }
    private async loadWabt(): Promise<void> {
        const imported = (await import('wabt')) as unknown as {
            default?: typeof wabtFactory;
        } | typeof wabtFactory;
        const factory = typeof imported === 'function' ? imported : imported.default;
        if (typeof factory !== 'function')
            throw new Error('o pacote wabt não expõe a fábrica do assembler.');
        const wabt = await factory();
        const known = (wabt as unknown as {
            FEATURES?: Record<string, unknown>;
        }).FEATURES ?? {};
        const features: Record<string, boolean> = {};
        for (const name of Object.keys(known))
            features[name] = true;
        this.features = features as WabtFeatures;
        this.wabt = wabt;
    }
    async compile(input: ForeignCompileInput): Promise<ForeignCompileOutput> {
        const wabt = this.wabt;
        if (!wabt)
            throw new Error('o assembler WebAssembly ainda não carregou.');
        const dependencies = watDependencies(input.source);
        const diagnostics: CompileDiagnostic[] = [];
        const failed = (): ForeignCompileOutput => ({ artifact: null, diagnostics, dependencies });
        let parsed: WasmTextModule;
        try {
            parsed = wabt.parseWat(input.file, input.source, this.features);
        }
        catch (cause) {
            diagnostics.push(...parseWabtFailure(describe(cause), 'sintaxe'));
            return failed();
        }
        let binary: Uint8Array;
        try {
            parsed.resolveNames();
            parsed.validate();
            binary = parsed.toBinary({ write_debug_names: true, canonicalize_lebs: true }).buffer;
        }
        catch (cause) {
            diagnostics.push(...parseWabtFailure(describe(cause), 'validação'));
            return failed();
        }
        finally {
            parsed.destroy();
        }
        const info = readWasmModuleInfo(binary);
        this.checkImports(input.source, info.imports, diagnostics);
        this.checkExports(input.source, info.exports, diagnostics);
        if (diagnostics.some((diagnostic) => diagnostic.severity === 'error'))
            return failed();
        if (binary.length === 0)
            return { artifact: EMPTY_ARTIFACT, diagnostics, dependencies };
        try {
            this.modules.set(binary, await WebAssembly.compile(binary));
        }
        catch (cause) {
            const message = describe(cause).replace(/^(CompileError|LinkError):\s*/, '');
            diagnostics.push({ severity: 'error', message: `O navegador recusou o módulo WebAssembly: ${message} (uma proposta que ele ainda não implementa, provavelmente).`, line: 1, column: 1, code: 'wat-browser', source: WAT_SOURCE });
            return failed();
        }
        return { artifact: binary, diagnostics, dependencies };
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
        return new WasmGame(host, this, WAT_FLAVOR, LANGUAGE);
    }
    private checkImports(source: string, imports: readonly WasmImportInfo[], diagnostics: CompileDiagnostic[]): void {
        for (const entry of imports) {
            const where = locate(source, new RegExp(`\\(import\\s+"${escapeRegExp(entry.module)}"\\s+"${escapeRegExp(entry.name)}"`));
            if (WASI_IMPORT_MODULES.has(entry.module))
                continue;
            if (!HELIX_IMPORT_MODULES.has(entry.module)) {
                diagnostics.push({ severity: 'error', message: `O módulo de importação "${entry.module}" não existe: a engine serve "helix" (a API, como em helix.h) e "wasi_snapshot_preview1".`, ...where, code: 'wat-import-module', source: WAT_SOURCE });
                continue;
            }
            const expected = HELIX_ABI[entry.name];
            if (!expected) {
                const suggestion = closestName(entry.name, Object.keys(HELIX_ABI));
                diagnostics.push({ severity: 'error', message: `"helix.${entry.name}" não é uma função da engine.${suggestion ? ` Você quis dizer "${suggestion}"?` : ''} A lista completa está em helix.h (hx_*).`, ...where, code: 'wat-import-name', source: WAT_SOURCE });
                continue;
            }
            if (entry.kind !== 'function') {
                diagnostics.push({ severity: 'error', message: `"helix.${entry.name}" é uma função, não ${entry.kind === 'memory' ? 'uma memória' : entry.kind === 'table' ? 'uma tabela' : entry.kind === 'global' ? 'uma global' : 'uma tag'}: importe-a com (func …).`, ...where, code: 'wat-import-kind', source: WAT_SOURCE });
                continue;
            }
            if (entry.signature && !sameSignature(entry.signature, expected)) {
                diagnostics.push({
                    severity: 'error',
                    message: `"helix.${entry.name}" tem a assinatura ${formatSignature(expected)}, mas foi importada como ${formatSignature(entry.signature)}. O navegador não confere isso ao ligar o módulo, e os valores chegariam truncados ou trocados.`,
                    ...where,
                    code: 'wat-import-signature',
                    source: WAT_SOURCE,
                });
            }
        }
    }
    private checkExports(source: string, exports: readonly WasmExportInfo[], diagnostics: CompileDiagnostic[]): void {
        const memory = exports.find((entry) => entry.kind === 'memory');
        if (!memory) {
            const where = locate(source, /\(module\b/);
            diagnostics.push({ severity: 'error', message: 'O módulo precisa exportar a memória com o nome "memory": (memory (export "memory") 1). É por ela que o runtime lê os textos e as listas de argumentos que o script passa à engine.', ...where, code: 'wat-memory', source: WAT_SOURCE });
        }
        else if (memory.name !== 'memory') {
            const where = locate(source, new RegExp(`\\(export\\s+"${escapeRegExp(memory.name)}"`));
            diagnostics.push({ severity: 'error', message: `A memória foi exportada como "${memory.name}"; o runtime procura por "memory".`, ...where, code: 'wat-memory', source: WAT_SOURCE });
        }
        for (const entry of exports) {
            if (entry.kind !== 'function')
                continue;
            const hook = hookNameOf(entry.name);
            if (!hook) {
                const lower = entry.name.toLowerCase();
                const intended = HOOK_NAMES.find((name) => name.toLowerCase() === lower);
                if (intended) {
                    const where = locate(source, new RegExp(`\\(export\\s+"${escapeRegExp(entry.name)}"`));
                    diagnostics.push({ severity: 'warning', message: `"${entry.name}" não será chamado pelo runtime: o hook chama-se "${intended}" (maiúsculas e minúsculas contam).`, ...where, code: 'wat-hook-name', source: WAT_SOURCE });
                }
                continue;
            }
            if (!entry.signature)
                continue;
            const expected = HOOK_PARAMETERS[hook] ?? [];
            const compatible = entry.signature.params.length <= expected.length && entry.signature.params.every((type, index) => type === expected[index]);
            if (compatible)
                continue;
            const where = locate(source, new RegExp(`\\(export\\s+"${escapeRegExp(entry.name)}"`));
            const wanted: WasmFunctionSignature = { params: expected, results: [] };
            diagnostics.push({
                severity: 'warning',
                message: expected.length === 0 ? `${hook} é chamado sem argumentos; os parâmetros declarados (${formatSignature(entry.signature)}) chegarão como zero.` : `${hook} recebe ${formatSignature(wanted)} (${describeHookArguments(hook)}); a assinatura declarada ${formatSignature(entry.signature)} leria os valores errados.`,
                ...where,
                code: 'wat-hook-signature',
                source: WAT_SOURCE,
            });
        }
    }
}
function describeHookArguments(hook: string): string {
    switch (hook) {
        case 'onUpdate':
        case 'onLateUpdate':
            return 'o tempo do quadro em segundos';
        case 'onFixedUpdate':
            return 'o passo fixo em segundos';
        case 'onRender':
            return 'o handle do quadro';
        case 'onHotReload':
            return 'o handle do estado devolvido por onBeforeHotReload';
        case 'onCollisionEnd':
            return 'o handle do outro ator';
        default:
            return 'os handles do outro ator e do contato';
    }
}
function describe(cause: unknown): string {
    return cause instanceof Error ? cause.message : String(cause);
}
let shared: WatEngine | null = null;
export function watEngine(): ScriptLanguageEngine {
    if (!shared)
        shared = new WatEngine();
    return shared;
}
