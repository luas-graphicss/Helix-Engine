import { HOOK_NAMES } from '../foreign-values';
import type { ForeignCompileInput, ForeignCompileOutput, ForeignGame, ForeignGameHost, ForeignSibling, ScriptLanguageEngine } from '../language-engine';
import { parseClangOutput } from './c-diagnostics';
import { CGame } from './c-game';
import { ClangClient, type NativeCompiler } from './clang-client';
import { HELIX_H } from './helix-h';
import { HELIX_HPP } from './helix-hpp';
const TOOLCHAIN_PATH = '/vendor/clang/';
const HEADER_FILE = /\.(h|hpp|hh|hxx)$/i;
const CPP_FILE = /\.(cpp|cc|cxx|hpp|hh|hxx)$/i;
const QUOTED_INCLUDE = /^[ \t]*#[ \t]*include[ \t]*"([^"\n]+)"/gm;
const EMPTY_ARTIFACT = new Uint8Array(0);
const ENGINE_HEADERS: ReadonlySet<string> = new Set(['helix.h', 'helix.hpp']);
let shared: CEngine | null = null;
export function cEngine(compiler?: NativeCompiler): ScriptLanguageEngine {
    if (!shared)
        shared = new CEngine(compiler ?? new ClangClient(new URL(TOOLCHAIN_PATH, window.location.href).href));
    return shared;
}
export function createCEngine(compiler: NativeCompiler): CEngine {
    return new CEngine(compiler);
}
export class CEngine implements ScriptLanguageEngine {
    readonly label = 'C/C++';
    readonly languages = ['c', 'cpp'] as const;
    private readonly modules = new WeakMap<Uint8Array, WebAssembly.Module>();
    private loading: Promise<void> | null = null;
    private isLoaded = false;
    constructor(private readonly compiler: NativeCompiler) { }
    get loaded(): boolean {
        return this.isLoaded;
    }
    get version(): string | null {
        return this.isLoaded ? this.compiler.version : null;
    }
    load(): Promise<void> {
        if (!this.loading) {
            this.loading = this.compiler
                .load()
                .then(() => {
                this.isLoaded = true;
            })
                .catch((cause: unknown) => {
                this.loading = null;
                throw cause;
            });
        }
        return this.loading;
    }
    async compile(input: ForeignCompileInput): Promise<ForeignCompileOutput> {
        const language = languageOfFile(input.file);
        const siblings = (input.siblings ?? []).filter((sibling) => sibling.file !== input.file);
        const sources: Record<string, string> = {};
        for (const sibling of siblings) {
            sources[sibling.file] = sibling.source;
            for (const alias of headerAliases(sibling.file))
                if (!(alias in sources))
                    sources[alias] = sibling.source;
        }
        sources[input.file] = input.source;
        const dependencies = includeClosure(input.file, sources, siblings);
        const syntaxOnly = HEADER_FILE.test(input.file);
        const result = await this.compiler.compile({
            file: input.file,
            language,
            sources,
            headers: { 'helix.h': HELIX_H, 'helix.hpp': HELIX_HPP },
            exports: HOOK_NAMES,
            syntaxOnly,
        });
        const diagnostics = parseClangOutput(result.output, { file: input.file, source: language === 'cpp' ? 'C++' : 'C', exitCode: result.exitCode });
        const failed = result.exitCode !== 0 || diagnostics.some((diagnostic) => diagnostic.severity === 'error');
        if (failed)
            return { artifact: null, diagnostics, dependencies };
        if (!result.wasm)
            return { artifact: EMPTY_ARTIFACT, diagnostics, dependencies };
        const module = await WebAssembly.compile(result.wasm);
        this.modules.set(result.wasm, module);
        return { artifact: result.wasm, diagnostics, dependencies };
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
        return new CGame(host, this);
    }
}
export function languageOfFile(file: string): 'c' | 'cpp' {
    return CPP_FILE.test(file) ? 'cpp' : 'c';
}
function headerAliases(file: string): string[] {
    const stem = file.replace(/\.[^.]+$/, '');
    return languageOfFile(file) === 'cpp' ? [`${stem}.hpp`, `${stem}.hh`, `${stem}.h`] : [`${stem}.h`];
}
function includeClosure(file: string, sources: Readonly<Record<string, string>>, siblings: readonly ForeignSibling[]): string[] {
    const byFile = new Map<string, ForeignSibling>();
    for (const sibling of siblings) {
        byFile.set(sibling.file, sibling);
        for (const alias of headerAliases(sibling.file))
            if (!byFile.has(alias))
                byFile.set(alias, sibling);
    }
    const dependencies: string[] = [];
    const seen = new Set<string>([file]);
    const queue = [file];
    while (queue.length > 0) {
        const current = queue.shift()!;
        const source = sources[current];
        if (source === undefined)
            continue;
        for (const include of quotedIncludes(source)) {
            if (ENGINE_HEADERS.has(include))
                continue;
            const sibling = byFile.get(include);
            const specifier = sibling ? sibling.name : include.replace(/\.[^./]+$/, '');
            if (!dependencies.includes(specifier))
                dependencies.push(specifier);
            if (sibling && !seen.has(sibling.file)) {
                seen.add(sibling.file);
                queue.push(sibling.file);
            }
        }
    }
    return dependencies;
}
function quotedIncludes(source: string): string[] {
    const includes: string[] = [];
    for (const match of source.matchAll(QUOTED_INCLUDE)) {
        const name = match[1].trim().replace(/^\.\//, '');
        if (name && !name.includes('/'))
            includes.push(name);
    }
    return includes;
}
